from fastapi import APIRouter, HTTPException, Request

from app.core.limite_tentativas import registrar_erro, verificar_bloqueio
from app.schemas.recomendacao_schema import OutfitResponse
from pydantic import BaseModel
from app.models import Recomendacao
from app.services.recomendacao_service import (
    listar_outfits,
    gerar_recomendacao,
    salvar_recomendacao,
    buscar_historico_recomendacoes
)
from app.services.usuario_service import buscar_usuario_por_codigo
from app.core.urls import url_publica
from app.services.metricas_service import medir
from datetime import datetime

from app.database import SessionLocal
from app.models import Roupa


router = APIRouter()


# ==========================
# RECOMENDAÇÃO
# ==========================

class RecomendacaoRequest(BaseModel):
    prompt: str
    codigo_usuario: str



@router.post("/recomendar-look")
def recomendar_look(request: RecomendacaoRequest):

    db = SessionLocal()

    try:

        usuario = buscar_usuario_por_codigo(
            request.codigo_usuario
        )


        if usuario is None:

            raise HTTPException(
                status_code=404,
                detail="Usuário não encontrado"
            )


        roupas = db.query(Roupa).filter(
            Roupa.usuario_id == usuario.id
        ).all()

        if not roupas:

            return {
                "look": None,
                "justificativa": "Seu guarda-roupa ainda não possui peças cadastradas."
            }

        roupas_json = []


        for roupa in roupas:

            roupas_json.append({

                "id": roupa.id,
                "nome": roupa.nome,
                "tipo": roupa.tipo,
                "categoria": roupa.categoria,
                "cores": roupa.cores,
                "paleta_cores": roupa.paleta_cores,
                "estilo": roupa.estilo,
                "formalidade": roupa.formalidade,
                "tecido": roupa.tecido,
                "ocasioes": roupa.ocasioes,
                "estacoes": roupa.estacoes,
                "descricao": roupa.descricao,
                "pode_sobrepor": bool(roupa.pode_sobrepor),

                # Não vão para o Gemini; usados para completar o look
                "imagem": url_publica(roupa.imagem_url),
                "miniatura": url_publica(
                    roupa.miniatura_url or roupa.imagem_url
                )

            })

        historico = buscar_historico_recomendacoes(
            db,
            usuario.id
        )

        # Mede toda mensagem do chat (com ou sem look, inclusive falhas).
        # O tipo_resposta é preenchido por gerar_recomendacao.
        with medir("recomendacao", usuario.id):

            resultado = gerar_recomendacao(
                request.prompt,
                roupas_json,
                historico
            )


        if resultado.look is not None:

            registro = salvar_recomendacao(
                db,
                usuario.id,
                request.prompt,
                resultado
            )

            resultado.id_recomendacao = registro.id


        return resultado
 
    finally:

        db.close()


# ==========================
# AVALIAÇÃO DA RECOMENDAÇÃO
# ==========================

class AvaliacaoRequest(BaseModel):

    avaliacao: int

    codigo_usuario: str

    # True quando o app marca 👎 porque o usuário saiu sem avaliar
    automatica: bool = False



@router.put("/recomendacao/{id}/avaliar")
def avaliar_recomendacao(
    id: int,
    request: AvaliacaoRequest
):

    usuario = buscar_usuario_por_codigo(
        request.codigo_usuario
    )

    if usuario is None:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )


    db = SessionLocal()

    try:

        # Só o dono da recomendação pode avaliá-la.
        # Se for de outro usuário, responde 404 (não revela que existe).
        recomendacao = (
            db.query(Recomendacao)
            .filter(
                Recomendacao.id == id,
                Recomendacao.usuario_id == usuario.id
            )
            .first()
        )


        if recomendacao is None:

            raise HTTPException(
                status_code=404,
                detail="Recomendação não encontrada"
            )


        if request.avaliacao not in [0,1]:

            raise HTTPException(
                status_code=400,
                detail="Avaliação inválida"
            )


        recomendacao.avaliacao = request.avaliacao

        # Hora do 👍/👎: marca o fim da decisão na sessão (métricas)
        recomendacao.avaliado_em = datetime.now()

        recomendacao.avaliacao_automatica = request.automatica


        db.commit()

        db.refresh(recomendacao)


        return {
            "mensagem":
            "Avaliação registrada com sucesso"
        }


    finally:

        db.close()


# ==========================
# OUTFITS (looks curtidos)
# ==========================

@router.get(
    "/outfits",
    response_model=list[OutfitResponse]
)
def get_outfits(codigo_usuario: str, request: Request):

    # Mesmo limitador do login: a rota não pode servir para adivinhar códigos
    verificar_bloqueio(request)

    usuario = buscar_usuario_por_codigo(codigo_usuario)

    if usuario is None:

        registrar_erro(request)

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado"
        )

    db = SessionLocal()

    try:
        return listar_outfits(db, usuario.id)
    finally:
        db.close()
