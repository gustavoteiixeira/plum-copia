"""
Relatório de métricas do PLUM (para o TCC).

Uso:
    python relatorio_metricas.py

Mostra o resumo no terminal e gera, em relatorios/:
- metricas_ia.csv : todos os registros (1 linha por operação de IA);
- sessoes.csv     : sessões de recomendação (pedidos com < 30 min entre si);
- resumo.csv      : os números do resumo.

Os CSV usam ";" e vírgula decimal (abrem direto no Excel em português)
e trazem o código PLU, para cruzar com os formulários.
"""

import csv
import statistics
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

from app.database import SessionLocal
from app.models import Dispositivo, MetricaIA, Recomendacao, Usuario


PASTA = Path("relatorios")

# Preenchidos em carregar()
GENEROS_POR_USUARIO = {}
DISPOSITIVOS = []

# Pedidos com intervalo maior que isso começam uma nova sessão
INTERVALO_SESSAO = timedelta(minutes=30)


# ==========================
# Utilidades
# ==========================

def _num(valor, casas=1):
    """Número com vírgula decimal (Excel pt-BR). Vazio se None."""

    if valor is None:
        return ""

    if isinstance(valor, bool):
        return "sim" if valor else "não"

    if isinstance(valor, int):
        return str(valor)

    return f"{valor:.{casas}f}".replace(".", ",")


def _p95(valores):

    if not valores:
        return None

    ordenados = sorted(valores)

    indice = max(0, round(0.95 * len(ordenados)) - 1)

    return ordenados[indice]


def _estatisticas(valores):
    """(média, mediana, p95) ignorando vazios."""

    valores = [v for v in valores if v is not None]

    if not valores:
        return None, None, None

    return statistics.mean(valores), statistics.median(valores), _p95(valores)


def _pct(parte, total):

    return 100 * parte / total if total else None


def _escrever_csv(nome, cabecalho, linhas):

    PASTA.mkdir(exist_ok=True)

    caminho = PASTA / nome

    # utf-8-sig: o Excel reconhece os acentos
    with caminho.open("w", newline="", encoding="utf-8-sig") as arquivo:

        escritor = csv.writer(arquivo, delimiter=";")

        escritor.writerow(cabecalho)

        escritor.writerows(linhas)

    return caminho


# ==========================
# Carga dos dados
# ==========================

def carregar():

    db = SessionLocal()

    try:

        usuarios = db.query(Usuario).all()

        codigos = {u.id: u.codigo_recuperacao for u in usuarios}

        # Nunca nome nem e-mail: só código PLU e gênero
        global GENEROS_POR_USUARIO, DISPOSITIVOS

        GENEROS_POR_USUARIO = {u.id: u.genero or "" for u in usuarios}

        DISPOSITIVOS = db.query(Dispositivo).all()

        metricas = db.query(MetricaIA).order_by(MetricaIA.criado_em).all()

        recomendacoes = db.query(Recomendacao).order_by(Recomendacao.criado_em).all()

        # Desacopla da sessão do banco
        db.expunge_all()

        return codigos, metricas, recomendacoes

    finally:

        db.close()


# ==========================
# Resumo por tipo
# ==========================

