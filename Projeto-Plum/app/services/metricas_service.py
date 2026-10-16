"""
Métricas de uso da IA (para o TCC).

Uma linha em `metricas_ia` por operação: prévia (rembg), análise de peça
(Gemini) e recomendação (Gemini). Falhas também são registradas.

Uso:

    with medir("recomendacao", usuario_id=7):
        ...  # chamadas ao Gemini/rembg preenchem a medição sozinhas

Por dentro, a medição atual fica numa ContextVar. O FastAPI copia o contexto
para as threads (run_in_threadpool), então gemini_client e imagem_service
encontram a medição sem precisar receber parâmetro.

Gravar a métrica NUNCA quebra o fluxo do usuário: erros vão só para o log.
"""

import logging
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime

from app.database import SessionLocal
from app.models import MetricaIA


logger = logging.getLogger("plum.metricas")


_medicao_atual = ContextVar("medicao_atual", default=None)


@dataclass
class Medicao:

    tipo: str
    usuario_id: int | None = None

    sucesso: bool = False
    erro: str | None = None

    # Só recomendação: look | resposta | fora_do_tema
    tipo_resposta: str | None = None

    # Só recomendação com look: igual a uma combinação do histórico?
    look_repetido: bool | None = None

    # Só análise
    com_verso: bool | None = None

    modelo: str | None = None

    # Tempo de tratamento da imagem (pré + rembg + pós), somando frente e verso
    # Espera na fila da remoção de fundo (prévia / remove-bg)
    tempo_fila_ms: int | None = None

    tempo_rembg_ms: int | None = None
    tempo_gemini_ms: int | None = None
    tempo_total_ms: int | None = None

    tokens_entrada: int | None = None
    tokens_cache: int | None = None
    tokens_saida: int | None = None

    _inicio: float = field(default_factory=time.perf_counter, repr=False)


    def somar_imagem(self, segundos, modelo):

        self.tempo_rembg_ms = (self.tempo_rembg_ms or 0) + round(segundos * 1000)

        # O modelo do Gemini, se houver, prevalece
        if self.modelo is None:
            self.modelo = modelo


    def somar_gemini(self, segundos, modelo, uso=None):

        self.tempo_gemini_ms = (self.tempo_gemini_ms or 0) + round(segundos * 1000)

        self.modelo = modelo

        if uso is None:
            return

        for campo, atributo in (
            ("tokens_entrada", "prompt_token_count"),
            ("tokens_cache", "cached_content_token_count"),
            ("tokens_saida", "candidates_token_count"),
        ):
            valor = getattr(uso, atributo, None) or 0
            setattr(self, campo, (getattr(self, campo) or 0) + valor)


def medicao_atual():
    """Medição em andamento, ou None se o fluxo não estiver sendo medido."""

    return _medicao_atual.get()


@contextmanager
def medir(tipo, usuario_id=None, **dados):

    medicao = Medicao(tipo=tipo, usuario_id=usuario_id, **dados)

    token = _medicao_atual.set(medicao)

    try:

        yield medicao

        medicao.sucesso = True

    except Exception as erro:

        medicao.erro = type(erro).__name__

        raise

    finally:

        _medicao_atual.reset(token)

        medicao.tempo_total_ms = round((time.perf_counter() - medicao._inicio) * 1000)

        registrar(medicao)


def executar_com(medicao, funcao, *args):
    """
    Roda `funcao` com `medicao` como medição atual.
    Usado dentro de run_in_threadpool, para a thread enxergar a medição
    sem depender de o contexto ser copiado automaticamente.
    """

    token = _medicao_atual.set(medicao)

    try:
        return funcao(*args)
    finally:
        _medicao_atual.reset(token)


def registrar(medicao):

    db = SessionLocal()

    try:

        db.add(MetricaIA(
            usuario_id=medicao.usuario_id,
            tipo=medicao.tipo,
            sucesso=medicao.sucesso,
            erro=medicao.erro,
            tipo_resposta=medicao.tipo_resposta,
            com_verso=medicao.com_verso,
            look_repetido=medicao.look_repetido,
            modelo=medicao.modelo,
            tempo_fila_ms=medicao.tempo_fila_ms,
            tempo_rembg_ms=medicao.tempo_rembg_ms,
            tempo_gemini_ms=medicao.tempo_gemini_ms,
            tempo_total_ms=medicao.tempo_total_ms,
            tokens_entrada=medicao.tokens_entrada,
            tokens_cache=medicao.tokens_cache,
            tokens_saida=medicao.tokens_saida,
            criado_em=datetime.now()
        ))

        db.commit()

    except Exception:

        db.rollback()

        logger.exception("Falha ao registrar métrica (%s)", medicao.tipo)

    finally:

        db.close()
