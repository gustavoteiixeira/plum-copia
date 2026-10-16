class ErroAplicacao(Exception):
    """
    Erro com mensagem amigável para o usuário final.

    O handler registrado em main.py converte em resposta HTTP:
    {"detail": mensagem}
    """

    status_code = 500

    def __init__(self, mensagem):

        super().__init__(mensagem)

        self.mensagem = mensagem


class FalhaIAError(ErroAplicacao):
    """O Gemini falhou (erro da API, timeout ou resposta inválida)."""

    status_code = 503


class ImagemInvalidaError(ErroAplicacao):
    """O arquivo enviado não é uma imagem válida."""

    status_code = 400


class ImagemMuitoGrandeError(ErroAplicacao):
    """O arquivo enviado passa do tamanho máximo permitido."""

    status_code = 413


class ServidorOcupadoError(ErroAplicacao):
    """Fila da remoção de fundo cheia ou espera longa demais."""

    status_code = 503


class EmailEmUsoError(ErroAplicacao):

    status_code = 409


class CodigoInvalidoError(ErroAplicacao):
    """Código de verificação errado, expirado ou já usado."""

    status_code = 400


class AguardeReenvioError(ErroAplicacao):
    """Pediu um novo código antes do intervalo mínimo."""

    status_code = 429


class FalhaEnvioEmailError(ErroAplicacao):
    """Não foi possível enviar o e-mail (Gmail fora, senha errada...)."""

    status_code = 503


class UsuarioNaoEncontradoError(ErroAplicacao):

    status_code = 404


class PreviewNaoEncontradaError(ErroAplicacao):
    """A pré-visualização não existe, expirou ou é de outro usuário."""

    status_code = 410
