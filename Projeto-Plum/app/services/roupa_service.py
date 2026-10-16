from app.database import SessionLocal
from app.models import Roupa
from pathlib import Path
from app.services.usuario_service import buscar_usuario_por_codigo

saida_dir = Path("saida")


def _apagar_imagens(roupa):
    """Remove do disco a frente, o verso e a miniatura."""

    for url in (roupa.imagem_url, roupa.imagem_verso_url, roupa.miniatura_url):

        if url:

            caminho = saida_dir / Path(url).name

            caminho.unlink(missing_ok=True)

def listar_roupas_usuario(codigo):

    usuario = buscar_usuario_por_codigo(
        codigo
    )

    if usuario is None:

        return []

    db = SessionLocal()

    try:

        roupas = db.query(Roupa).filter(
            Roupa.usuario_id == usuario.id
        ).all()

        return roupas

    finally:

        db.close()
        
def buscar_roupa(id):

    db = SessionLocal()

    roupa = db.query(Roupa).filter(
        Roupa.id == id
    ).first()

    db.close()

    return roupa

def buscar_roupa_usuario(id, codigo_usuario):

    usuario = buscar_usuario_por_codigo(
        codigo_usuario
    )

    if usuario is None:
        return None

    db = SessionLocal()

    try:

        roupa = db.query(Roupa).filter(
            Roupa.id == id,
            Roupa.usuario_id == usuario.id
        ).first()

        return roupa

    finally:

        db.close()

def remover_roupa(db, id):

    roupa = db.query(Roupa).filter(
        Roupa.id == id
    ).first()


    if roupa is None:
        return False


    # ==========================
    # Remove imagem física
    # ==========================

    _apagar_imagens(roupa)




    # ==========================
    # Remove banco
    # ==========================

    db.delete(roupa)

    db.commit()


    return True

def remover_roupa_usuario(db, id, codigo_usuario):

    usuario = buscar_usuario_por_codigo(
        codigo_usuario
    )

    if usuario is None:
        return False

    roupa = db.query(Roupa).filter(
        Roupa.id == id,
        Roupa.usuario_id == usuario.id
    ).first()

    if roupa is None:
        return False

    _apagar_imagens(roupa)

    db.delete(roupa)

    db.commit()

    return True