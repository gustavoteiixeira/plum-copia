import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.core.exceptions import (
    AguardeReenvioError,
    CodigoInvalidoError,
    EmailEmUsoError,
    FalhaEnvioEmailError
)
from app.core.limite_tentativas import (
    registrar_envio_email,
    registrar_erro,
    verificar_bloqueio
)
from app.services import codigo_email_service

from app.schemas.usuario_schema import (
    CadastroDados,
    ConfirmarEmailRequest,
    DispositivoInfo,
    EmailRequest,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate
)

from app.services.usuario_service import (
    criar_usuario,
    buscar_usuario_por_codigo,
    atualizar_perfil,
    registrar_dispositivo,
    buscar_usuario_por_email,
    email_em_uso,
    deletar_usuario,
    estatisticas_usuario
)

logger = logging.getLogger("plum.usuario")

router = APIRouter()



# ============================
# Primeiro login
# ============================

@router.post(
    "/usuario/criar",
    response_model=UsuarioResponse
)
def criar(dados: UsuarioCreate, request: Request):
    """Cria a conta depois de conferir o código enviado ao e-mail."""

    verificar_bloqueio(request)

    try:
        codigo_email_service.verificar(dados.email, "cadastro", dados.codigo)
    except CodigoInvalidoError:
        registrar_erro(request)
        raise

    usuario = criar_usuario(dados)

    return usuario



# ============================
# Recuperação de conta
# ============================

@router.post(
    "/usuario/recuperar",
    response_model=UsuarioResponse
)
def recuperar(codigo: str, request: Request):

    verificar_bloqueio(request)

    usuario = buscar_usuario_por_codigo(
        codigo
    )


    if usuario is None:

        registrar_erro(request)

        raise HTTPException(
            status_code=404,
            detail="Código não encontrado"
        )


    return usuario


@router.get(
    "/usuario/verificar/{codigo}",
    response_model=UsuarioResponse
)
def verificar_usuario(codigo: str, request: Request):

    verificar_bloqueio(request)

    usuario = buscar_usuario_por_codigo(codigo)


    if usuario is None:

        registrar_erro(request)

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )


    return usuario

@router.put(
    "/usuario/{codigo}",
    response_model=UsuarioResponse
)
def atualizar_usuario(
    codigo: str,
    dados: UsuarioUpdate
):

    usuario = atualizar_perfil(
        codigo,
        dados
    )


    if usuario is None:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )


    return usuario


@router.delete(
    "/usuario/{codigo}"
)
def excluir_usuario(codigo:str):


    usuario = deletar_usuario(
        codigo
    )


    if usuario is None:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )


    return {
        "mensagem":"Usuário removido com sucesso"
    }


@router.get("/usuario/{codigo}/estatisticas")
def estatisticas(codigo: str, request: Request):
    """Contadores exibidos no Perfil."""

    # Mesmo limitador do login: a rota não pode servir para adivinhar códigos
    verificar_bloqueio(request)

    dados = estatisticas_usuario(codigo)

    if dados is None:

        registrar_erro(request)

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )

    return dados


@router.post("/usuario/{codigo}/dispositivo")
def salvar_dispositivo(codigo: str, info: DispositivoInfo, request: Request):
    """Registra o aparelho em uso (chamado pelo app ao entrar na conta)."""

    verificar_bloqueio(request)

    if not registrar_dispositivo(codigo, info):

        registrar_erro(request)

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )

    logger.info(
        "📱 Aparelho registrado: %s %s (%s %s)%s",
        info.marca or info.fabricante or "?",
        info.modelo or "?",
        info.sistema or "?",
        info.versao_sistema or "",
        "" if info.celular_real is not False else " [EMULADOR]"
    )

    return {"mensagem": "Dispositivo registrado"}


# ============================
# Verificação e recuperação por e-mail
# ============================

MENSAGEM_RECUPERACAO = (
    "Se o e-mail estiver cadastrado, enviamos um código para ele. "
    "Confira também a caixa de spam."
)


@router.post("/usuario/cadastro/enviar-codigo")
def enviar_codigo_cadastro(dados: CadastroDados, request: Request):
    """Confere o formulário e envia o código para confirmar o e-mail."""

    if email_em_uso(dados.email):
        raise EmailEmUsoError("Este e-mail já está em uso.")

    registrar_envio_email(request)

    # Erros (aguardar reenvio, falha no envio) já têm mensagem para o usuário
    codigo_email_service.gerar_e_enviar(dados.email, "cadastro")

    return {"mensagem": "Enviamos um código para o seu e-mail."}


def _enviar_recuperacao_em_segundo_plano(email):
    """
    Roda depois da resposta: o tempo de resposta é o mesmo
    para e-mails cadastrados ou não (não revela quem tem conta).
    """

    if buscar_usuario_por_email(email) is None:
        return

    try:
        codigo_email_service.gerar_e_enviar(email, "recuperacao")
    except (AguardeReenvioError, FalhaEnvioEmailError) as erro:
        logger.warning("⚠️ Recuperação por e-mail não enviada: %s", erro.mensagem)


@router.post("/usuario/recuperar-email/enviar-codigo")
def enviar_codigo_recuperacao(
    dados: EmailRequest,
    request: Request,
    tarefas: BackgroundTasks
):

    registrar_envio_email(request)

    tarefas.add_task(_enviar_recuperacao_em_segundo_plano, dados.email)

    # Sempre a mesma resposta, exista ou não a conta
    return {"mensagem": MENSAGEM_RECUPERACAO}


@router.post(
    "/usuario/recuperar-email/confirmar",
    response_model=UsuarioResponse
)
def confirmar_recuperacao(dados: ConfirmarEmailRequest, request: Request):

    verificar_bloqueio(request)

    try:
        codigo_email_service.verificar(dados.email, "recuperacao", dados.codigo)
    except CodigoInvalidoError:
        registrar_erro(request)
        raise

    usuario = buscar_usuario_por_email(dados.email)

    if usuario is None:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    return usuario
