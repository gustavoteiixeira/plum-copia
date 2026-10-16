"""
Tratamento da máscara (alpha) da peça.

Só depende de numpy/scipy/Pillow (não carrega o rembg), então pode ser
testado e comparado sem o modelo.

Entrada: máscara BRUTA do modelo (uint8, 0-255, mesmo tamanho da foto).
Saída:   alpha final (uint8), para ser aplicado sobre a foto original.

Etapas (tratar_mascara):

1. histerese       - área "em dúvida" CONECTADA a uma região segura vira sólida
                     (recupera partes brancas/claras que o modelo hesita em marcar);
2. endurecer       - abaixo do PISO vira fundo, acima do TETO vira sólido;
3. fechar lacunas  - fecha entalhes estreitos na borda da peça;
4. ilhas           - descarta pedaços soltos, mas mantém detalhes pequenos
                     PERTO do corpo principal (cadarço, etiqueta, alça);
5. buracos         - preenche buracos internos pequenos;
6. suavizar borda  - leve desfoque, para a borda não ficar serrilhada.

As operações de distância/fechamento rodam numa escala reduzida
(LADO_TRABALHO) para serem rápidas; os resultados voltam ao tamanho original.
"""

from dataclasses import dataclass

import numpy as np
from PIL import Image
from scipy import ndimage

from app.core.config import (
    REMBG_ALPHA_MATTING,
    REMBG_ALPHA_PISO,
    REMBG_ALPHA_TETO,
    REMBG_FECHAMENTO_PCT,
    REMBG_HISTERESE,
    REMBG_HISTERESE_BAIXO,
    REMBG_HISTERESE_RAIO_PCT,
    REMBG_ILHAS_PERTO_PCT,
    REMBG_MAX_BURACO,
    REMBG_PAD_QUADRADO,
    REMBG_TTA
)


# Pixels com alpha abaixo disso são considerados fundo
LIMIAR_ALPHA = 25

# Partes soltas menores que essa fração da maior parte são descartadas
# (5% preserva, por exemplo, os dois pés de um par de tênis)...
FRACAO_MIN_ILHA = 0.05

# ...exceto as maiores que essa fração que estejam PERTO do corpo principal.
FRACAO_MIN_ILHA_PERTO = 0.002

# Maior lado (px) em que as operações de distância/fechamento são calculadas
LADO_TRABALHO = 768


@dataclass(frozen=True)
class ParametrosRecorte:
    """Todos os ajustes do recorte num lugar só."""

    # Endurecimento
    alpha_piso: int = 20
    alpha_teto: int = 100

    # Histerese
    histerese: bool = True
    histerese_baixo: int = 12
    histerese_raio_pct: float = 3.0
    histerese_envelope_pct: float = 5.0

    # Fechamento de lacunas, ilhas e buracos (% do menor lado da foto)
    fechamento_pct: float = 1.5
    ilhas_perto_pct: float = 4.0
    max_buraco: float = 0.2

    # Desfoque (sigma, em px) aplicado no fim. 0 = desligado
    suavizar_borda: float = 1.0

    # Inferência do modelo (usados em imagem_service.gerar_mascara)
    tta: bool = False
    pad_quadrado: bool = False
    alpha_matting: bool = False

    @property
    def teto(self):

        return max(self.alpha_teto, self.alpha_piso + 1)


def parametros_padrao():
    """Parâmetros vindos do .env / config.py."""

    return ParametrosRecorte(
        alpha_piso=REMBG_ALPHA_PISO,
        alpha_teto=REMBG_ALPHA_TETO,
        histerese=REMBG_HISTERESE,
        histerese_baixo=REMBG_HISTERESE_BAIXO,
        histerese_raio_pct=REMBG_HISTERESE_RAIO_PCT,
        fechamento_pct=REMBG_FECHAMENTO_PCT,
        ilhas_perto_pct=REMBG_ILHAS_PERTO_PCT,
        max_buraco=REMBG_MAX_BURACO,
        tta=REMBG_TTA,
        pad_quadrado=REMBG_PAD_QUADRADO,
        alpha_matting=REMBG_ALPHA_MATTING
    )


# ==========================
# Utilidades (escala reduzida)
# ==========================

def _raio_px(shape, pct):
    """Raio em pixels a partir de uma porcentagem do menor lado."""

    return max(1.0, min(shape) * pct / 100.0)


