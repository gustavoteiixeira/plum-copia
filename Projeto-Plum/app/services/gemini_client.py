"""
Cliente Gemini único, compartilhado por toda a aplicação.

Centraliza:
- criação do client (uma vez só);
- timeout;
- logs de sucesso/falha com tempo e tokens consumidos;
- conversão de qualquer erro da API em FalhaIAError (mensagem amigável).
"""

import logging
import time

import httpx
from google import genai
from google.genai import errors, types

from app.core.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_MS
)
from app.core.exceptions import FalhaIAError
from app.services.metricas_service import medicao_atual


logger = logging.getLogger("plum.gemini")


_client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=types.HttpOptions(
        timeout=GEMINI_TIMEOUT_MS
    )
)


def gerar_conteudo(operacao, contents, config, mensagem_erro):
    """
    Chama o Gemini e devolve a resposta.

    operacao: nome curto usado nos logs (ex.: "analise_peca").
    mensagem_erro: texto mostrado ao usuário se a chamada falhar.
    """

    inicio = time.perf_counter()

    medicao = medicao_atual()

    try:

        resposta = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config
        )

    except errors.APIError as erro:

        logger.error(
            "❌ %s falhou | modelo=%s | código=%s | status=%s | %.2fs | %s",
            operacao,
            GEMINI_MODEL,
            erro.code,
            erro.status,
            time.perf_counter() - inicio,
            erro.message
        )

        if medicao:
            medicao.somar_gemini(time.perf_counter() - inicio, GEMINI_MODEL)

        raise FalhaIAError(mensagem_erro) from erro

    except httpx.HTTPError as erro:

        # Timeout, falha de conexão, DNS...
        logger.error(
            "❌ %s falhou | modelo=%s | erro de rede: %s | %.2fs",
            operacao,
            GEMINI_MODEL,
            type(erro).__name__,
            time.perf_counter() - inicio
        )

        if medicao:
            medicao.somar_gemini(time.perf_counter() - inicio, GEMINI_MODEL)

        raise FalhaIAError(mensagem_erro) from erro


    uso = resposta.usage_metadata

    if medicao:
        medicao.somar_gemini(time.perf_counter() - inicio, GEMINI_MODEL, uso)

    entrada = getattr(uso, "prompt_token_count", None) or 0

    # Parte da entrada que veio do cache implícito (cobrada com desconto)
    em_cache = getattr(uso, "cached_content_token_count", None) or 0

    logger.info(
        "✅ %s concluída | modelo=%s | %.2fs | tokens entrada=%s em cache=%s (%d%%) saída=%s total=%s",
        operacao,
        GEMINI_MODEL,
        time.perf_counter() - inicio,
        entrada,
        em_cache,
        round(100 * em_cache / entrada) if entrada else 0,
        getattr(uso, "candidates_token_count", None),
        getattr(uso, "total_token_count", None)
    )

    return resposta
