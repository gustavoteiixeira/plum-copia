"""
Envio de e-mails pelo Gmail (SMTP + STARTTLS, porta 587).

Usa uma "senha de app" do Google (EMAIL_SENHA_APP no .env), nunca a senha
normal da conta. Só a biblioteca padrão do Python.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import (
    EMAIL_NOME,
    EMAIL_REMETENTE,
    EMAIL_SENHA_APP,
    EMAIL_SMTP_HOST,
    EMAIL_SMTP_PORTA
)
from app.core.exceptions import FalhaEnvioEmailError


logger = logging.getLogger("plum.email")


MENSAGEM_FALHA = (
    "Não foi possível enviar o e-mail agora. "
    "Tente novamente em instantes."
)


def mascarar(email):
    """luciana@gmail.com -> lu***@gmail.com (para logs)."""

    usuario, _, dominio = (email or "").partition("@")

    return f"{usuario[:2]}***@{dominio}" if dominio else "***"


def email_configurado():

    return bool(EMAIL_REMETENTE and EMAIL_SENHA_APP)


def enviar_email(destino, assunto, texto, html=None):
    """Envia o e-mail ou lança FalhaEnvioEmailError (com o motivo só no log)."""

    if not email_configurado():

        logger.error("❌ E-mail não configurado: defina EMAIL_REMETENTE e EMAIL_SENHA_APP no .env")

        raise FalhaEnvioEmailError(MENSAGEM_FALHA)

    mensagem = EmailMessage()

    mensagem["Subject"] = assunto
    mensagem["From"] = formataddr((EMAIL_NOME, EMAIL_REMETENTE))
    mensagem["To"] = destino

    mensagem.set_content(texto)

    if html:
        mensagem.add_alternative(html, subtype="html")

    try:

        with smtplib.SMTP(EMAIL_SMTP_HOST, EMAIL_SMTP_PORTA, timeout=20) as smtp:

            smtp.starttls(context=ssl.create_default_context())

            smtp.login(EMAIL_REMETENTE, EMAIL_SENHA_APP)

            smtp.send_message(mensagem)

    except smtplib.SMTPAuthenticationError as erro:

        logger.error(
            "❌ Gmail recusou o login (confira EMAIL_REMETENTE e a senha de app): %s",
            erro.smtp_code
        )

        raise FalhaEnvioEmailError(MENSAGEM_FALHA) from erro

    except (smtplib.SMTPException, OSError) as erro:

        logger.error("❌ Falha ao enviar e-mail para %s: %s", mascarar(destino), type(erro).__name__)

        raise FalhaEnvioEmailError(MENSAGEM_FALHA) from erro

    logger.info("📧 E-mail enviado para %s: %s", mascarar(destino), assunto.split(":")[0])


def enviar_codigo(destino, codigo, finalidade):

    acao = (
        "confirmar seu e-mail e criar sua conta"
        if finalidade == "cadastro"
        else "recuperar sua conta"
    )

    assunto = f"Seu código PLUM: {codigo}"

    texto = (
        f"Olá!\n\n"
        f"Use o código abaixo para {acao} no PLUM:\n\n"
        f"    {codigo}\n\n"
        f"O código vale por alguns minutos.\n\n"
        f"Se não foi você, ignore este e-mail.\n"
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#1A162B">
      <h2 style="color:#5A31A9">PLUM</h2>
      <p>Use o código abaixo para {acao}:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;
                background:#EFE9FA;padding:14px;text-align:center;border-radius:12px">
        {codigo}
      </p>
      <p style="color:#777">O código vale por alguns minutos.</p>
      <p style="color:#777;font-size:12px">Se não foi você, ignore este e-mail.</p>
    </div>
    """

    enviar_email(destino, assunto, texto, html)
