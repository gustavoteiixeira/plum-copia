from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PecaLook(BaseModel):

    id: Optional[int] = None

    nome: Optional[str] = None

    tipo: Optional[str] = None

    categoria: Optional[str] = None

    estilo: Optional[str] = None

    formalidade: Optional[str] = None

    descricao: Optional[str] = None

    imagem: Optional[str] = None

    # Imagem pequena para os quadradinhos do look no chat
    miniatura: Optional[str] = None


class Look(BaseModel):

    peca_unica: Optional[PecaLook] = None

    parte_superior: Optional[PecaLook] = None

    parte_inferior: Optional[PecaLook] = None

    calcado: Optional[PecaLook] = None

    sobreposicao: Optional[PecaLook] = None

    acessorio: Optional[PecaLook] = None



class RecomendacaoResponse(BaseModel):

    id_recomendacao: Optional[int] = None

    look: Optional[Look] = None

    justificativa: str


class OutfitResponse(BaseModel):
    """Look curtido (👍), exibido na aba Outfits do guarda-roupa."""

    id: int

    prompt: str

    justificativa: Optional[str] = None

    criado_em: datetime

    look: Look