def resumo(metricas, recomendacoes=()):

    linhas = []

    def add(grupo, metrica, valor, casas=1):
        linhas.append((grupo, metrica, valor, casas))

    for tipo in ("preview", "analise_peca", "recomendacao"):

        grupo = [m for m in metricas if m.tipo == tipo]

        if not grupo:
            continue

        ok = [m for m in grupo if m.sucesso]

        add(tipo, "total", len(grupo))
        add(tipo, "sucesso", len(ok))
        add(tipo, "falhas", len(grupo) - len(ok))
        add(tipo, "taxa de sucesso (%)", _pct(len(ok), len(grupo)))

        recusados = sum(1 for m in grupo if m.erro == "ServidorOcupadoError")

        if recusados:
            add(tipo, "recusados por servidor ocupado (fila cheia/espera longa)", recusados)

        for campo, nome in (
            ("tempo_fila_ms", "espera na fila (s)"),
            ("tempo_rembg_ms", "tempo tratamento imagem (s)"),
            ("tempo_gemini_ms", "tempo Gemini (s)"),
            ("tempo_total_ms", "tempo total (s)"),
        ):
            media, mediana, p95 = _estatisticas(
                [getattr(m, campo) / 1000 if getattr(m, campo) is not None else None for m in ok]
            )

            if media is None:
                continue

            add(tipo, f"{nome} - média", media, 2)
            add(tipo, f"{nome} - mediana", mediana, 2)
            add(tipo, f"{nome} - p95", p95, 2)

        if tipo != "preview":
            linhas.extend(_tokens(tipo, grupo))

    # Recomendações separadas: geraram look x não geraram
    recs = [m for m in metricas if m.tipo == "recomendacao"]

    for nome, filtro in (
        ("recomendacao - gerou look", lambda m: m.sucesso and m.tipo_resposta == "look"),
        ("recomendacao - não gerou look", lambda m: m.sucesso and m.tipo_resposta != "look"),
        ("recomendacao - falhou", lambda m: not m.sucesso),
    ):
        grupo = [m for m in recs if filtro(m)]

        if not grupo:
            continue

        add(nome, "total", len(grupo))

        if nome == "recomendacao - gerou look":
            medidos = [m for m in grupo if getattr(m, "look_repetido", None) is not None]
            if medidos:
                add(nome, "looks repetidos do histórico (%)",
                    _pct(sum(1 for m in medidos if m.look_repetido), len(medidos)))

        linhas.extend(_tokens(nome, grupo))

    for tipo_resposta in ("resposta", "fora_do_tema"):

        qtd = sum(1 for m in recs if m.sucesso and m.tipo_resposta == tipo_resposta)

        if qtd:
            add("recomendacao - não gerou look", f"tipo {tipo_resposta}", qtd)

    # Prévias por peça e verso
    previews_ok = sum(1 for m in metricas if m.tipo == "preview" and m.sucesso)

    analises_ok = [m for m in metricas if m.tipo == "analise_peca" and m.sucesso]

    if analises_ok:

        add("analise_peca", "prévias por peça analisada", previews_ok / len(analises_ok), 2)

        add(
            "analise_peca",
            "com verso (%)",
            _pct(sum(1 for m in analises_ok if m.com_verso), len(analises_ok))
        )

    # Avaliações dos looks (👎 automático = saiu do chat sem avaliar)
    if recomendacoes:

        total = len(recomendacoes)
        gostei = sum(1 for r in recomendacoes if r.avaliacao is True)
        nao_gostei = sum(1 for r in recomendacoes if r.avaliacao is False and not r.avaliacao_automatica)
        automaticas = sum(1 for r in recomendacoes if r.avaliacao is False and r.avaliacao_automatica)
        sem_avaliacao = sum(1 for r in recomendacoes if r.avaliacao is None)

        add("avaliacoes", "looks gerados", total)
        add("avaliacoes", "👍 gostei", gostei)
        add("avaliacoes", "👎 não gostei (escolhido)", nao_gostei)
        add("avaliacoes", "👎 automático (saiu sem avaliar)", automaticas)
        add("avaliacoes", "sem avaliação (app fechado)", sem_avaliacao)
        add("avaliacoes", "aprovação real (%) = 👍 / (👍 + 👎 escolhido)", _pct(gostei, gostei + nao_gostei))
        add("avaliacoes", "abandono sem avaliar (%)", _pct(automaticas + sem_avaliacao, total))

    return linhas


def _tokens(grupo_nome, grupo):

    linhas = []

    com_tokens = [m for m in grupo if m.tokens_entrada is not None]

    if not com_tokens:
        return linhas

    for campo, nome in (
        ("tokens_entrada", "tokens entrada"),
        ("tokens_cache", "tokens em cache"),
        ("tokens_saida", "tokens saída"),
    ):
        valores = [getattr(m, campo) or 0 for m in com_tokens]

        linhas.append((grupo_nome, f"{nome} - média", statistics.mean(valores), 0))
        linhas.append((grupo_nome, f"{nome} - total", sum(valores), 0))

    entrada = sum(m.tokens_entrada or 0 for m in com_tokens)
    cache = sum(m.tokens_cache or 0 for m in com_tokens)

    linhas.append((grupo_nome, "entrada vinda do cache (%)", _pct(cache, entrada), 1))

    return linhas


# ==========================
# Sessões de recomendação
# ==========================

