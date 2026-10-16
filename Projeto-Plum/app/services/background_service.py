import logging
import time
import uuid
from pathlib import Path

from fastapi.concurrency import run_in_threadpool

from app.core.config import UPLOAD_MAX_MB
from app.core.fila_imagem import fila_imagem
from app.core.urls import url_publica
from app.core.exceptions import (
    ImagemMuitoGrandeError,
    UsuarioNaoEncontradoError
)
from app.database import SessionLocal
from app.models import Roupa
from app.services.gemini_service import analisar_imagem
from app.services.imagem_service import gerar_miniatura, processar_foto_peca
from app.services.metricas_service import executar_com, medir
from app.services.preview_service import (
    carregar_preview,
    criar_preview,
    descartar_preview,
    girar_preview
)
from app.services.usuario_service import buscar_usuario_por_codigo


logger = logging.getLogger("plum.cadastro")


saida_dir = Path("saida")

saida_dir.mkdir(exist_ok=True)


async def _ler_upload(file, descricao):

    conteudo = await file.read()

    if len(conteudo) > UPLOAD_MAX_MB * 1024 * 1024:

        nome = f"A foto {descricao}".strip() if descricao else "A foto"

        raise ImagemMuitoGrandeError(
            f"{nome} é muito grande. "
            f"Envie uma foto de até {UPLOAD_MAX_MB} MB."
        )

    return conteudo


async def processar_imagem(file, codigo_usuario, file_verso=None):
    """
    Fluxo de cadastro de peça:

    1. valida o usuário ANTES de gastar CPU/Gemini;
    2. remove o fundo da frente (e do verso, se enviado) e analisa
       tudo em UMA chamada ao Gemini (em thread, sem travar o servidor);
    3. só grava as imagens e o registro se tudo deu certo.
       Se algo falhar, nada fica salvo (sem imagens órfãs).
    """

    usuario = await _buscar_usuario(codigo_usuario)

    # Fluxo direto: rembg + Gemini na mesma medição
    with medir("analise_peca", usuario.id) as medicao:

        conteudo_frente = await _ler_upload(file, "da frente")

        conteudo_verso = None

        if file_verso is not None:

            conteudo_verso = await _ler_upload(file_verso, "do verso")

            # Campo enviado vazio = sem verso
            if not conteudo_verso:
                conteudo_verso = None

        medicao.com_verso = conteudo_verso is not None

        # Espera vaga na fila do rembg sem ocupar thread
        async with fila_imagem.vaga():

            return await run_in_threadpool(
                executar_com,
                medicao,
                _processar_sincrono,
                conteudo_frente,
                conteudo_verso,
                usuario.id
            )


def _salvar_png(png):

    nome = f"roupa_{uuid.uuid4().hex}.png"

    caminho = saida_dir / nome

    caminho.write_bytes(png)

    # No banco vai só o caminho; a URL completa é montada ao responder
    return caminho, f"/saida/{nome}"


def _salvar_miniatura(png, caminho_png):
    """Grava roupa_x_mini.webp ao lado do PNG. Falha não impede o cadastro."""

    try:

        caminho = caminho_png.with_name(f"{caminho_png.stem}_mini.webp")

        caminho.write_bytes(gerar_miniatura(png))

        return caminho, f"/saida/{caminho.name}"

    except Exception:

        logger.exception("Falha ao gerar miniatura; o app usará a imagem grande")

        return None, None


async def _buscar_usuario(codigo_usuario):

    usuario = await run_in_threadpool(
        buscar_usuario_por_codigo,
        codigo_usuario
    )

    if usuario is None:
        raise UsuarioNaoEncontradoError("Usuário não encontrado.")

    return usuario


# ==========================
# Fluxo com pré-visualização
# ==========================

async def gerar_preview(file, codigo_usuario):
    """Remove o fundo e devolve a prévia para o usuário aprovar."""

    usuario = await _buscar_usuario(codigo_usuario)

    with medir("preview", usuario.id) as medicao:

        conteudo = await _ler_upload(file, "")

        # Espera vaga na fila do rembg sem ocupar thread
        async with fila_imagem.vaga():

            return await run_in_threadpool(
                executar_com,
                medicao,
                criar_preview,
                conteudo,
                usuario.id
            )


