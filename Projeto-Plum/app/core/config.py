import os
from pathlib import Path

from dotenv import load_dotenv


# Raiz do projeto (a pasta que contém "app/" e o arquivo ".env").
# config.py fica em app/core/, então a raiz está dois níveis acima.
RAIZ_PROJETO = Path(__file__).resolve().parents[2]


# Lê o .env da raiz do projeto, não importa de qual pasta o servidor foi iniciado.
#
# override=True: o valor do .env PREVALECE sobre uma variável de ambiente que já
# exista no sistema (ex.: uma GEMINI_API_KEY antiga guardada no Windows).
# Sem isso, a variável antiga ganhava do .env e a chave nova era ignorada.
#
# Se não houver .env (ex.: servidor que usa só variáveis de ambiente), nada muda:
# as variáveis do sistema continuam valendo.
load_dotenv(RAIZ_PROJETO / ".env", override=True)


def _env_bool(nome, padrao):

    valor = os.getenv(nome)

    if valor is None:
        return padrao

    return valor.strip().lower() in ("1", "true", "sim", "yes")


def _env_float(nome, padrao):

    valor = os.getenv(nome)

    if valor is None or not valor.strip():
        return padrao

    # Aceita vírgula decimal (1,5) além de ponto (1.5)
    return float(valor.strip().replace(",", "."))


# ==========================
# Gemini
# ==========================

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)


GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash-lite"
)


# Tempo máximo de espera por uma resposta do Gemini (milissegundos)
GEMINI_TIMEOUT_MS = int(os.getenv(
    "GEMINI_TIMEOUT_MS",
    "60000"
))


# ==========================
# Remoção de fundo (rembg)
# ==========================

# Modelo do rembg. Nos testes de desempenho (tabela do README, em Hospedagem),
# os leves (u2netp, silueta, u2net, isnet-general-use) usam 0,8 a 1,7 GB de RAM
# no pico; os BiRefNet e o bria-rmbg passam de 11 GB. O u2net (0,5 s e 1,1 GB)
# foi o que melhor recortou as peças com partes brancas nos testes visuais.
REMBG_MODEL = os.getenv(
    "REMBG_MODEL",
    "u2net"
)


# Refinamento de bordas (mais lento). Útil para tecidos felpudos.
REMBG_ALPHA_MATTING = _env_bool(
    "REMBG_ALPHA_MATTING",
    False
)


# Tratamento da máscara gerada pelo modelo (0-255):
# alpha abaixo do PISO vira fundo; acima do TETO vira peça sólida.
# Diminuir o TETO deixa sólidas áreas "em dúvida" (ex.: partes brancas).
REMBG_ALPHA_PISO = int(os.getenv("REMBG_ALPHA_PISO", "20"))

REMBG_ALPHA_TETO = int(os.getenv("REMBG_ALPHA_TETO", "100"))


# --- Precisão do recorte (ver app/services/mascara_service.py) ---

# Histerese: área "em dúvida" (valor >= BAIXO) CONECTADA a uma região segura
# (valor >= TETO) vira sólida. Recupera partes brancas/claras que o modelo
# hesita em marcar. RAIO_PCT limita o quanto a peça pode "crescer" para fora
# (% do menor lado da foto), para não puxar sombras.
REMBG_HISTERESE = _env_bool("REMBG_HISTERESE", True)

REMBG_HISTERESE_BAIXO = int(os.getenv("REMBG_HISTERESE_BAIXO", "12"))

REMBG_HISTERESE_RAIO_PCT = _env_float("REMBG_HISTERESE_RAIO_PCT", 3.0)


# Fecha entalhes e lacunas estreitas na borda da peça (% do menor lado).
# 0 desliga. Espaços maiores que ~2x esse valor (ex.: entre as pernas de uma
# calça) são mantidos.
REMBG_FECHAMENTO_PCT = _env_float("REMBG_FECHAMENTO_PCT", 1.5)


# Pedaços pequenos soltos PERTO do corpo principal (cadarço, etiqueta, alça)
# são mantidos; os distantes são descartados (% do menor lado). 0 = regra antiga.
REMBG_ILHAS_PERTO_PCT = _env_float("REMBG_ILHAS_PERTO_PCT", 4.0)


