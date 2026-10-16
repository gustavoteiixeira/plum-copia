"""
Limita tentativas ERRADAS de código de acesso por IP.

Protege contra alguém testar milhares de códigos PLU-XXXX até acertar
o de outra pessoa. Só os erros contam: quem usa o app normalmente
(código válido) nunca é bloqueado.

Limitações (aceitáveis por enquanto):
- o contador fica em memória: zera ao reiniciar o servidor e,
  com vários workers, cada um tem o seu;
- usuários atrás do mesmo IP (ex.: Wi-Fi da faculdade) dividem o contador.

Ao migrar para o Google Cloud com várias instâncias, mover o contador
para um armazenamento compartilhado (ex.: Memorystore/Redis ou Postgres).
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


MAX_ERROS = 10

JANELA_SEGUNDOS = 15 * 60


_erros = defaultdict(deque)

_lock = threading.Lock()


def _ip(request: Request):

    # Atrás de proxy/load balancer (ex.: Google Cloud), o IP real vem aqui
    encaminhado = request.headers.get("x-forwarded-for")

    if encaminhado:
        return encaminhado.split(",")[0].strip()

    return request.client.host if request.client else "desconhecido"


def _limpar_antigos(fila, agora):

    while fila and agora - fila[0] > JANELA_SEGUNDOS:
        fila.popleft()


def verificar_bloqueio(request: Request):
    """Chamar ANTES de validar o código. Lança 429 se o IP estourou o limite."""

    ip = _ip(request)

    agora = time.monotonic()

    with _lock:

        fila = _erros.get(ip)

        if not fila:
            return

        _limpar_antigos(fila, agora)

        if not fila:
            del _erros[ip]
            return

        if len(fila) >= MAX_ERROS:

            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas. Aguarde alguns minutos e tente novamente."
            )


def registrar_erro(request: Request):
    """Chamar quando o código informado não existir."""

    ip = _ip(request)

    agora = time.monotonic()

    with _lock:

        fila = _erros[ip]

        _limpar_antigos(fila, agora)

        fila.append(agora)


# ==========================
# Envios de e-mail por IP
# ==========================
# Impede que alguém use o app para disparar e-mails em massa
# (o intervalo por e-mail já existe; este limite é por IP).

MAX_ENVIOS_EMAIL = 10

JANELA_ENVIOS_SEGUNDOS = 60 * 60

_envios = defaultdict(deque)


def registrar_envio_email(request: Request):
    """Chamar ANTES de enviar um código. Lança 429 se o IP enviou demais."""

    ip = _ip(request)

    agora = time.monotonic()

    with _lock:

        fila = _envios[ip]

        while fila and agora - fila[0] > JANELA_ENVIOS_SEGUNDOS:
            fila.popleft()

        if len(fila) >= MAX_ENVIOS_EMAIL:

            raise HTTPException(
                status_code=429,
                detail="Muitos e-mails enviados. Aguarde e tente novamente mais tarde."
            )

        fila.append(agora)
