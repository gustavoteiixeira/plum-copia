import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.exceptions import ErroAplicacao
from app.routers import (
    roupa_router,
    recomendacao_router,
    background_router,
    usuario_router
)
from app.services.imagem_service import carregar_modelo
from app.services.preview_service import limpar_previews_expiradas


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger("plum")


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Carrega o modelo do rembg ao subir o servidor,
    # para a primeira análise não demorar
    await run_in_threadpool(carregar_modelo)

    # Remove prévias abandonadas de execuções anteriores
    await run_in_threadpool(limpar_previews_expiradas)

    yield


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ErroAplicacao)
async def tratar_erro_aplicacao(request: Request, erro: ErroAplicacao):

    logger.warning(
        "⚠️ %s %s -> %s: %s",
        request.method,
        request.url.path,
        erro.status_code,
        erro.mensagem
    )

    return JSONResponse(
        status_code=erro.status_code,
        content={"detail": erro.mensagem}
    )


@app.exception_handler(RequestValidationError)
async def tratar_validacao(request: Request, erro: RequestValidationError):
    """
    Erro de validação (422) com mensagem legível para o app.
    Mensagens nossas (ValueError nos schemas) vêm como "Value error, ...".
    """

    erros = erro.errors()

    mensagem = "Dados inválidos. Confira os campos e tente novamente."

    if erros and erros[0].get("type") == "value_error":
        mensagem = str(erros[0].get("msg", mensagem)).removeprefix("Value error, ")

    # No log do servidor vai o detalhe (campo e motivo); o app recebe só a mensagem
    detalhes = "; ".join(
        f"{'.'.join(str(parte) for parte in e.get('loc', []))}: {e.get('msg')} (recebido: {str(e.get('input'))[:80]!r})"
        for e in erros
    )

    logger.warning("⚠️ %s %s -> 422: %s | %s", request.method, request.url.path, mensagem, detalhes)

    return JSONResponse(
        status_code=422,
        content={"detail": mensagem}
    )


app.mount(
    "/saida",
    StaticFiles(directory="saida"),
    name="saida"
)


# Recortes aguardando aprovação do usuário
app.mount(
    "/previews",
    StaticFiles(directory="temp_previews"),
    name="previews"
)


app.include_router(usuario_router.router)
app.include_router(background_router.router)
app.include_router(roupa_router.router)
app.include_router(recomendacao_router.router)
