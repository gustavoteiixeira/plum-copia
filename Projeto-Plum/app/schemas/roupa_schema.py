import logging

from pydantic import BaseModel, field_validator, model_validator

from app.core.urls import url_publica
from app.core.vocabulario import (
    CATEGORIAS,
    ESTACOES,
    FORMALIDADES,
    PALETAS,
    normalizar,
    normalizar_lista
)


logger = logging.getLogger("plum.vocabulario")


class RoupaBase(BaseModel):

    nome: str
    tipo: str
    categoria: str

    cores: list[str]
    paleta_cores: list[str]

    estilo: str
    formalidade: str
    tecido: str

    ocasioes: list[str]
    estacoes: list[str]

    descricao: str

    pode_sobrepor: bool = False


    # Garantia extra: mesmo com "enum" no schema do Gemini,
    # padroniza variações (maiúsculas, acentos, plural, sinônimos)

    @field_validator("categoria")
    @classmethod
    def _categoria(cls, valor):
        return _escalar(valor, CATEGORIAS, "categoria")

    @field_validator("formalidade")
    @classmethod
    def _formalidade(cls, valor):
        return _escalar(valor, FORMALIDADES, "formalidade")

    @field_validator("paleta_cores")
    @classmethod
    def _paleta(cls, valores):
        return _lista(valores, PALETAS, "paleta_cores")

    @field_validator("estacoes")
    @classmethod
    def _estacoes(cls, valores):
        return _lista(valores, ESTACOES, "estacoes")


    @model_validator(mode="after")
    def _sobreposicao_sempre_sobrepoe(self):

        if self.categoria == "Sobreposição":
            self.pode_sobrepor = True

        return self


def _escalar(valor, opcoes, campo):

    oficial = normalizar(valor, opcoes)

    if oficial is None:

        # Não reconhecido: mantém o original para não perder a análise
        logger.warning("⚠️ %s fora do padrão: %r", campo, valor)

        return valor

    return oficial


def _lista(valores, opcoes, campo):

    validos, desconhecidos = normalizar_lista(valores, opcoes)

    if desconhecidos:
        logger.warning("⚠️ %s: valores descartados %r", campo, desconhecidos)

    return validos


class RoupaCreate(RoupaBase):
    pass

class RoupaResponse(BaseModel):

    id: int

    nome: str

    tipo: str | None = None

    categoria: str

    cores: list[str] | None = None

    paleta_cores: list[str] | None = None

    estilo: str | None = None

    formalidade: str | None = None

    tecido: str | None = None

    ocasioes: list[str] | None = None

    estacoes: list[str] | None = None

    descricao: str | None = None

    pode_sobrepor: bool = False

    imagem_url: str

    imagem_verso_url: str | None = None

    miniatura_url: str | None = None


    # O banco guarda só o caminho; o app recebe a URL completa
    @field_validator("imagem_url", "imagem_verso_url", "miniatura_url")
    @classmethod
    def _url_completa(cls, valor):
        return url_publica(valor)


    class Config:
        from_attributes = True