async def remover_preview(id_preview, codigo_usuario):

    usuario = await _buscar_usuario(codigo_usuario)

    await run_in_threadpool(
        descartar_preview,
        id_preview,
        usuario.id
    )


async def girar_preview_usuario(id_preview, codigo_usuario, sentido):

    usuario = await _buscar_usuario(codigo_usuario)

    return await run_in_threadpool(
        girar_preview,
        id_preview,
        usuario.id,
        sentido
    )


async def analisar_previews(codigo_usuario, id_frente, id_verso=None):
    """
    Analisa as prévias APROVADAS pelo usuário (sem refazer o rembg).
    Se o Gemini falhar, as prévias continuam guardadas para nova tentativa.
    """

    usuario = await _buscar_usuario(codigo_usuario)

    def executar():

        png_frente = carregar_preview(id_frente, usuario.id)

        png_verso = (
            carregar_preview(id_verso, usuario.id)
            if id_verso
            else None
        )

        resposta = _analisar_e_salvar(png_frente, png_verso, usuario.id)

        # Cadastro OK: as prévias não são mais necessárias
        descartar_preview(id_frente, usuario.id)

        if id_verso:
            descartar_preview(id_verso, usuario.id)

        return resposta

    with medir("analise_peca", usuario.id, com_verso=bool(id_verso)) as medicao:

        return await run_in_threadpool(executar_com, medicao, executar)


# ==========================
# Fluxo direto (sem prévia)
# ==========================

def _processar_sincrono(conteudo_frente, conteudo_verso, usuario_id):

    # Tudo em memória até aqui
    png_frente = processar_foto_peca(conteudo_frente)

    png_verso = (
        processar_foto_peca(conteudo_verso)
        if conteudo_verso
        else None
    )

    return _analisar_e_salvar(png_frente, png_verso, usuario_id)


def _analisar_e_salvar(png_frente, png_verso, usuario_id):

    inicio = time.perf_counter()

    analise = analisar_imagem(png_frente, png_verso)


    # Análise OK: agora sim grava as imagens
    arquivos = []

    caminho_frente, url_frente = _salvar_png(png_frente)
    arquivos.append(caminho_frente)

    caminho_mini, url_mini = _salvar_miniatura(png_frente, caminho_frente)

    if caminho_mini:
        arquivos.append(caminho_mini)

    url_verso = None

    if png_verso:
        caminho_verso, url_verso = _salvar_png(png_verso)
        arquivos.append(caminho_verso)


    db = SessionLocal()

    try:

        roupa = Roupa(
            usuario_id=usuario_id,
            nome=analise.nome,
            tipo=analise.tipo,
            categoria=analise.categoria,
            cores=analise.cores,
            paleta_cores=analise.paleta_cores,
            estilo=analise.estilo,
            formalidade=analise.formalidade,
            tecido=analise.tecido,
            ocasioes=analise.ocasioes,
            estacoes=analise.estacoes,
            descricao=analise.descricao,
            pode_sobrepor=analise.pode_sobrepor,
            imagem_url=url_frente,
            imagem_verso_url=url_verso,
            miniatura_url=url_mini
        )

        db.add(roupa)
        db.commit()
        db.refresh(roupa)

    except Exception:

        # Banco falhou: remove as imagens para não deixar arquivos órfãos
        db.rollback()

        for caminho in arquivos:
            caminho.unlink(missing_ok=True)

        logger.exception("❌ Falha ao salvar a peça no banco")

        raise

    finally:

        db.close()


    logger.info(
        "✅ Peça cadastrada | id=%s | usuario_id=%s | verso=%s | total=%.2fs",
        roupa.id,
        usuario_id,
        "sim" if png_verso else "não",
        time.perf_counter() - inicio
    )

    return {
        "mensagem": "Imagem processada",
        "id": roupa.id,
        "url": url_publica(url_frente),
        "url_verso": url_publica(url_verso),
        "analise": analise.model_dump()
    }
