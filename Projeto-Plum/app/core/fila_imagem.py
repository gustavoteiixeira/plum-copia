"""
Fila de espera para a remoção de fundo (rembg).

Por que existe:
- o rembg usa muita CPU/RAM; só REMBG_MAX_CONCORRENCIA rodam ao mesmo tempo;
- quem espera aguarda AQUI, no event loop, sem ocupar uma thread do servidor
  (o FastAPI tem poucas threads; esperar dentro delas travaria outras rotas);
- a fila tem limite de tamanho e de tempo: com o servidor cheio, o usuário
  recebe na hora "tente novamente em instantes" em vez de esperar sem resposta.

A memória máxima do rembg fica previsível:
    REMBG_MAX_CONCORRENCIA × pico do modelo (ver a tabela do README, em Hospedagem)

Observação para o Google Cloud: cada instância/processo tem a sua própria fila.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from app.core.config import (
    FILA_MAX_ESPERA_S,
    FILA_MAX_TAMANHO,
    REMBG_MAX_CONCORRENCIA
)
from app.core.exceptions import ServidorOcupadoError
from app.services.metricas_service import medicao_atual


logger = logging.getLogger("plum.fila")


MENSAGEM_OCUPADO = (
    "Muitas pessoas enviando fotos agora. "
    "Tente novamente em instantes."
)


class FilaImagem:

    def __init__(self, vagas, max_tamanho, max_espera_s):

        self._semaforo = asyncio.Semaphore(vagas)
        self._max_tamanho = max_tamanho
        self._max_espera_s = max_espera_s

        # Quantos pedidos estão aguardando vaga agora
        self.esperando = 0


    @asynccontextmanager
    async def vaga(self):

        inicio = time.perf_counter()

        if not self._semaforo.locked():

            # Vaga livre: ocupa na hora (não suspende, sem disputa)
            await self._semaforo.acquire()

        else:

            if self.esperando >= self._max_tamanho:

                logger.warning("🚦 Fila cheia (%d esperando): pedido recusado", self.esperando)

                raise ServidorOcupadoError(MENSAGEM_OCUPADO)

            self.esperando += 1

            try:

                await asyncio.wait_for(self._semaforo.acquire(), timeout=self._max_espera_s)

            except (asyncio.TimeoutError, TimeoutError):

                logger.warning("🚦 Espera passou de %ss: pedido recusado", self._max_espera_s)

                raise ServidorOcupadoError(MENSAGEM_OCUPADO)

            finally:

                self.esperando -= 1

        medicao = medicao_atual()

        if medicao:
            medicao.tempo_fila_ms = round((time.perf_counter() - inicio) * 1000)

        try:
            yield
        finally:
            self._semaforo.release()


fila_imagem = FilaImagem(
    vagas=REMBG_MAX_CONCORRENCIA,
    max_tamanho=FILA_MAX_TAMANHO,
    max_espera_s=FILA_MAX_ESPERA_S
)
