from typing import Literal

from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel

from app.services.background_service import (
    analisar_previews,
    gerar_preview,
    girar_preview_usuario,
    processar_imagem,
    remover_preview
)


router = APIRouter()


# ==========================
# Fluxo com pré-visualização (usado pelo app)
# ==========================

@router.post("/preview-peca")
async def criar_preview_peca(

    file: UploadFile = File(...),
    codigo_usuario: str = Form(...)

):
    """Remove o fundo e devolve a prévia para o usuário aprovar."""

    return await gerar_preview(
        file,
        codigo_usuario
    )


@router.delete("/preview-peca/{id_preview}")
async def descartar_preview_peca(
    id_preview: str,
    codigo_usuario: str
):
    """Usuário reprovou o recorte: apaga a prévia."""

    await remover_preview(
        id_preview,
        codigo_usuario
    )

    return {"mensagem": "Prévia descartada"}


class GirarPreviewRequest(BaseModel):

    codigo_usuario: str

    sentido: Literal["horario", "anti_horario"] = "horario"


@router.post("/preview-peca/{id_preview}/girar")
async def girar_preview_peca(
    id_preview: str,
    request: GirarPreviewRequest
):
    """Gira o recorte 90° e devolve a nova URL."""

    return await girar_preview_usuario(
        id_preview,
        request.codigo_usuario,
        request.sentido
    )


class AnalisarPecaRequest(BaseModel):

    codigo_usuario: str

    id_preview_frente: str

    # Prévia do verso (opcional)
    id_preview_verso: str | None = None


@router.post("/analisar-peca")
async def analisar_peca(request: AnalisarPecaRequest):
    """Analisa com o Gemini as prévias aprovadas e cadastra a peça."""

    return await analisar_previews(
        request.codigo_usuario,
        request.id_preview_frente,
        request.id_preview_verso
    )


# ==========================
# Fluxo direto (sem prévia), mantido por compatibilidade
# ==========================

@router.post("/remove-bg")
async def remover_fundo(

    file: UploadFile = File(...),
    codigo_usuario: str = Form(...),

    # Foto do verso da peça (opcional)
    file_verso: UploadFile | None = File(None)

):

    return await processar_imagem(
        file,
        codigo_usuario,
        file_verso
    )