# Experimentos (desligados por padrão):
# TTA: roda o modelo na foto e na espelhada e faz a média (dobra o tempo do modelo)
REMBG_TTA = _env_bool("REMBG_TTA", False)

# Completa a foto para um quadrado antes do modelo (evita esticar a imagem)
REMBG_PAD_QUADRADO = _env_bool("REMBG_PAD_QUADRADO", False)


# Buracos internos até essa fração da área da peça são preenchidos.
# Buracos maiores são mantidos (podem ser reais, ex.: alça de bolsa).
REMBG_MAX_BURACO = float(os.getenv("REMBG_MAX_BURACO", "0.2"))


# Salva as etapas (original, máscaras, final) em debug_rembg/
REMBG_DEBUG = _env_bool("REMBG_DEBUG", False)


# Quantas remoções de fundo podem rodar ao mesmo tempo.
# O rembg usa muita CPU/memória; mais que o nº de núcleos não ajuda.
REMBG_MAX_CONCORRENCIA = int(os.getenv(
    "REMBG_MAX_CONCORRENCIA",
    "1"
))


# Núcleos que CADA remoção de fundo pode usar (vazio = todos).
# No servidor, use o número de vCPUs da máquina.
REMBG_THREADS = os.getenv("REMBG_THREADS", "").strip() or None


# Fila de espera da remoção de fundo (app/core/fila_imagem.py):
# até quantos pedidos podem aguardar vaga e por quanto tempo (segundos).
FILA_MAX_TAMANHO = int(os.getenv("FILA_MAX_TAMANHO", "10"))

FILA_MAX_ESPERA_S = float(os.getenv("FILA_MAX_ESPERA_S", "30"))


# ==========================
# Imagens
# ==========================

# Tamanho máximo do upload aceito (MB)
UPLOAD_MAX_MB = int(os.getenv(
    "UPLOAD_MAX_MB",
    "15"
))


# Maior lado da foto antes de remover o fundo (px).
# Fotos de celular são enormes; reduzir acelera sem perder qualidade.
IMAGEM_LADO_MAX_ENTRADA = int(os.getenv(
    "IMAGEM_LADO_MAX_ENTRADA",
    "1500"
))


# Por quanto tempo uma pré-visualização (recorte aguardando aprovação)
# fica guardada antes de ser apagada (minutos)
PREVIEW_TTL_MIN = int(os.getenv(
    "PREVIEW_TTL_MIN",
    "30"
))


# Tamanho final da imagem salva (quadrada, px)
IMAGEM_LADO_SAIDA = int(os.getenv(
    "IMAGEM_LADO_SAIDA",
    "1024"
))


# ==========================
# E-mail (verificação e recuperação de conta)
# ==========================

# Conta Gmail do app e a "senha de app" de 16 letras (NUNCA versionar)
EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "").strip()

EMAIL_SENHA_APP = os.getenv("EMAIL_SENHA_APP", "").replace(" ", "")

EMAIL_NOME = os.getenv("EMAIL_NOME", "PLUM")

EMAIL_SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com")

EMAIL_SMTP_PORTA = int(os.getenv("EMAIL_SMTP_PORTA", "587"))

# Código de verificação: validade (min), tentativas e intervalo entre envios (s)
CODIGO_EMAIL_VALIDADE_MIN = int(os.getenv("CODIGO_EMAIL_VALIDADE_MIN", "10"))

CODIGO_EMAIL_MAX_TENTATIVAS = int(os.getenv("CODIGO_EMAIL_MAX_TENTATIVAS", "5"))

CODIGO_EMAIL_INTERVALO_S = int(os.getenv("CODIGO_EMAIL_INTERVALO_S", "60"))


# ==========================
# Banco / servidor
# ==========================

DATABASE_URL = os.getenv(
    "DATABASE_URL"
)


SERVER_IP = os.getenv(
    "SERVER_IP"
)


APP_PORT = os.getenv(
    "APP_PORT",
    "8000"
)


APP_URL = f"http://{SERVER_IP}:{APP_PORT}"