def sessoes(metricas, recomendacoes, codigos):
    """
    Sessão = pedidos de recomendação do mesmo usuário com menos de
    INTERVALO_SESSAO entre um e outro.

    - espera pela IA: soma dos tempos de resposta dos pedidos;
    - duração: do início do 1º pedido até o 1º 👍 da sessão
      (ou até a última resposta, se não houve 👍).
    """

    # Primeiro uso de cada usuário: base do "dia do estudo"
    primeiro_uso = {}

    for m in metricas:
        if m.usuario_id is not None:
            primeiro_uso.setdefault(m.usuario_id, m.criado_em)

    pedidos_por_usuario = defaultdict(list)

    for m in metricas:
        if m.tipo == "recomendacao" and m.usuario_id is not None:
            pedidos_por_usuario[m.usuario_id].append(m)

    recs_por_usuario = defaultdict(list)

    for r in recomendacoes:
        recs_por_usuario[r.usuario_id].append(r)

    resultado = []

    for usuario_id, pedidos in pedidos_por_usuario.items():

        grupos = []

        for pedido in pedidos:

            # criado_em é gravado no fim do pedido
            inicio = pedido.criado_em - timedelta(milliseconds=pedido.tempo_total_ms or 0)

            if grupos and inicio - grupos[-1]["fim"] <= INTERVALO_SESSAO:
                grupos[-1]["pedidos"].append(pedido)
                grupos[-1]["fim"] = pedido.criado_em
            else:
                grupos.append({"inicio": inicio, "fim": pedido.criado_em, "pedidos": [pedido]})

        for numero, grupo in enumerate(grupos, start=1):

            inicio, fim_respostas = grupo["inicio"], grupo["fim"]

            # 👍 dados para looks desta sessão, até INTERVALO_SESSAO depois da última resposta.
            # (hora do 👍, hora em que o look curtido foi gerado)
            likes = sorted(
                (r.avaliado_em, r.criado_em)
                for r in recs_por_usuario[usuario_id]
                if r.avaliacao is True
                and r.avaliado_em is not None
                and inicio <= r.criado_em <= fim_respostas + timedelta(seconds=1)
                and r.avaliado_em <= fim_respostas + INTERVALO_SESSAO
            )

            fim = likes[0][0] if likes else fim_respostas

            pedidos = grupo["pedidos"]

            # Pedidos até o que GEROU o primeiro look curtido (inclusive).
            # O registro da recomendação é salvo logo após a métrica do pedido.
            ate_like = (
                sum(1 for p in pedidos if p.criado_em <= likes[0][1] + timedelta(seconds=1))
                if likes else None
            )

            resultado.append({
                "codigo": codigos.get(usuario_id, ""),
                "genero": GENEROS_POR_USUARIO.get(usuario_id, ""),
                "sessao": numero,
                "dia_estudo": (inicio.date() - primeiro_uso[usuario_id].date()).days + 1,
                "inicio": inicio.strftime("%Y-%m-%d %H:%M:%S"),
                "pedidos": len(pedidos),
                "pedidos_com_look": sum(1 for p in pedidos if p.sucesso and p.tipo_resposta == "look"),
                "pedidos_ate_like": ate_like,
                "espera_ia_s": sum((p.tempo_total_ms or 0) for p in pedidos) / 1000,
                "duracao_s": (fim - inicio).total_seconds(),
                "terminou_em_like": bool(likes),
            })

    resultado.sort(key=lambda s: (s["codigo"], s["sessao"]))

    return resultado


# ==========================
# Saída
# ==========================