def _fator(shape):
    """Quanto reduzir a imagem para calcular distâncias (1 = não reduz)."""

    return max(1.0, max(shape) / LADO_TRABALHO)


def _redimensionar_bool(mascara, tamanho):
    """Redimensiona uma máscara booleana (bilinear + limiar). tamanho = (largura, altura)."""

    imagem = Image.fromarray(mascara.astype(np.uint8) * 255)

    imagem = imagem.resize(tamanho, Image.Resampling.BILINEAR)

    return np.asarray(imagem) > 127


def _perto_de(origem, raio_px):
    """Pixels a até `raio_px` de qualquer pixel True de `origem`."""

    if not origem.any():
        return np.zeros_like(origem, dtype=bool)

    altura, largura = origem.shape

    fator = _fator(origem.shape)

    if fator > 1.0:

        tamanho = (max(1, round(largura / fator)), max(1, round(altura / fator)))

        pequena = _redimensionar_bool(origem, tamanho)

        perto = ndimage.distance_transform_edt(~pequena) <= raio_px / fator

        return _redimensionar_bool(perto, (largura, altura))

    return ndimage.distance_transform_edt(~origem) <= raio_px


def _fechar(solido, raio_px, so_novo=False):
    """
    Fechamento morfológico (dilata e depois erode) com disco de `raio_px`.

    so_novo=False -> devolve a máscara fechada (inclui a original);
    so_novo=True  -> devolve só os pixels ADICIONADOS (as lacunas fechadas).

    Usa transformada de distância (exata e rápida) em vez de elemento
    estruturante grande, que seria lento em fotos grandes.
    """

    if not solido.any():
        return np.zeros_like(solido, dtype=bool)

    altura, largura = solido.shape

    fator = _fator(solido.shape)

    if fator > 1.0:

        tamanho = (max(1, round(largura / fator)), max(1, round(altura / fator)))

        pequena = _redimensionar_bool(solido, tamanho)

    else:

        pequena = solido

    raio = max(1, round(raio_px / fator))

    # Margem para o fechamento não "comer" peças que encostam na borda da foto
    margem = raio + 2

    preenchida = np.pad(pequena, margem, mode="constant", constant_values=False)

    dilatada = ndimage.distance_transform_edt(~preenchida) <= raio

    erodida = ndimage.distance_transform_edt(dilatada) > raio

    fechada = erodida[margem:-margem, margem:-margem] | pequena

    resultado = (fechada & ~pequena) if so_novo else fechada

    if fator > 1.0:

        resultado = _redimensionar_bool(resultado, (largura, altura))

    return (resultado & ~solido) if so_novo else (resultado | solido)


def _tabela(quantidade, marcados):
    """Tabela de consulta: indice do rótulo -> True/False (rótulo 0 = fundo = False)."""

    tabela = np.zeros(quantidade + 1, dtype=bool)

    tabela[1:] = marcados

    return tabela


# ==========================
# Etapas
# ==========================

def _histerese(mascara, p):
    """
    Promove a sólido as áreas "em dúvida" (valor >= BAIXO) que estão
    CONECTADAS a uma região segura (valor >= TETO) e que:
      - estão DENTRO do contorno da peça (buracos e vãos estreitos), ou
      - estão a no máximo `histerese_raio_pct` de distância da região segura.

    Sombras longe da peça e fragmentos desconectados não são promovidos.
    """

    teto = p.teto

    sementes = mascara >= teto

    if not sementes.any():
        return mascara

    candidatos = mascara >= p.histerese_baixo

    rotulos, quantidade = ndimage.label(candidatos)

    com_semente = np.unique(rotulos[sementes])

    com_semente = com_semente[com_semente > 0]

    conectado = _tabela(quantidade, False)

    conectado[com_semente] = True

    conectados = conectado[rotulos]

    # Contorno da peça: fecha vãos estreitos e preenche o interior
    contorno = ndimage.binary_fill_holes(
        _fechar(sementes, _raio_px(mascara.shape, p.histerese_envelope_pct))
    )

    perto = _perto_de(sementes, _raio_px(mascara.shape, p.histerese_raio_pct))

    promover = conectados & (contorno | perto) & ~sementes

    if not promover.any():
        return mascara

    resultado = mascara.copy()

    resultado[promover] = teto

    return resultado


