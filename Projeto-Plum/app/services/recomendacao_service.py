import json
import logging
from datetime import datetime

from google.genai import types
from pydantic import ValidationError

from app.core.exceptions import FalhaIAError
from app.core.urls import url_publica
from app.models import Recomendacao, Roupa
from app.schemas.recomendacao_schema import RecomendacaoResponse
from app.services.gemini_client import gerar_conteudo
from app.services.metricas_service import medicao_atual


logger = logging.getLogger("plum.gemini")


MENSAGEM_ERRO_RECOMENDACAO = (
    "Não consegui montar um look agora. "
    "Tente novamente em instantes."
)


def _marcar_tipo(medicao, tipo_resposta):

    if medicao:
        medicao.tipo_resposta = tipo_resposta


def _resposta_invalida(motivo):

    logger.error("❌ recomendacao: resposta inválida do Gemini: %s", motivo)

    raise FalhaIAError(MENSAGEM_ERRO_RECOMENDACAO)

# Vagas do look, na ordem de prioridade (usada para resolver repetições)
VAGAS = [
    "peca_unica",
    "parte_superior",
    "parte_inferior",
    "calcado",
    "sobreposicao",
    "acessorio",
]


# Vagas que podem ficar vazias sem prejudicar o look
VAGAS_OPCIONAIS = {"sobreposicao", "acessorio"}


# Categoria que cada vaga aceita
# (a sobreposição também aceita peças com pode_sobrepor = true)
CATEGORIA_DA_VAGA = {
    "peca_unica": "Peça única",
    "parte_superior": "Superior",
    "parte_inferior": "Inferior",
    "calcado": "Calçado",
    "sobreposicao": "Sobreposição",
    "acessorio": "Acessório",
}


# O Gemini devolve só o id de cada peça (menos tokens de saída).
# Nome, categoria, imagem etc. são completados pelo servidor com o banco.
def _schema_peca():

    return {
        "type": "OBJECT",
        "nullable": True,
        "properties": {
            "id": {"type": "INTEGER"}
        },
        "required": ["id"]
    }


# Campos de cada peça que vão para o prompt.
# Ficam de fora imagem/miniatura (URLs) e descricao (texto longo que
# repete o que os outros campos já dizem).
CAMPOS_PROMPT = (
    "id",
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
    "pode_sobrepor",
)

# Campos completados pelo servidor em cada peça do look
CAMPOS_DO_BANCO = (
    "nome",
    "tipo",
    "categoria",
    "estilo",
    "formalidade",
    "descricao",
    "imagem",
    "miniatura",
)


def _json_compacto(dados):

    return json.dumps(dados, ensure_ascii=False, separators=(",", ":"))


# Respostas com texto fixo: o servidor garante a frase exata,
# independentemente do que o Gemini escrever na justificativa
RESPOSTA_FORA_DO_TEMA = (
    "Sou um assistente especializado em moda. "
    "Posso ajudar apenas com combinações de roupas, estilos e sugestões de looks."
)

RESPOSTA_DEMORA = "É difícil digitar usando as patas KKKKK"

TIPOS_RESPOSTA = ["look", "resposta", "fora_do_tema", "demora"]


GEMINI_RECOMENDACAO_SCHEMA = {

    "type": "OBJECT",

    "properties": {

        # look = montou um look | resposta = dúvida de moda respondida só em texto
        # fora_do_tema = assunto que não é moda | demora = pergunta sobre a demora
        "tipo": {
            "type": "STRING",
            "enum": TIPOS_RESPOSTA
        },

        "look": {

            "type": "OBJECT",

            "nullable": True,

            "properties": {
                vaga: _schema_peca()
                for vaga in VAGAS
            },

            "required": VAGAS
        },

        "justificativa": {
            "type": "STRING"
        }
    },

    "required": [
        "tipo",
        "look",
        "justificativa"
    ]
}


def _vaga_aceita(vaga, roupa):

    if vaga == "sobreposicao":
        return roupa["categoria"] == "Sobreposição" or roupa.get("pode_sobrepor")

    return roupa["categoria"] == CATEGORIA_DA_VAGA[vaga]


def _vaga_da_categoria(categoria):

    for vaga, cat in CATEGORIA_DA_VAGA.items():
        if cat == categoria:
            return vaga

    return None


