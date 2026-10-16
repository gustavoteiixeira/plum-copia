"""
Códigos de verificação por e-mail (cadastro e recuperação de conta).

- 6 dígitos sorteados com `secrets`;
- no banco fica só sha256(sal + código);
- vale CODIGO_EMAIL_VALIDADE_MIN minutos e aceita CODIGO_EMAIL_MAX_TENTATIVAS tentativas;
- intervalo mínimo de CODIGO_EMAIL_INTERVALO_S entre envios para o mesmo e-mail;
- um código novo invalida os anteriores da mesma finalidade.
"""

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta

from app.core.config import (
    CODIGO_EMAIL_INTERVALO_S,
    CODIGO_EMAIL_MAX_TENTATIVAS,
    CODIGO_EMAIL_VALIDADE_MIN
)
from app.core.exceptions import AguardeReenvioError, CodigoInvalidoError
from app.database import SessionLocal
from app.models import CodigoEmail
from app.services.email_service import enviar_codigo, mascarar


logger = logging.getLogger("plum.email")


FINALIDADES = ("cadastro", "recuperacao")


def _hash(sal, codigo):

    return hashlib.sha256(f"{sal}{codigo}".encode()).hexdigest()


def segundos_para_reenviar(email, finalidade):
    """0 se já pode enviar outro código; senão, quantos segundos faltam."""

    db = SessionLocal()

    try:

        ultimo = (
            db.query(CodigoEmail)
            .filter(CodigoEmail.email == email, CodigoEmail.finalidade == finalidade)
            .order_by(CodigoEmail.criado_em.desc())
            .first()
        )

        if ultimo is None:
            return 0

        passados = (datetime.now() - ultimo.criado_em).total_seconds()

        return max(0, int(CODIGO_EMAIL_INTERVALO_S - passados + 0.999))

    finally:

        db.close()


def gerar_e_enviar(email, finalidade):
    """
    Gera um código novo, guarda o hash e envia por e-mail.
    Lança AguardeReenvioError se pedir antes do intervalo,
    ou FalhaEnvioEmailError se o envio falhar (o código é descartado).
    """

    assert finalidade in FINALIDADES

    faltam = segundos_para_reenviar(email, finalidade)

    if faltam:
        raise AguardeReenvioError(
            f"Aguarde {faltam} segundos para pedir um novo código."
        )

    codigo = f"{secrets.randbelow(1_000_000):06d}"

    sal = secrets.token_hex(16)

    agora = datetime.now()

    db = SessionLocal()

    try:

        # Um código novo invalida os anteriores
        db.query(CodigoEmail).filter(
            CodigoEmail.email == email,
            CodigoEmail.finalidade == finalidade,
            CodigoEmail.usado.is_(False)
        ).update({"usado": True})

        registro = CodigoEmail(
            email=email,
            finalidade=finalidade,
            sal=sal,
            codigo_hash=_hash(sal, codigo),
            tentativas=0,
            usado=False,
            criado_em=agora,
            expira_em=agora + timedelta(minutes=CODIGO_EMAIL_VALIDADE_MIN)
        )

        db.add(registro)

        db.commit()

        id_registro = registro.id

    finally:

        db.close()

    try:

        enviar_codigo(email, codigo, finalidade)

    except Exception:

        # Não deixa um código "fantasma" bloqueando o reenvio
        _apagar(id_registro)

        raise


def _apagar(id_registro):

    db = SessionLocal()

    try:
        db.query(CodigoEmail).filter(CodigoEmail.id == id_registro).delete()
        db.commit()
    finally:
        db.close()


def verificar(email, finalidade, codigo):
    """
    Confere o código. Se estiver certo, marca como usado.
    Lança CodigoInvalidoError com a mensagem para o usuário.
    """

    codigo = (codigo or "").strip()

    db = SessionLocal()

    try:

        registro = (
            db.query(CodigoEmail)
            .filter(
                CodigoEmail.email == email,
                CodigoEmail.finalidade == finalidade,
                CodigoEmail.usado.is_(False)
            )
            .order_by(CodigoEmail.criado_em.desc())
            .first()
        )

        if registro is None or registro.expira_em < datetime.now():

            raise CodigoInvalidoError("Código expirado. Peça um novo código.")

        if hmac.compare_digest(registro.codigo_hash, _hash(registro.sal, codigo)):

            registro.usado = True

            db.commit()

            logger.info("✅ Código de %s confirmado (%s)", finalidade, mascarar(email))

            return

        registro.tentativas += 1

        restantes = CODIGO_EMAIL_MAX_TENTATIVAS - registro.tentativas

        if restantes <= 0:

            registro.usado = True

            db.commit()

            raise CodigoInvalidoError("Muitas tentativas erradas. Peça um novo código.")

        db.commit()

        raise CodigoInvalidoError(
            f"Código incorreto. Você tem mais {restantes} "
            f"tentativa{'s' if restantes > 1 else ''}."
        )

    finally:

        db.close()
