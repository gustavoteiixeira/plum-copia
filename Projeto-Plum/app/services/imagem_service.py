"""
Pipeline de imagem das peças:

1. Pré-processamento  -> corrige rotação (EXIF) e reduz o tamanho;
2. Máscara           -> rembg com sessão única (modelo carregado 1 vez);
                        usamos só a máscara, aplicada sobre a foto original;
3. Pós-processamento -> trata a máscara (app/services/mascara_service.py:
                        histerese, fechamento, ilhas, buracos), recorta,
                        centraliza em um quadrado com margem e padroniza
                        o tamanho.

Tudo acontece em memória. Nada é gravado em disco aqui.
Funções síncronas (CPU): devem ser chamadas fora do event loop
(ex.: run_in_threadpool).
"""

import io
import logging
import os
import threading
import time
import uuid
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove

from app.core.config import (
    IMAGEM_LADO_MAX_ENTRADA,
    IMAGEM_LADO_SAIDA,
    REMBG_DEBUG,
    REMBG_MAX_CONCORRENCIA,
    REMBG_MODEL,
    REMBG_THREADS
)
from app.core.exceptions import ImagemInvalidaError
from app.services.mascara_service import (
    LIMIAR_ALPHA,
    parametros_padrao,
    tratar_mascara
)
from app.services.metricas_service import medicao_atual


logger = logging.getLogger("plum.imagem")


# Margem em volta da peça na imagem final (fração do lado)
MARGEM = 0.06

DEBUG_DIR = Path("debug_rembg")


_sessao = None
_lock_sessao = threading.Lock()
_semaforo_rembg = threading.BoundedSemaphore(REMBG_MAX_CONCORRENCIA)


# ==========================
# Sessão do rembg
# ==========================

def carregar_modelo():
    """
    Carrega o modelo do rembg uma única vez (thread-safe).

    Na primeira execução o rembg baixa o modelo para ~/.u2net,
    o que pode levar alguns minutos.
    """

    global _sessao

    if _sessao is not None:
        return _sessao

    with _lock_sessao:

        if _sessao is None:

            inicio = time.perf_counter()

            logger.info("🟡 Carregando modelo rembg '%s'...", REMBG_MODEL)

            # O rembg lê OMP_NUM_THREADS ao criar a sessão e limita os
            # núcleos usados por remoção (evita disputa de CPU no servidor)
            if REMBG_THREADS:
                os.environ["OMP_NUM_THREADS"] = str(REMBG_THREADS)
                logger.info("🧵 rembg limitado a %s thread(s)", REMBG_THREADS)

            _sessao = new_session(REMBG_MODEL)

            logger.info(
                "🟢 Modelo rembg '%s' carregado em %.2fs",
                REMBG_MODEL,
                time.perf_counter() - inicio
            )

    return _sessao


# ==========================
# 1. Pré-processamento
# ==========================

def preparar_foto(conteudo):

    try:

        imagem = Image.open(io.BytesIO(conteudo))
        imagem.load()

    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as erro:

        raise ImagemInvalidaError(
            "Não foi possível ler a imagem enviada. Tente outra foto."
        ) from erro


    # Fotos de celular guardam a rotação no EXIF; aplica de fato nos pixels
    imagem = ImageOps.exif_transpose(imagem)

    imagem = imagem.convert("RGB")

    # Reduz mantendo proporção (só diminui, nunca aumenta)
    imagem.thumbnail(
        (IMAGEM_LADO_MAX_ENTRADA, IMAGEM_LADO_MAX_ENTRADA),
        Image.Resampling.LANCZOS
    )

    return imagem


# ==========================
# 2. Remoção de fundo
# ==========================