def _corrigir_look(look, roupas):
    """
    Valida o look devolvido pelo Gemini e corrige o que for possível:

    1. peça com id inexistente -> rejeita;
    2. peça na vaga errada -> move para a vaga certa se estiver livre;
       se já estiver lá, ou se a vaga errada for opcional, só remove;
       senão rejeita;
    3. mesma peça em duas vagas -> mantém na vaga de maior prioridade;
    4. peça única junto com superior/inferior -> remove superior e inferior.

    Imagem e categoria sempre vêm do banco (não do Gemini).
    """

    por_id = {roupa["id"]: roupa for roupa in roupas}

    # 1 e 2
    for vaga in VAGAS:

        peca = getattr(look, vaga)

        if peca is None:
            continue

        if peca.id is None:
            _resposta_invalida(f"{vaga}: peça sem id")

        roupa = por_id.get(peca.id)

        if roupa is None:
            _resposta_invalida(f"{vaga}: ID {peca.id} não existe no guarda-roupa")

        # Tudo que o app exibe vem do banco, não do Gemini
        for campo in CAMPOS_DO_BANCO:
            setattr(peca, campo, roupa.get(campo))

        if _vaga_aceita(vaga, roupa):
            continue

        destino = _vaga_da_categoria(roupa["categoria"])

        ocupante = getattr(look, destino) if destino else None

        if ocupante is not None and ocupante.id == peca.id:

            # A mesma peça já está na vaga certa: só tira da errada
            logger.warning("🔧 Look corrigido: peça %s repetida em %s", peca.id, vaga)

            setattr(look, vaga, None)

        elif destino and ocupante is None:

            logger.warning(
                "🔧 Look corrigido: peça %s movida de %s para %s",
                peca.id, vaga, destino
            )

            setattr(look, destino, peca)
            setattr(look, vaga, None)

        elif vaga in VAGAS_OPCIONAIS:

            # Sobreposição/acessório são opcionais: melhor tirar do que falhar
            logger.warning(
                "🔧 Look corrigido: peça %s removida de %s (vaga errada)",
                peca.id, vaga
            )

            setattr(look, vaga, None)

        else:

            _resposta_invalida(
                f"{vaga}: peça {peca.id} ({roupa['categoria']}) na vaga errada"
            )

    # 3
    usados = set()

    for vaga in VAGAS:

        peca = getattr(look, vaga)

        if peca is None:
            continue

        if peca.id in usados:

            logger.warning("🔧 Look corrigido: peça %s repetida em %s", peca.id, vaga)

            setattr(look, vaga, None)

        else:

            usados.add(peca.id)

    # 4
    if look.peca_unica is not None:

        for vaga in ("parte_superior", "parte_inferior"):

            if getattr(look, vaga) is not None:

                logger.warning(
                    "🔧 Look corrigido: %s removida (já há peça única)", vaga
                )

                setattr(look, vaga, None)