def main():

    codigos, metricas, recomendacoes = carregar()

    if not metricas:
        print("Nenhuma métrica registrada ainda.")
        return

    # Nunca exporta nome nem e-mail: só código PLU e gênero

    # ---------- Resumo ----------
    linhas_resumo = resumo(metricas, recomendacoes)

    print("\n================ RESUMO ================\n")

    # Agrupa (mantendo a ordem em que cada grupo aparece)
    por_grupo = {}

    for grupo, metrica, valor, casas in linhas_resumo:
        por_grupo.setdefault(grupo, []).append((metrica, valor, casas))

    for grupo, itens in por_grupo.items():

        print(f"\n[{grupo}]")

        for metrica, valor, casas in itens:

            texto = "-" if valor is None else (f"{valor:.{casas}f}" if isinstance(valor, float) else valor)

            print(f"  {metrica}: {texto}")

    # ---------- Sessões ----------
    lista_sessoes = sessoes(metricas, recomendacoes, codigos)

    if lista_sessoes:

        print("\n================ SESSÕES DE RECOMENDAÇÃO ================\n")

        com_like = [s for s in lista_sessoes if s["terminou_em_like"]]

        espera, _, _ = _estatisticas([s["espera_ia_s"] for s in lista_sessoes])
        duracao, duracao_med, _ = _estatisticas([s["duracao_s"] for s in lista_sessoes])

        print(f"  sessões: {len(lista_sessoes)}  (terminaram em 👍: {len(com_like)})")
        print(f"  pedidos por sessão (média): {statistics.mean(s['pedidos'] for s in lista_sessoes):.2f}")

        if com_like:
            print(f"  pedidos até o 👍 (média): {statistics.mean(s['pedidos_ate_like'] for s in com_like):.2f}")

        print(f"  espera pela IA por sessão (média): {espera:.1f} s")
        print(f"  duração da sessão: média {duracao:.1f} s | mediana {duracao_med:.1f} s")

        if duracao:
            print(f"  parcela da sessão esperando a IA: {100 * espera / duracao:.0f}%")

    # ---------- Usuários ----------
    usuarios = {m.usuario_id for m in metricas if m.usuario_id is not None}

    anonimos = sum(1 for m in metricas if m.usuario_id is None)

    print(f"\n  usuários com métricas: {len(usuarios)}  (registros sem identificação: {anonimos})")

    # ---------- Participantes e aparelhos ----------
    if GENEROS_POR_USUARIO or DISPOSITIVOS:

        print("\n================ PARTICIPANTES E APARELHOS ================\n")

        contagem_genero = defaultdict(int)

        for genero in GENEROS_POR_USUARIO.values():
            contagem_genero[genero or "(não informado)"] += 1

        print("  gênero: " + ", ".join(f"{g}: {q}" for g, q in sorted(contagem_genero.items())))

        if DISPOSITIVOS:

            reais = sum(1 for d in DISPOSITIVOS if d.celular_real)

            print(f"  aparelhos registrados: {len(DISPOSITIVOS)} "
                  f"(celulares reais: {reais}, emuladores: {len(DISPOSITIVOS) - reais})")
            print(f"  usuários com aparelho registrado: {len({d.usuario_id for d in DISPOSITIVOS})}")

            for titulo, chave in (
                ("marcas", lambda d: d.marca or d.fabricante or "?"),
                ("modelos", lambda d: f"{d.marca or ''} {d.modelo or '?'}".strip()),
                ("sistemas", lambda d: f"{d.sistema or '?'} {d.versao_sistema or ''}".strip()),
            ):
                contagem = defaultdict(int)
                for d in DISPOSITIVOS:
                    contagem[chave(d)] += 1
                print(f"  {titulo}: " + ", ".join(f"{k} ({q})" for k, q in sorted(contagem.items(), key=lambda par: -par[1])))

            _escrever_csv(
                "dispositivos.csv",
                ["codigo", "genero", "celular_real", "marca", "fabricante", "modelo", "sistema",
                 "versao_sistema", "tipo", "versao_app", "primeiro_acesso", "ultimo_acesso"],
                [
                    [
                        codigos.get(d.usuario_id, ""), GENEROS_POR_USUARIO.get(d.usuario_id, ""),
                        _num(d.celular_real), d.marca or "", d.fabricante or "", d.modelo or "",
                        d.sistema or "", d.versao_sistema or "", d.tipo or "", d.versao_app or "",
                        d.primeiro_acesso.strftime("%Y-%m-%d %H:%M:%S"),
                        d.ultimo_acesso.strftime("%Y-%m-%d %H:%M:%S"),
                    ]
                    for d in DISPOSITIVOS
                ]
            )

    # ---------- CSV ----------
    caminho_metricas = _escrever_csv(
        "metricas_ia.csv",
        [
            "codigo", "genero", "data_hora", "tipo", "sucesso", "erro", "tipo_resposta",
            "com_verso", "look_repetido", "modelo", "tempo_fila_ms", "tempo_rembg_ms", "tempo_gemini_ms",
            "tempo_total_ms", "tokens_entrada", "tokens_cache", "tokens_saida",
        ],
        [
            [
                codigos.get(m.usuario_id, ""),
                GENEROS_POR_USUARIO.get(m.usuario_id, ""),
                m.criado_em.strftime("%Y-%m-%d %H:%M:%S"),
                m.tipo, _num(m.sucesso), m.erro or "", m.tipo_resposta or "",
                _num(m.com_verso), _num(getattr(m, "look_repetido", None)), m.modelo or "",
                _num(getattr(m, "tempo_fila_ms", None)), _num(m.tempo_rembg_ms), _num(m.tempo_gemini_ms), _num(m.tempo_total_ms),
                _num(m.tokens_entrada), _num(m.tokens_cache), _num(m.tokens_saida),
            ]
            for m in metricas
        ]
    )

    caminho_sessoes = _escrever_csv(
        "sessoes.csv",
        [
            "codigo", "genero", "sessao", "dia_estudo", "inicio", "pedidos", "pedidos_com_look",
            "pedidos_ate_like", "espera_ia_s", "duracao_s", "terminou_em_like",
        ],
        [
            [
                s["codigo"], s["genero"], s["sessao"], s["dia_estudo"], s["inicio"], s["pedidos"],
                s["pedidos_com_look"], _num(s["pedidos_ate_like"]),
                _num(s["espera_ia_s"]), _num(s["duracao_s"]), _num(s["terminou_em_like"]),
            ]
            for s in lista_sessoes
        ]
    )

    caminho_resumo = _escrever_csv(
        "resumo.csv",
        ["grupo", "metrica", "valor"],
        [[g, m, _num(v, c)] for g, m, v, c in linhas_resumo]
    )

    print("\nArquivos gerados:")

    for caminho in (caminho_metricas, caminho_sessoes, caminho_resumo):
        print(f"  - {caminho}")

    if DISPOSITIVOS:
        print(f"  - {PASTA / 'dispositivos.csv'}")


if __name__ == "__main__":
    main()
