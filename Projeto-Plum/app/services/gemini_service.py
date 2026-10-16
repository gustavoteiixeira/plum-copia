import logging

from google.genai import types
from pydantic import ValidationError

from app.core.exceptions import FalhaIAError
from app.core.vocabulario import (
    CATEGORIAS,
    ESTACOES,
    FORMALIDADES,
    PALETAS
)
from app.schemas.roupa_schema import RoupaCreate
from app.services.gemini_client import gerar_conteudo


logger = logging.getLogger("plum.gemini")


MENSAGEM_ERRO_ANALISE = (
    "Não foi possível analisar a peça agora. "
    "Tente novamente em instantes."
)

GEMINI_ROUPA_SCHEMA = {
    "type": "OBJECT",

    "properties": {

        "nome": {
            "type": "STRING"
        },

        "tipo": {
            "type": "STRING",
            "description": "Tipo específico da peça. Exemplos: camiseta, camisa, polo, regata, calça jeans, bermuda, vestido, tênis, sapato, sandália."
        },

        # "enum": o Gemini só pode responder um destes valores
        "categoria": {
            "type": "STRING",
            "enum": CATEGORIAS,
            "description": "Categoria da peça. Sobreposição é só para peças usadas por cima de outra (jaqueta, casaco, blazer, cardigã, colete)."
        },

        "cores": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        },

        "paleta_cores": {
            "type": "ARRAY",
            "description": "Classificação geral da paleta de cores.",
            "items": {
                "type": "STRING",
                "enum": PALETAS
            }
        },

        "estilo": {
            "type": "STRING",
            "description": "Estilo predominante da peça. Exemplos: casual, formal, esportivo, social, minimalista."
        },

        "formalidade": {
            "type": "STRING",
            "enum": FORMALIDADES,
            "description": "Nível de formalidade da peça."
        },

        "tecido": {
            "type": "STRING",
            "description": "Material predominante da peça. Exemplos: algodão, jeans, couro, poliéster, linho."
        },

        "ocasioes": {
            "type": "ARRAY",
            "description": "Lista de ocasiões apropriadas para uso da peça. Exemplos: trabalho, faculdade, academia, festa, passeio.",
            "items": {
                "type": "STRING"
            }
        },

        "estacoes": {
            "type": "ARRAY",
            "description": "Estações do ano indicadas para utilização da peça.",
            "items": {
                "type": "STRING",
                "enum": ESTACOES
            }
        },

        "descricao": {
            "type": "STRING",
            "description": "Descrição objetiva da peça, resumindo aparência, cores, estilo e características principais."
        },

        "pode_sobrepor": {
            "type": "BOOLEAN",
            "description": "True se a peça pode ser usada por cima de outra (aberta). Sempre true para a categoria Sobreposição."
        }
    },

    "required": [
        "nome",
        "tipo",
        "categoria",
        "cores",
        "paleta_cores",
        "estilo",
        "formalidade",
        "tecido",
        "ocasioes",
        "estacoes",
        "descricao",
        "pode_sobrepor"
    ]
}

PROMPT_VERSO = """
    ATENÇÃO: você receberá DUAS imagens da MESMA peça.

    - Imagem 1: FRENTE da peça.
    - Imagem 2: VERSO (costas) da mesma peça.

    Regras para frente e verso:

    - Trate as duas imagens como UMA única peça. Nunca descreva como duas peças.
    - Use a frente como referência principal para nome, tipo e categoria.
    - Use o verso para complementar: estampas, logos, textos, recortes,
      bolsos, fechos, decotes e cores que só aparecem atrás.
    - Na descrição, mencione detalhes relevantes do verso quando existirem.
    """


def analisar_imagem(imagem_bytes, imagem_verso_bytes=None):
    """
    Analisa a peça a partir dos bytes do PNG (já sem fundo).
    A imagem não precisa estar salva em disco.

    Se o verso for enviado, frente e verso vão na MESMA requisição
    (conta como 1 requisição na cota do Gemini).
    """

    prompt = """
    Você é um especialista em moda e análise visual.

    Analise a imagem enviada e identifique a peça principal.

    Retorne apenas os dados solicitados pelo schema.

    Regras:

    - Analise somente a peça principal.
    - Preencha todos os campos definidos no schema.
    - Caso algum atributo não possa ser identificado:
        Para campos String utilize "não identificado".
        Para listas utilize [].
    - Não invente informações.

    Classifique considerando:

    - nome da peça;
    - tipo da peça;
    - Categoria;
    - cores predominantes;
    - Paleta de cores;
    - estilo;
    - Formalidade;
    - tecido quando possível;
    - ocasiões adequadas;
    - estações recomendadas;
    - descrição geral;
    - se pode ser usada como sobreposição.

    Regras de categoria:

    - Peça única: peça que dispensa AO MESMO TEMPO a parte de cima e a de baixo
      (vestido, macacão, macaquinho).
    - Jardineira é Inferior (precisa de uma blusa por baixo).
    - Body é Superior (cobre só o tronco).
    - Sobreposição: somente peças essencialmente usadas por cima de outra
      (jaqueta, casaco, blazer, cardigã, colete, moletom aberto).
    - Camisa de botão, flanela e camisa jeans são Superior, mesmo podendo
      ser usadas abertas.

    Regras de pode_sobrepor:

    - true para peças da categoria Sobreposição;
    - true para peças Superior que também funcionam abertas por cima de outra
      (camisa de botão, flanela, camisa jeans);
    - false nos demais casos.
    """

    tem_verso = imagem_verso_bytes is not None

    if tem_verso:
        prompt += PROMPT_VERSO


    partes = [

        types.Part.from_text(
            text=prompt
        ),

        types.Part.from_bytes(
            data=imagem_bytes,
            mime_type="image/png"
        )

    ]

    if tem_verso:

        partes.append(
            types.Part.from_bytes(
                data=imagem_verso_bytes,
                mime_type="image/png"
            )
        )


    resposta = gerar_conteudo(

        operacao="analise_peca_frente_verso" if tem_verso else "analise_peca",

        mensagem_erro=MENSAGEM_ERRO_ANALISE,

        contents=types.Content(

            role="user",

            parts=partes

        ),

        config=types.GenerateContentConfig(

            response_mime_type="application/json",

            response_schema=GEMINI_ROUPA_SCHEMA

        )
    )


    if resposta.parsed is None:

        logger.error("❌ analise_peca: Gemini não retornou JSON válido")

        raise FalhaIAError(MENSAGEM_ERRO_ANALISE)


    try:

        roupa = RoupaCreate.model_validate(
            resposta.parsed
        )

    except ValidationError as erro:

        logger.error(
            "❌ analise_peca: resposta fora do schema: %s",
            erro
        )

        raise FalhaIAError(MENSAGEM_ERRO_ANALISE) from erro


    logger.debug("Análise da peça: %s", resposta.parsed)

    return roupa