# Instruções fixas: iguais para todos os usuários e todos os pedidos.
# Vão como system_instruction, no INÍCIO do prompt, para aproveitar o
# cache implícito do Gemini (prefixo repetido sai com desconto).
INSTRUCOES_RECOMENDACAO = """

    Você é o assistente de moda do aplicativo Plu.

    Sua única função é ajudar o usuário com:

    - montagem de looks;
    - combinação de roupas;
    - escolha de peças para ocasiões;
    - sugestões de estilo;
    - dúvidas relacionadas a moda e vestuário.


    RESTRIÇÃO DE DOMÍNIO:

    Antes de responder, analise se a solicitação do usuário está relacionada a moda.

    Caso o usuário pergunte algo fora do contexto de moda, NÃO responda ao assunto.

    Retorne exatamente:

    {
        "tipo": "fora_do_tema",
        "look": null,
        "justificativa": "Sou um assistente especializado em moda. Posso ajudar apenas com combinações de roupas, estilos e sugestões de looks."
    }

    Caso o usuário pergunte algo relacionado a demora de suas respostas, retorne exatamente:

    {
        "tipo": "demora",
        "look": null,
        "justificativa": "É difícil digitar usando as patas KKKKK"
    }

    Campo "tipo":

    - "look": quando montar um look com peças do guarda-roupa;
    - "resposta": dúvida de moda respondida só em texto (look null);
    - "fora_do_tema": assunto que não é moda (look null);
    - "demora": pergunta sobre a demora das respostas (look null).

    O QUE É MODA (sempre responda):

    Qualquer pedido sobre o que vestir, usar, combinar ou levar para uma
    ocasião, lugar, clima, evento ou atividade é moda: praia, piscina,
    viagem, academia, balada, show, trabalho, faculdade, frio, chuva,
    calor etc. Isso vale MESMO QUE o guarda-roupa não tenha peças ideais.
    Pedidos com erros de digitação também devem ser interpretados.

    Na dúvida entre moda e fora do tema, trate como moda.

    Exemplos de assuntos permitidos:

    - "Monte um look para casamento"
    - "O que usar em uma entrevista?"
    - "Combine minha camiseta com uma calça"
    - "Sugira um look casual"
    - "O que vestir no inverno?"
    - "Look para praia"
    - "O que levar numa viagem para a serra?"
    - "Roupa para academia"
    - "O que vestir num dia de chuva?"

    Exemplos de assuntos proibidos (sem relação com roupa):

    - programação;
    - matemática;
    - política;
    - notícias;
    - receitas;
    - saúde, medicina e nutrição;
    - resultados de esportes, times e campeonatos.

    Atenção à diferença: "Qual a melhor praia do Brasil?" é fora do tema;
    "Look para a praia" é moda.

    QUANDO FALTAREM PEÇAS ADEQUADAS:

    - Monte o look mais adequado possível com as peças que existem e diga
      na justificativa o que faltou (ex.: "Não achei roupa de banho no seu
      guarda-roupa; montei um look leve para a orla.").
    - Se nenhuma peça servir, use tipo "resposta" (look null) e sugira o
      que cadastrar (ex.: "Cadastre uma bermuda ou um vestido leve para eu
      montar looks de praia.").
    - Nunca use "fora_do_tema" só porque faltam peças.


    DADOS RECEBIDOS (na mensagem do usuário, nesta ordem):

    1. GUARDA-ROUPA: tabela com uma peça por linha. A primeira linha é o
       cabeçalho; colunas separadas por "|"; listas separadas por ",";
       pode_sobrepor vem como "sim" ou "não".
    2. HISTÓRICO: looks sugeridos recentemente a este usuário (mais recente
       primeiro), com as peças (id e nome) e a avaliação (👍 gostou,
       👎 não gostou, "sem avaliação"). Depois vêm duas listas:
       COMBINAÇÕES JÁ SUGERIDAS (conjuntos de ids) e PEÇAS MAIS SUGERIDAS.
    3. PEDIDO: o que o usuário quer agora. Analise a restrição de domínio
       sobre o PEDIDO.

    VARIEDADE (regras obrigatórias):

    - Repetir = sugerir exatamente o mesmo conjunto de ids de uma das
      COMBINAÇÕES JÁ SUGERIDAS. É PROIBIDO repetir, a menos que o usuário
      peça explicitamente um look anterior.
    - Cada look novo deve trocar pelo menos uma peça principal (peca_unica,
      parte_superior ou parte_inferior) em relação aos looks do histórico,
      sempre que houver outra peça adequada no guarda-roupa.
    - Prefira peças que aparecem pouco em PEÇAS MAIS SUGERIDAS.
    - Nunca repita looks avaliados com 👎.
    - Se todas as combinações adequadas já foram sugeridas, avise na
      justificativa (ex.: "Já te mostrei as combinações possíveis com essas
      peças; cadastre mais peças para mais variedade.").

    Analise todas as categorias disponíveis.

    Monte um look completo considerando:

    - Escolha uma peça principal adequada.
    - Peça única (categoria "Peça única": vestido, macacão) substitui
      parte_superior e parte_inferior. Se usar peca_unica, retorne
      parte_superior e parte_inferior como null.
    - Cada vaga só aceita a categoria correspondente:
      peca_unica = Peça única, parte_superior = Superior,
      parte_inferior = Inferior, calcado = Calçado, acessorio = Acessório.
    - sobreposicao aceita peças da categoria Sobreposição OU com
      pode_sobrepor = true (ex.: camisa de botão aberta por cima de camiseta).
    - Nunca use a mesma peça em duas vagas.
    - Não combine peças incompatíveis.
    - escolha calçado quando existir uma opção compatível.
    - Caso não exista calçado adequado, retorne null.
    - sobreposição quando necessário pelo clima, estação ou estilo
    - acessórios quando ajudarem a composição

    Não force acessórios ou sobreposição.
    Use null quando não forem necessários.

    A prioridade da escolha deve ser:

    1 - ocasião solicitada pelo usuário
    2 - estação/clima informado
    3 - combinação de cores
    4 - estilo
    5 - formalidade

    Regras:
    
    - Utilize somente roupas da lista.
    - Antes de escolher uma peça, valide se o id informado existe na lista.
    - O campo id deve corresponder exatamente ao banco de dados.
    - Nunca gere um id novo.
    - Nunca invente peças.
    - Monte uma combinação coerente.
    - Considere categoria, cores, estilo, formalidade e ocasião.
    - Sempre retorne também o id da peça escolhida.
    - O id deve ser exatamente o id presente na lista de roupas.
    - Caso uma categoria não possua peça adequada, retorne somente aquela categoria como null.
    - Não descarte o look inteiro.


    """


