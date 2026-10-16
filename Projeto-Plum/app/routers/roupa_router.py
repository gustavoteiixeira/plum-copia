from fastapi import APIRouter, HTTPException
from app.schemas.roupa_schema import RoupaResponse
from app.database import SessionLocal
from app.services.roupa_service import (
    buscar_roupa_usuario,
    remover_roupa_usuario,
    listar_roupas_usuario
)

router = APIRouter()

@router.get(
    "/roupa/{id}",
    response_model=RoupaResponse
)
def get_roupa(
    id: int,
    codigo_usuario: str
):

    roupa = buscar_roupa_usuario(
        id,
        codigo_usuario
    )

    if roupa is None:
        raise HTTPException(
            status_code=404,
            detail="Roupa não encontrada"
        )

    return roupa


# ==========================
# Lista roupas do usuário
# ==========================

@router.get(
    "/roupas/usuario/{codigo}",
    response_model=list[RoupaResponse]
)
def get_roupas_usuario(codigo: str):

    return listar_roupas_usuario(
        codigo
    )

@router.delete("/roupa/{id}")
def delete_roupa(
    id: int,
    codigo_usuario: str
):

    db = SessionLocal()

    try:

        removida = remover_roupa_usuario(
            db,
            id,
            codigo_usuario
        )

        if not removida:
            raise HTTPException(
                status_code=404,
                detail="Roupa não encontrada"
            )


        return {
            "mensagem": "Roupa removida com sucesso"
        }


    finally:
        db.close()