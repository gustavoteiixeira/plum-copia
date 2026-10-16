"""
Valores fixos dos campos da peça.

- As listas abaixo viram "enum" no schema do Gemini (ele só pode escolher entre elas);
- normalizar() corrige variações (maiúsculas, acentos, plural, sinônimos)
  como garantia extra e para padronizar peças já cadastradas.
"""

import unicodedata


CATEGORIAS = [
    "Superior",
    "Inferior",
    "Peça única",
    "Calçado",
    "Acessório",
    "Sobreposição",
]

FORMALIDADES = ["casual", "esportivo", "social", "formal"]

PALETAS = ["neutras", "quentes", "frias", "coloridas"]

ESTACOES = ["verão", "outono", "inverno", "primavera"]


def _chave(valor):
    """'Calçados ' -> 'calcado' (minúsculo, sem acento e sem plural)."""

    texto = unicodedata.normalize("NFKD", str(valor).strip().lower())

    texto = "".join(c for c in texto if not unicodedata.combining(c))

    return texto[:-1] if texto.endswith("s") else texto


# Sinônimos comuns (já no formato de _chave)
_SINONIMOS = {
    "parte superior": "Superior",
    "top": "Superior",
    "parte inferior": "Inferior",
    "peca unica": "Peça única",
    "vestido": "Peça única",
    "macacao": "Peça única",
    "macaquinho": "Peça única",
    "sapato": "Calçado",
    "teni": "Calçado",
    "sobreposicoe": "Sobreposição",
    "casaco": "Sobreposição",
    "jaqueta": "Sobreposição",
    "esporte": "esportivo",
    "esportiva": "esportivo",
    "esportivo/casual": "esportivo",
    "verao": "verão",
    "frio": "frias",
    "neutro": "neutras",
    "colorido": "coloridas",
}

# Valores que significam "todas as estações"
_TODAS_ESTACOES = {"toda", "todas as estacoe", "todas as estacao", "ano todo", "o ano todo"}


def normalizar(valor, opcoes):
    """Devolve o valor oficial correspondente, ou None se não reconhecer."""

    if valor is None:
        return None

    chave = _chave(valor)

    for opcao in opcoes:
        if _chave(opcao) == chave:
            return opcao

    sinonimo = _SINONIMOS.get(chave)

    if sinonimo in opcoes:
        return sinonimo

    return None


def normalizar_lista(valores, opcoes):
    """
    Normaliza cada item, remove repetidos e devolve (validos, desconhecidos).
    "todas as estações" vira as quatro estações.
    """

    validos = []
    desconhecidos = []

    for valor in valores or []:

        if opcoes is ESTACOES and _chave(valor) in _TODAS_ESTACOES:
            itens = list(ESTACOES)
        else:
            oficial = normalizar(valor, opcoes)
            itens = [oficial] if oficial else []

            if not oficial:
                desconhecidos.append(valor)

        for item in itens:
            if item not in validos:
                validos.append(item)

    return validos, desconhecidos