# Colunas do guarda-roupa enviadas ao Gemini (cabeçalho da tabela)
def _celula(valor):

    if isinstance(valor, bool):
        return "sim" if valor else "não"

    if isinstance(valor, (list, tuple)):
        return ",".join(_celula(v) for v in valor)

    if valor is None:
        return ""

    # "|" separa colunas: não pode aparecer dentro do valor
    return str(valor).replace("|", "/").replace("\n", " ").strip()


def _tabela_guarda_roupa(roupas):
    """Uma peça por linha. Os nomes dos campos aparecem uma vez só."""

    linhas = ["|".join(CAMPOS_PROMPT)]

    for roupa in roupas:
        linhas.append("|".join(_celula(roupa.get(c)) for c in CAMPOS_PROMPT))

    return "\n".join(linhas)


ROTULO_VAGA = {
    "peca_unica": "peça única",
    "parte_superior": "superior",
    "parte_inferior": "inferior",
    "calcado": "calçado",
    "sobreposicao": "sobreposição",
    "acessorio": "acessório",
}

ROTULO_AVALIACAO = {True: "👍", False: "👎", None: "sem avaliação"}


def combinacao(look_ids):
    """Conjunto de ids de um look (ignora vagas vazias)."""

    return frozenset(i for i in look_ids.values() if i is not None)


def _texto_historico(historico, roupas):
    """
    Histórico legível: id + nome de cada peça, combinações já sugeridas
    e peças mais usadas. Modelos menores erram ao cruzar só ids.
    """

    if not historico:
        return "(nenhum look sugerido ainda)"

    nomes = {r["id"]: r.get("nome") or "" for r in roupas}

    linhas = []
    combinacoes = []
    usos = {}

    for numero, item in enumerate(historico, start=1):

        look = item.get("look") or {}

        pecas = " + ".join(
            f"{ROTULO_VAGA.get(vaga, vaga)} {id_peca} {nomes.get(id_peca, '(peça excluída)')}"
            for vaga, id_peca in look.items()
        )

        pedido = (item.get("prompt") or "").replace("\n", " ")[:60]

        linhas.append(
            f'{numero}. pedido "{pedido}" → {pecas} | '
            f'{ROTULO_AVALIACAO.get(item.get("avaliacao"), "sem avaliação")}'
        )

        conjunto = combinacao(look)

        if conjunto and conjunto not in combinacoes:
            combinacoes.append(conjunto)

        for id_peca in conjunto:
            usos[id_peca] = usos.get(id_peca, 0) + 1

    texto_comb = "; ".join(
        "{" + ", ".join(str(i) for i in sorted(c)) + "}" for c in combinacoes
    )

    mais_usadas = sorted(usos.items(), key=lambda par: -par[1])

    texto_usos = ", ".join(
        f"id {i} {nomes.get(i, '(peça excluída)')} ({qtd}x)"
        for i, qtd in mais_usadas if qtd > 1
    ) or "nenhuma repetida"

    return (
        "\n".join(linhas)
        + f"\nCOMBINAÇÕES JÁ SUGERIDAS: {texto_comb}"
        + f"\nPEÇAS MAIS SUGERIDAS: {texto_usos}"
    )