def _mascara_do_modelo(imagem, sessao, matting):
    """Uma passada do modelo -> máscara (uint8) do tamanho da imagem."""

    if matting:

        # O alpha matting só existe no recorte completo;
        # aproveitamos apenas o canal alpha dele
        resultado = remove(
            imagem,
            session=sessao,
            alpha_matting=True
        )

        mascara = resultado.getchannel("A")

    else:

        mascara = remove(
            imagem,
            session=sessao,
            only_mask=True
        )

    mascara = mascara.convert("L")

    if mascara.size != imagem.size:
        mascara = mascara.resize(imagem.size, Image.Resampling.LANCZOS)

    return np.array(mascara)


def _completar_quadrado(imagem):
    """
    Completa a foto para um quadrado com a cor mediana da borda, para o
    modelo não esticar a imagem. Devolve (imagem quadrada, caixa original).
    """

    largura, altura = imagem.size

    if largura == altura:
        return imagem, (0, 0, largura, altura)

    lado = max(largura, altura)

    pixels = np.asarray(imagem.convert("RGB"))

    borda = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])

    cor = tuple(int(c) for c in np.median(borda, axis=0))

    quadrado = Image.new("RGB", (lado, lado), cor)

    x = (lado - largura) // 2
    y = (lado - altura) // 2

    quadrado.paste(imagem.convert("RGB"), (x, y))

    return quadrado, (x, y, x + largura, y + altura)


def gerar_mascara(imagem, p=None):
    """
    Devolve a máscara BRUTA (0-255, tamanho da foto) da peça.

    Usamos SÓ a máscara do rembg e aplicamos sobre a foto original.
    O recorte pronto do rembg escurece a cor das áreas semi-transparentes,
    o que impede corrigi-las depois (ex.: partes brancas de um tênis).

    Opções (ParametrosRecorte): pad_quadrado, tta (média com a foto
    espelhada) e alpha_matting.
    """

    p = p or parametros_padrao()

    sessao = carregar_modelo()

    # Limita quantas remoções rodam juntas para não estourar CPU/memória.
    # Todas as passadas de UMA foto ficam na mesma vaga.
    with _semaforo_rembg:

        entrada, caixa = (
            _completar_quadrado(imagem)
            if p.pad_quadrado
            else (imagem, None)
        )

        mascara = _mascara_do_modelo(entrada, sessao, p.alpha_matting)

        if p.tta and not p.alpha_matting:

            espelhada = _mascara_do_modelo(ImageOps.mirror(entrada), sessao, False)

            mascara = (
                (mascara.astype(np.uint16) + np.fliplr(espelhada)) // 2
            ).astype(np.uint8)

        if caixa:

            x0, y0, x1, y1 = caixa

            mascara = mascara[y0:y1, x0:x1]

    return mascara


# ==========================
# 3. Pós-processamento
# ==========================
# O tratamento da máscara fica em app/services/mascara_service.py
# (tratar_mascara). Aqui só o recorte final.

def finalizar_recorte(foto, alpha):

    # Cor da foto ORIGINAL + máscara tratada
    pixels = np.dstack([
        np.array(foto.convert("RGB")),
        alpha
    ])

    # Zera a cor dos pixels invisíveis (PNG final fica menor)
    pixels[alpha == 0, :3] = 0


    linhas, colunas = np.nonzero(alpha > LIMIAR_ALPHA)

    if linhas.size == 0:

        raise ImagemInvalidaError(
            "Não consegui identificar a peça na foto. "
            "Tente uma foto com fundo liso e boa iluminação."
        )


    topo, base = linhas.min(), linhas.max() + 1
    esquerda, direita = colunas.min(), colunas.max() + 1

    # Array uint8 HxWx4 -> o Pillow já interpreta como RGBA
    peca = Image.fromarray(
        np.ascontiguousarray(pixels[topo:base, esquerda:direita])
    )


    # Centraliza em um quadrado transparente com margem
    lado = max(peca.width, peca.height)

    margem = int(lado * MARGEM)

    lado_canvas = lado + 2 * margem

    canvas = Image.new(
        "RGBA",
        (lado_canvas, lado_canvas),
        (0, 0, 0, 0)
    )

    canvas.paste(
        peca,
        (
            (lado_canvas - peca.width) // 2,
            (lado_canvas - peca.height) // 2
        )
    )


    if lado_canvas > IMAGEM_LADO_SAIDA:

        canvas = canvas.resize(
            (IMAGEM_LADO_SAIDA, IMAGEM_LADO_SAIDA),
            Image.Resampling.LANCZOS
        )

    return canvas


