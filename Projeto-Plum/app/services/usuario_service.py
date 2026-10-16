import logging
import secrets
import string
from pathlib import Path

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import EmailEmUsoError

from app.models import Dispositivo, MetricaIA, Recomendacao, Usuario
from app.database import SessionLocal


logger = logging.getLogger("plum.usuario")

SAIDA_DIR = Path("saida")

PREVIEW_DIR = Path("temp_previews")


def _apagar_arquivos_usuario(urls_imagens, usuario_id):

    arquivos = [SAIDA_DIR / Path(url).name for url in urls_imagens]

    # Prévias pendentes também (o nome começa com o id do usuário)
    arquivos += list(PREVIEW_DIR.glob(f"{usuario_id}_*.png"))

    removidos = 0

    for caminho in arquivos:

        try:
            caminho.unlink(missing_ok=True)
            removidos += 1

        except OSError:
            logger.exception("Falha ao apagar %s", caminho)

    logger.info(
        "🗑️ Conta excluída | usuario_id=%s | %d arquivo(s) removido(s)",
        usuario_id,
        removidos
    )



def gerar_codigo_recuperacao():

    caracteres = string.ascii_uppercase + string.digits

    # secrets: gerador criptograficamente seguro (random é previsível)
    codigo = ''.join(
        secrets.choice(caracteres)
        for _ in range(10)
    )

    return f"PLU-{codigo}"



MENSAGEM_EMAIL_EM_USO = "Este e-mail já está em uso."


def _email_em_uso(db, email, exceto_id=None):

    consulta = db.query(Usuario.id).filter(Usuario.email == email)

    if exceto_id is not None:
        consulta = consulta.filter(Usuario.id != exceto_id)

    return consulta.first() is not None


def criar_usuario(dados):
    """Cria a conta com nome, e-mail e gênero (dados: UsuarioCreate)."""

    db = SessionLocal()

    try:

        if _email_em_uso(db, dados.email):
            raise EmailEmUsoError(MENSAGEM_EMAIL_EM_USO)

        while True:

            codigo = gerar_codigo_recuperacao()

            existe = db.query(Usuario).filter(
                Usuario.codigo_recuperacao == codigo
            ).first()

            if not existe:
                break

        usuario = Usuario(
            codigo_recuperacao=codigo,
            nome=dados.nome,
            email=dados.email,
            genero=dados.genero,
            criado_em=datetime.now()
        )

        db.add(usuario)

        try:
            db.commit()
        except IntegrityError:
            # Dois cadastros com o mesmo e-mail ao mesmo tempo
            db.rollback()
            raise EmailEmUsoError(MENSAGEM_EMAIL_EM_USO)

        db.refresh(usuario)

        return usuario

    finally:

        db.close()



def buscar_usuario_por_codigo(codigo):

    db = SessionLocal()

    try:

        usuario = db.query(Usuario).filter(
            Usuario.codigo_recuperacao == codigo
        ).first()

        return usuario


    finally:
        db.close()


def atualizar_perfil(codigo, dados):
    """Altera só os campos enviados (dados: UsuarioUpdate)."""

    db = SessionLocal()

    try:

        usuario = db.query(Usuario).filter(
            Usuario.codigo_recuperacao == codigo
        ).first()

        if usuario is None:
            return None

        for campo in ("nome", "genero"):

            valor = getattr(dados, campo)

            if valor is not None:
                setattr(usuario, campo, valor)

        db.commit()

        db.refresh(usuario)

        return usuario

    finally:
        db.close()


def email_em_uso(email):

    db = SessionLocal()

    try:
        return _email_em_uso(db, email)
    finally:
        db.close()


def buscar_usuario_por_email(email):

    db = SessionLocal()

    try:
        return db.query(Usuario).filter(Usuario.email == email).first()
    finally:
        db.close()


def registrar_dispositivo(codigo, info):
    """
    Registra o aparelho em que a conta está sendo usada.
    Mesmo usuário + mesma marca/modelo/sistema = mesmo aparelho
    (só atualiza o último acesso e as versões).
    Devolve False se o usuário não existir.
    """

    db = SessionLocal()

    try:

        usuario = db.query(Usuario).filter(
            Usuario.codigo_recuperacao == codigo
        ).first()

        if usuario is None:
            return False

        agora = datetime.now()

        existente = db.query(Dispositivo).filter(
            Dispositivo.usuario_id == usuario.id,
            Dispositivo.marca == info.marca,
            Dispositivo.modelo == info.modelo,
            Dispositivo.sistema == info.sistema,
            Dispositivo.celular_real == info.celular_real
        ).first()

        if existente:

            existente.ultimo_acesso = agora
            existente.versao_sistema = info.versao_sistema
            existente.versao_app = info.versao_app

        else:

            db.add(Dispositivo(
                usuario_id=usuario.id,
                **info.model_dump(),
                primeiro_acesso=agora,
                ultimo_acesso=agora
            ))

        db.commit()

        return True

    finally:

        db.close()

def deletar_usuario(codigo):

    db = SessionLocal()

    try:

        usuario = db.query(Usuario).filter(
            Usuario.codigo_recuperacao == codigo
        ).first()


        if usuario is None:
            return None


        # Guarda os arquivos antes de apagar (as peças somem em cascata)
        imagens = [
            url
            for roupa in usuario.roupas
            for url in (roupa.imagem_url, roupa.imagem_verso_url, roupa.miniatura_url)
            if url
        ]

        usuario_id = usuario.id


        db.delete(usuario)

        db.commit()


        # LGPD: após excluir a conta, remove também as fotos do usuário.
        # Falha ao apagar um arquivo não desfaz a exclusão (só registra no log).
        _apagar_arquivos_usuario(imagens, usuario_id)


        return True


    finally:

        db.close()


def estatisticas_usuario(codigo):
    """
    Números exibidos no Perfil. None se o usuário não existir.

    - pecas_analisadas: análises com sucesso (tabela metricas_ia; não diminui
      se a peça for excluída depois);
    - recomendacoes: pedidos que geraram look (tabela recomendacoes);
    - avaliadas / gostei / nao_gostei: avaliações dessas recomendações.
    """

    db = SessionLocal()

    try:

        usuario = db.query(Usuario).filter(
            Usuario.codigo_recuperacao == codigo
        ).first()

        if usuario is None:
            return None

        pecas_analisadas = db.query(func.count(MetricaIA.id)).filter(
            MetricaIA.usuario_id == usuario.id,
            MetricaIA.tipo == "analise_peca",
            MetricaIA.sucesso.is_(True)
        ).scalar()

        def contar_recomendacoes(*filtros):
            return db.query(func.count(Recomendacao.id)).filter(
                Recomendacao.usuario_id == usuario.id,
                *filtros
            ).scalar()

        gostei = contar_recomendacoes(Recomendacao.avaliacao.is_(True))

        nao_gostei = contar_recomendacoes(Recomendacao.avaliacao.is_(False))

        return {
            "pecas_analisadas": pecas_analisadas or 0,
            "recomendacoes": contar_recomendacoes() or 0,
            "avaliadas": (gostei or 0) + (nao_gostei or 0),
            "gostei": gostei or 0,
            "nao_gostei": nao_gostei or 0,
        }

    finally:

        db.close()
