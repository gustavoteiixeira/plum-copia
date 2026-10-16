"""
Pré-visualização do recorte (antes da análise do Gemini).

Fluxo:
1. criar_preview  -> remove o fundo e guarda o PNG em temp_previews/;
2. o usuário confere no app:
   - torto -> girar_preview (90°, quantas vezes quiser);
   - ruim -> descartar_preview (apaga) e tira outra foto;
   - bom  -> o app guarda o id e depois chama a análise;
3. carregar_preview -> a análise lê o PNG aprovado (sem refazer o rembg);
4. após o cadastro, a prévia é apagada. Prévias abandonadas expiram
   (PREVIEW_TTL_MIN) e são removidas por limpar_previews_expiradas.

O nome do arquivo inclui o id do usuário, então um usuário não
consegue usar a prévia de outro.
"""

import io
import logging
import re
import time
import uuid
from pathlib import Path

from PIL import Image

from app.core.config import APP_URL, PREVIEW_TTL_MIN
from app.core.exceptions import PreviewNaoEncontradaError
from app.services.imagem_service import processar_foto_peca


logger = logging.getLogger("plum.preview")


preview_dir = Path("temp_previews")

preview_dir.mkdir(exist_ok=True)


_ID_VALIDO = re.compile(r"^[0-9a-f]{32}$")

MENSAGEM_EXPIRADA = (
    "A pré-visualização expirou ou não foi encontrada. "
    "Tire a foto novamente."
)


def _caminho(id_preview, usuario_id):

    # Evita path traversal: só aceita o formato gerado por nós
    if not id_preview or not _ID_VALIDO.match(id_preview):
        raise PreviewNaoEncontradaError(MENSAGEM_EXPIRADA)

    return preview_dir / f"{usuario_id}_{id_preview}.png"


def _expirada(caminho):

    return time.time() - caminho.stat().st_mtime > PREVIEW_TTL_MIN * 60


def criar_preview(conteudo, usuario_id):

    limpar_previews_expiradas()

    png = processar_foto_peca(conteudo)

    id_preview = uuid.uuid4().hex

    caminho = _caminho(id_preview, usuario_id)

    caminho.write_bytes(png)

    logger.info(
        "👀 Prévia criada | id=%s | usuario_id=%s | %d KB",
        id_preview,
        usuario_id,
        len(png) // 1024
    )

    return {
        "id_preview": id_preview,
        "url": _url(caminho)
    }


def carregar_preview(id_preview, usuario_id):

    caminho = _caminho(id_preview, usuario_id)

    if not caminho.exists() or _expirada(caminho):

        caminho.unlink(missing_ok=True)

        raise PreviewNaoEncontradaError(MENSAGEM_EXPIRADA)

    return caminho.read_bytes()


def _url(caminho):

    # ?v= muda a cada alteração do arquivo: evita o app mostrar a versão em cache
    versao = int(caminho.stat().st_mtime * 1000)

    return f"{APP_URL}/previews/{caminho.name}?v={versao}"


def girar_preview(id_preview, usuario_id, sentido):
    """
    Gira o recorte 90° (sentido: "horario" ou "anti_horario").
    O canvas é quadrado, então a rotação não corta nem perde qualidade.
    """

    png = carregar_preview(id_preview, usuario_id)

    caminho = _caminho(id_preview, usuario_id)

    # No Pillow, ROTATE_90 é anti-horário
    transposicao = (
        Image.Transpose.ROTATE_270
        if sentido == "horario"
        else Image.Transpose.ROTATE_90
    )

    with Image.open(io.BytesIO(png)) as imagem:

        girada = imagem.transpose(transposicao)

    buffer = io.BytesIO()

    girada.save(buffer, format="PNG")

    caminho.write_bytes(buffer.getvalue())

    logger.info(
        "🔄 Prévia girada | id=%s | usuario_id=%s | sentido=%s",
        id_preview,
        usuario_id,
        sentido
    )

    return {
        "id_preview": id_preview,
        "url": _url(caminho)
    }


def descartar_preview(id_preview, usuario_id):

    try:
        caminho = _caminho(id_preview, usuario_id)
    except PreviewNaoEncontradaError:
        return

    caminho.unlink(missing_ok=True)

    logger.info("🗑️ Prévia descartada | id=%s | usuario_id=%s", id_preview, usuario_id)


def limpar_previews_expiradas():

    removidas = 0

    for caminho in preview_dir.glob("*.png"):

        try:

            if _expirada(caminho):
                caminho.unlink(missing_ok=True)
                removidas += 1

        except FileNotFoundError:
            # Outra requisição apagou ao mesmo tempo
            pass

    if removidas:
        logger.info("🧹 %d prévia(s) expirada(s) removida(s)", removidas)
