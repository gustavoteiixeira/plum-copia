import re

from pydantic import BaseModel, field_validator


GENEROS = ["Feminino", "Masculino", "Prefiro não informar"]

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validar_email(valor):

    email = (valor or "").strip().lower()

    if len(email) > 255 or not _EMAIL.match(email):
        raise ValueError("Digite um e-mail válido.")

    return email


def _validar_nome(valor):

    nome = " ".join((valor or "").split())

    if not 2 <= len(nome) <= 100:
        raise ValueError("O nome deve ter entre 2 e 100 caracteres.")

    return nome


def _validar_genero(valor):

    if valor not in GENEROS:
        raise ValueError("Escolha uma opção de gênero.")

    return valor


class UsuarioResponse(BaseModel):

    id: int
    codigo_recuperacao: str
    nome: str | None = None
    email: str | None = None
    genero: str | None = None


    class Config:
        from_attributes = True



class CadastroDados(BaseModel):
    """Dados do formulário de cadastro (primeiro acesso)."""

    nome: str
    email: str
    genero: str

    @field_validator("nome")
    @classmethod
    def _nome(cls, valor):
        return _validar_nome(valor)

    @field_validator("email")
    @classmethod
    def _email(cls, valor):
        return _validar_email(valor)

    @field_validator("genero")
    @classmethod
    def _genero(cls, valor):
        return _validar_genero(valor)



_CODIGO = re.compile(r"^\d{6}$")


def _validar_codigo(valor):

    codigo = (valor or "").strip()

    if not _CODIGO.match(codigo):
        raise ValueError("Digite o código de 6 números enviado ao seu e-mail.")

    return codigo


class UsuarioCreate(CadastroDados):
    """Cadastro + código recebido por e-mail (confirma que o e-mail é da pessoa)."""

    codigo: str

    @field_validator("codigo")
    @classmethod
    def _codigo(cls, valor):
        return _validar_codigo(valor)



class EmailRequest(BaseModel):

    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, valor):
        return _validar_email(valor)



class ConfirmarEmailRequest(EmailRequest):

    codigo: str

    @field_validator("codigo")
    @classmethod
    def _codigo(cls, valor):
        return _validar_codigo(valor)



class UsuarioUpdate(BaseModel):
    """
    Edição do Perfil: só os campos enviados são alterados.
    O e-mail não pode ser alterado aqui (ele é usado para recuperar a conta).
    """

    nome: str | None = None
    genero: str | None = None

    @field_validator("nome")
    @classmethod
    def _nome(cls, valor):
        return None if valor is None else _validar_nome(valor)

    @field_validator("genero")
    @classmethod
    def _genero(cls, valor):
        return None if valor is None else _validar_genero(valor)



# Tamanho máximo de cada campo do aparelho (igual às colunas do banco)
LIMITES_DISPOSITIVO = {
    "marca": 60,
    "fabricante": 60,
    "modelo": 100,
    "sistema": 30,
    "versao_sistema": 30,
    "tipo": 20,
    "versao_app": 20,
}


class DispositivoInfo(BaseModel):
    """
    Informações do aparelho enviadas pelo app (expo-device).

    Tolerante de propósito: são dados só para estatística, então valores
    inesperados são convertidos/cortados em vez de recusar o registro.
    """

    celular_real: bool | None = None
    marca: str | None = None
    fabricante: str | None = None
    modelo: str | None = None
    sistema: str | None = None
    versao_sistema: str | None = None
    tipo: str | None = None
    versao_app: str | None = None

    @field_validator("celular_real", mode="before")
    @classmethod
    def _celular_real(cls, valor):

        if valor is None or isinstance(valor, bool):
            return valor

        texto = str(valor).strip().lower()

        if texto in ("true", "1", "sim", "yes"):
            return True

        if texto in ("false", "0", "não", "nao", "no"):
            return False

        return None

    @field_validator(*LIMITES_DISPOSITIVO, mode="before")
    @classmethod
    def _texto(cls, valor, info):

        if valor is None:
            return None

        texto = str(valor).strip()

        return texto[:LIMITES_DISPOSITIVO[info.field_name]] or None