def montar_mensagem(prompt_usuario, roupas, historico):
    """
    Ordem pensada para o cache implícito: do que muda menos para o que muda mais.
    - guarda-roupa: igual até o usuário adicionar/excluir uma peça;
    - histórico: muda a cada look recomendado;
    - pedido: muda sempre (por último).
    """

    return (
        "GUARDA-ROUPA:\n"
        f"{_tabela_guarda_roupa(roupas)}\n\n"
        "HISTÓRICO:\n"
        f"{_texto_historico(historico, roupas)}\n\n"
        "PEDIDO:\n"
        f"{prompt_usuario}"
    )


def gerar_recomendacao(prompt_usuario, roupas, historico=None):

    mensagem = montar_mensagem(prompt_usuario, roupas, historico or [])

    resposta = gerar_conteudo(

        operacao="recomendacao",

        mensagem_erro=MENSAGEM_ERRO_RECOMENDACAO,

        contents=mensagem,

        config=types.GenerateContentConfig(

            system_instruction=INSTRUCOES_RECOMENDACAO,

            response_mime_type="application/json",

            response_schema=GEMINI_RECOMENDACAO_SCHEMA

        )
    )


    logger.debug("Recomendação: %s", resposta.parsed)


    if resposta.parsed is None:
        _resposta_invalida("Gemini não retornou JSON válido")

    try:

        recomendacao = RecomendacaoResponse.model_validate(
            resposta.parsed
        )

    except ValidationError as erro:

        _resposta_invalida(f"resposta fora do schema: {erro}")

    tipo = resposta.parsed.get("tipo") if isinstance(resposta.parsed, dict) else None

    medicao = medicao_atual()

    # Fora do tema / demora: frase fixa garantida pelo servidor
    if tipo == "fora_do_tema":
        # Ajuda a encontrar pedidos de moda recusados por engano nos testes
        logger.warning('⚠️ fora_do_tema: "%s"', (prompt_usuario or "")[:80])
        _marcar_tipo(medicao, "fora_do_tema")
        recomendacao.look = None
        recomendacao.justificativa = RESPOSTA_FORA_DO_TEMA
        return recomendacao

    if tipo == "demora":
        # Nas métricas, conta como resposta só em texto
        _marcar_tipo(medicao, "resposta")
        recomendacao.look = None
        recomendacao.justificativa = RESPOSTA_DEMORA
        return recomendacao

    # Resposta só em texto: look ausente ou com todas as vagas vazias.
    # (O Gemini às vezes devolve um look "vazio" em vez de null.)
    if (
        tipo == "resposta"
        or recomendacao.look is None
        or all(getattr(recomendacao.look, vaga) is None for vaga in VAGAS)
    ):
        _marcar_tipo(medicao, "resposta")
        recomendacao.look = None
        return recomendacao

    _corrigir_look(recomendacao.look, roupas)

    # Ficou vazio só DEPOIS das correções: a justificativa citaria peças
    # que não aparecem, então é melhor pedir para tentar de novo

    if all(getattr(recomendacao.look, vaga) is None for vaga in VAGAS):
        _resposta_invalida("look vazio após validação")

    _marcar_tipo(medicao, "look")

    # Métrica: o look é exatamente igual a uma combinação do histórico?
    if medicao:

        ids_look = combinacao({
            vaga: getattr(recomendacao.look, vaga).id
            for vaga in VAGAS
            if getattr(recomendacao.look, vaga) is not None
        })

        medicao.look_repetido = any(
            ids_look == combinacao(item.get("look") or {})
            for item in (historico or [])
        )

        if medicao.look_repetido:
            logger.warning("🔁 Look repetido do histórico: %s", sorted(ids_look))

    return recomendacao