def _endurecer_alpha(alpha, p):
    """
    Abaixo do PISO vira fundo, acima do TETO vira sólido; só a faixa
    entre os dois continua suave (bordas).
    """

    a = (alpha.astype(np.float32) - p.alpha_piso) / (p.teto - p.alpha_piso)

    return (np.clip(a, 0, 1) * 255).astype(np.uint8)


def _fechar_lacunas(alpha, p):

    solido = alpha > LIMIAR_ALPHA

    novo = _fechar(solido, _raio_px(alpha.shape, p.fechamento_pct), so_novo=True)

    if not novo.any():
        return alpha

    resultado = alpha.copy()

    resultado[novo] = 255

    return resultado


def _remover_ilhas(alpha, p):
    """
    Descarta pedaços soltos menores que FRACAO_MIN_ILHA da maior parte,
    mas mantém os de pelo menos FRACAO_MIN_ILHA_PERTO que estão PERTO
    do corpo principal (detalhes como cadarço, etiqueta ou alça).
    """

    mascara = alpha > LIMIAR_ALPHA

    rotulos, quantidade = ndimage.label(mascara)

    if quantidade <= 1:
        return alpha

    ids = np.arange(1, quantidade + 1)

    areas = ndimage.sum(mascara, rotulos, index=ids)

    maior = areas.max()

    manter = areas >= maior * FRACAO_MIN_ILHA

    if p.ilhas_perto_pct > 0:

        candidatas = (~manter) & (areas >= maior * FRACAO_MIN_ILHA_PERTO)

        if candidatas.any():

            principais = _tabela(quantidade, manter)[rotulos]

            proximo = _perto_de(principais, _raio_px(alpha.shape, p.ilhas_perto_pct))

            encostam = ndimage.maximum(proximo.astype(np.uint8), rotulos, index=ids) > 0

            manter = manter | (candidatas & encostam)

    mantidos = _tabela(quantidade, manter)[rotulos]

    # Dilata um pouco para não cortar a borda suave (semi-transparente)
    mantidos = ndimage.binary_dilation(mantidos, iterations=3)

    return np.where(mantidos, alpha, 0).astype(np.uint8)


def _preencher_buracos(alpha, p):
    """
    Preenche buracos INTERNOS da peça (regiões cercadas pela peça que o
    modelo marcou como fundo). Buracos grandes são mantidos, pois podem
    ser reais (ex.: alça de bolsa).
    """

    solido = alpha > LIMIAR_ALPHA

    preenchido = ndimage.binary_fill_holes(solido)

    buracos = preenchido & ~solido

    rotulos, quantidade = ndimage.label(buracos)

    if quantidade == 0:
        return alpha

    areas = ndimage.sum(buracos, rotulos, index=np.arange(1, quantidade + 1))

    limite = preenchido.sum() * p.max_buraco

    encher = _tabela(quantidade, areas <= limite)[rotulos]

    if not encher.any():
        return alpha

    # Inclui a borda suave do buraco
    encher = ndimage.binary_dilation(encher, iterations=2) & preenchido

    resultado = alpha.copy()

    resultado[encher] = 255

    return resultado


def _suavizar_borda(alpha, sigma):

    if sigma <= 0:
        return alpha

    suave = ndimage.gaussian_filter(alpha.astype(np.float32), sigma)

    # Descarta o "rastro" quase invisível fora da peça
    suave[suave < 8] = 0

    # O maior entre o alpha e o desfocado: acrescenta só um halo suave por
    # fora e nunca enfraquece detalhes finos (ex.: cadarço de 2 px)
    return np.maximum(alpha, np.clip(suave, 0, 255).astype(np.uint8))


# ==========================
# Pipeline
# ==========================

def tratar_mascara(mascara, p=None):
    """Máscara bruta do modelo -> alpha final tratado."""

    p = p or parametros_padrao()

    alpha = mascara

    if p.histerese:
        alpha = _histerese(alpha, p)

    alpha = _endurecer_alpha(alpha, p)

    if p.fechamento_pct > 0:
        alpha = _fechar_lacunas(alpha, p)

    alpha = _remover_ilhas(alpha, p)

    alpha = _preencher_buracos(alpha, p)

    return _suavizar_borda(alpha, p.suavizar_borda)