# ==========================
# Miniatura
# ==========================

# Lado da miniatura (px). Os quadradinhos do app têm ~90 px;
# 256 px fica nítido mesmo em telas de alta densidade.
LADO_MINIATURA = 256


def gerar_miniatura(png):
    """PNG final da peça -> WebP pequeno (com transparência) para listas."""

    with Image.open(io.BytesIO(png)) as imagem:

        mini = imagem.convert("RGBA")

        mini.thumbnail(
            (LADO_MINIATURA, LADO_MINIATURA),
            Image.Resampling.LANCZOS
        )

        buffer = io.BytesIO()

        mini.save(buffer, format="WEBP", quality=80, method=6)

    return buffer.getvalue()


# ==========================
# Debug
# ==========================

def _salvar_debug(foto, mascara_bruta, alpha, final):
    """
    Salva as etapas em debug_rembg/ para comparar o que o modelo
    gerou com o que o pós-processamento corrigiu.
    """

    try:

        DEBUG_DIR.mkdir(exist_ok=True)

        prefixo = f"{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

        foto.save(DEBUG_DIR / f"{prefixo}_1_original.jpg", quality=90)

        Image.fromarray(mascara_bruta).save(DEBUG_DIR / f"{prefixo}_2_mascara_modelo.png")

        Image.fromarray(alpha).save(DEBUG_DIR / f"{prefixo}_3_mascara_tratada.png")

        # Peça sobre fundo xadrez: deixa visíveis os buracos/transparências
        xadrez = Image.new("RGBA", final.size, (255, 255, 255, 255))

        casa = 32
        cinza = Image.new("RGBA", (casa, casa), (200, 200, 200, 255))

        for y in range(0, final.height, casa):
            for x in range((y // casa % 2) * casa, final.width, casa * 2):
                xadrez.paste(cinza, (x, y))

        Image.alpha_composite(xadrez, final).save(
            DEBUG_DIR / f"{prefixo}_4_final_xadrez.png"
        )

        logger.info("🐞 Debug do rembg salvo em %s/%s_*", DEBUG_DIR, prefixo)

    except Exception:

        logger.exception("Falha ao salvar debug do rembg")


# ==========================
# Pipeline completo
# ==========================

def processar_foto_peca(conteudo, p=None):
    """
    Recebe os bytes da foto original e devolve os bytes do PNG final
    (sem fundo, recortado e padronizado).

    p: ParametrosRecorte (padrão: vindo do .env).
    """

    p = p or parametros_padrao()

    inicio = time.perf_counter()

    foto = preparar_foto(conteudo)

    t_pre = time.perf_counter()

    mascara_bruta = gerar_mascara(foto, p)

    t_rembg = time.perf_counter()

    alpha = tratar_mascara(mascara_bruta, p)

    final = finalizar_recorte(foto, alpha)

    buffer = io.BytesIO()

    final.save(buffer, format="PNG")

    png = buffer.getvalue()

    if REMBG_DEBUG:
        _salvar_debug(foto, mascara_bruta, alpha, final)

    medicao = medicao_atual()

    if medicao:
        medicao.somar_imagem(time.perf_counter() - inicio, REMBG_MODEL)

    logger.info(
        "🖼️ Imagem processada | modelo=%s | pré=%.2fs rembg=%.2fs pós=%.2fs | %dx%d | %d KB",
        REMBG_MODEL,
        t_pre - inicio,
        t_rembg - t_pre,
        time.perf_counter() - t_rembg,
        final.width,
        final.height,
        len(png) // 1024
    )

    return png