def buscar_historico_recomendacoes(
    db,
    usuario_id,
    recentes=8,
    negativas=5
):
    """
    Histórico enviado ao Gemini:
    - as últimas `recentes` recomendações (para variar os looks);
    - mais até `negativas` com avaliação "não gostei" (para não repetir).
    """

    ultimas = (
        db.query(Recomendacao)
        .filter(
            Recomendacao.usuario_id == usuario_id
        )
        .order_by(
            Recomendacao.criado_em.desc()
        )
        .limit(recentes)
        .all()
    )

    ids_ultimas = [rec.id for rec in ultimas]

    consulta_negativas = db.query(Recomendacao).filter(
        Recomendacao.usuario_id == usuario_id,
        Recomendacao.avaliacao.is_(False)
    )

    if ids_ultimas:
        consulta_negativas = consulta_negativas.filter(
            Recomendacao.id.notin_(ids_ultimas)
        )

    nao_gostou = (
        consulta_negativas
        .order_by(Recomendacao.criado_em.desc())
        .limit(negativas)
        .all()
    )

    recomendacoes = ultimas + nao_gostou


    historico = []


    for rec in recomendacoes:

        historico.append({

            "prompt": rec.prompt,

            # Só as vagas preenchidas (prompt menor)
            "look": {
                vaga: id_peca
                for vaga, id_peca in (
                    ("peca_unica", rec.peca_unica_id),
                    ("parte_superior", rec.parte_superior_id),
                    ("parte_inferior", rec.parte_inferior_id),
                    ("calcado", rec.calcado_id),
                    ("sobreposicao", rec.sobreposicao_id),
                    ("acessorio", rec.acessorio_id),
                )
                if id_peca is not None
            },

            "avaliacao": rec.avaliacao

        })


    return historico

def salvar_recomendacao(
    db,
    usuario_id,
    prompt,
    recomendacao
):

    if recomendacao.look is None:
        return None


    look = recomendacao.look


    registro = Recomendacao(

        usuario_id=usuario_id,

        prompt=prompt,

        justificativa=recomendacao.justificativa,

        parte_superior_id=(
            look.parte_superior.id
            if look.parte_superior
            else None
        ),

        parte_inferior_id=(
            look.parte_inferior.id
            if look.parte_inferior
            else None
        ),

        calcado_id=(
            look.calcado.id
            if look.calcado
            else None
        ),

        sobreposicao_id=(
            look.sobreposicao.id
            if look.sobreposicao
            else None
        ),

        acessorio_id=(
            look.acessorio.id
            if look.acessorio
            else None
        ),

        peca_unica_id=(
            look.peca_unica.id
            if look.peca_unica
            else None
        ),

        avaliacao=None,

        criado_em=datetime.now()
    )


    db.add(registro)

    db.commit()

    db.refresh(registro)


    return registro


def listar_outfits(db, usuario_id):
    """
    Looks com 👍 do usuário, do mais recente para o mais antigo,
    com os dados das peças vindos do banco.

    Se alguma peça do look foi excluída do guarda-roupa, o outfit
    inteiro é escondido (não dá para montar o look completo).
    """

    curtidas = (
        db.query(Recomendacao)
        .filter(
            Recomendacao.usuario_id == usuario_id,
            Recomendacao.avaliacao.is_(True)
        )
        .order_by(Recomendacao.criado_em.desc())
        .all()
    )

    if not curtidas:
        return []

    roupas = {
        roupa.id: roupa
        for roupa in db.query(Roupa).filter(Roupa.usuario_id == usuario_id).all()
    }

    outfits = []

    for rec in curtidas:

        ids_por_vaga = {
            vaga: getattr(rec, f"{vaga}_id")
            for vaga in VAGAS
            if getattr(rec, f"{vaga}_id") is not None
        }

        if not ids_por_vaga or any(i not in roupas for i in ids_por_vaga.values()):
            continue

        look = {}

        for vaga, id_peca in ids_por_vaga.items():

            roupa = roupas[id_peca]

            look[vaga] = {
                "id": roupa.id,
                "nome": roupa.nome,
                "tipo": roupa.tipo,
                "categoria": roupa.categoria,
                "estilo": roupa.estilo,
                "formalidade": roupa.formalidade,
                "descricao": roupa.descricao,
                "imagem": url_publica(roupa.imagem_url),
                "miniatura": url_publica(roupa.miniatura_url or roupa.imagem_url),
            }

        outfits.append({
            "id": rec.id,
            "prompt": rec.prompt,
            "justificativa": rec.justificativa,
            "criado_em": rec.criado_em,
            "look": look,
        })

    return outfits
