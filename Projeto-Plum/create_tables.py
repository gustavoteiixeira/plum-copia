from sqlalchemy import text

from app.core.vocabulario import (
    CATEGORIAS,
    ESTACOES,
    FORMALIDADES,
    PALETAS,
    normalizar,
    normalizar_lista
)
from app.database import SessionLocal, engine
from app.models import Base, Roupa


# Cria as tabelas que ainda não existem
Base.metadata.create_all(bind=engine)


# create_all NÃO adiciona colunas novas em tabelas que já existem.
# Migrações simples e idempotentes (podem rodar várias vezes):
MIGRACOES = [
    "ALTER TABLE roupas ADD COLUMN IF NOT EXISTS imagem_verso_url VARCHAR(255)",

    "ALTER TABLE roupas ADD COLUMN IF NOT EXISTS pode_sobrepor BOOLEAN NOT NULL DEFAULT FALSE",

    "ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS peca_unica_id INTEGER",

    "ALTER TABLE roupas ADD COLUMN IF NOT EXISTS miniatura_url VARCHAR(255)",

    "ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS avaliado_em TIMESTAMP",

    "ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS avaliacao_automatica BOOLEAN NOT NULL DEFAULT FALSE",

    "ALTER TABLE metricas_ia ADD COLUMN IF NOT EXISTS look_repetido BOOLEAN",

    "ALTER TABLE metricas_ia ADD COLUMN IF NOT EXISTS tempo_fila_ms INTEGER",

    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(255)",

    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero VARCHAR(30)",

    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP",

    # Garante e-mail único também em bancos criados antes da coluna existir
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email)",

    # URLs completas (http://IP:porta/saida/x.png) -> só o caminho (/saida/x.png)
    r"UPDATE roupas SET imagem_url = regexp_replace(imagem_url, '^https?://[^/]+', '') "
    r"WHERE imagem_url ~ '^https?://'",

    r"UPDATE roupas SET imagem_verso_url = regexp_replace(imagem_verso_url, '^https?://[^/]+', '') "
    r"WHERE imagem_verso_url ~ '^https?://'",
]

with engine.begin() as conexao:

    for comando in MIGRACOES:

        conexao.execute(text(comando))


# ==========================
# Padroniza categoria, formalidade, paleta e estações das peças existentes
# ==========================

def padronizar_pecas():

    db = SessionLocal()

    alteradas = 0
    pendencias = []

    try:

        for roupa in db.query(Roupa).all():

            mudou = False

            for campo, opcoes in (
                ("categoria", CATEGORIAS),
                ("formalidade", FORMALIDADES),
            ):
                atual = getattr(roupa, campo)
                oficial = normalizar(atual, opcoes)

                if oficial is None:
                    pendencias.append((roupa.id, roupa.nome, campo, atual))
                elif oficial != atual:
                    setattr(roupa, campo, oficial)
                    mudou = True

            for campo, opcoes in (
                ("paleta_cores", PALETAS),
                ("estacoes", ESTACOES),
            ):
                atual = getattr(roupa, campo) or []
                validos, desconhecidos = normalizar_lista(atual, opcoes)

                if desconhecidos:
                    # Não descarta nada no banco: só avisa para revisão
                    pendencias.append((roupa.id, roupa.nome, campo, desconhecidos))
                elif validos != atual:
                    setattr(roupa, campo, validos)
                    mudou = True

            if mudou:
                alteradas += 1

        db.commit()

    finally:

        db.close()

    print(f"Peças padronizadas: {alteradas}")

    if pendencias:

        print("\nValores fora do padrão (mantidos como estão, revise):")

        for id_, nome, campo, valor in pendencias:
            print(f"  - peça {id_} ({nome}): {campo} = {valor!r}")


padronizar_pecas()


# ==========================
# Marca pode_sobrepor nas peças existentes
# ==========================

TIPOS_SOBREPONIVEIS = ("camisa", "flanela", "overshirt")

# Contêm "camisa"/parecidos, mas não se usam abertas por cima de outra peça
TIPOS_EXCLUIDOS = ("camiseta", "polo", "regata")


def marcar_sobreponiveis():

    db = SessionLocal()

    marcadas = []

    try:

        for roupa in db.query(Roupa).filter(Roupa.pode_sobrepor.is_(False)).all():

            tipo = (roupa.tipo or "").lower()

            sobreponivel = roupa.categoria == "Sobreposição" or (
                roupa.categoria == "Superior"
                and not any(t in tipo for t in TIPOS_EXCLUIDOS)
                and any(t in tipo for t in TIPOS_SOBREPONIVEIS)
            )

            if sobreponivel:
                roupa.pode_sobrepor = True
                marcadas.append((roupa.id, roupa.nome, roupa.categoria, roupa.tipo))

        db.commit()

    finally:

        db.close()

    print(f"\nPeças marcadas como 'pode sobrepor': {len(marcadas)}")

    for id_, nome, categoria, tipo in marcadas:
        print(f"  - peça {id_} ({nome}) | {categoria} | tipo: {tipo}")


marcar_sobreponiveis()


# ==========================
# Gera miniaturas das peças que ainda não têm
# ==========================

def gerar_miniaturas_faltantes():

    # Import aqui: imagem_service carrega rembg/numpy (mais pesado)
    from pathlib import Path

    from app.services.imagem_service import gerar_miniatura

    saida = Path("saida")

    db = SessionLocal()

    geradas = 0
    sem_arquivo = []

    try:

        for roupa in db.query(Roupa).filter(Roupa.miniatura_url.is_(None)).all():

            caminho_png = saida / Path(roupa.imagem_url or "").name

            if not roupa.imagem_url or not caminho_png.is_file():
                sem_arquivo.append((roupa.id, roupa.nome))
                continue

            caminho_mini = caminho_png.with_name(f"{caminho_png.stem}_mini.webp")

            caminho_mini.write_bytes(gerar_miniatura(caminho_png.read_bytes()))

            roupa.miniatura_url = f"/saida/{caminho_mini.name}"

            geradas += 1

        db.commit()

    finally:

        db.close()

    print(f"\nMiniaturas geradas: {geradas}")

    if sem_arquivo:

        print("Peças sem o PNG em saida/ (o app usará a imagem grande):")

        for id_, nome in sem_arquivo:
            print(f"  - peça {id_} ({nome})")


gerar_miniaturas_faltantes()

print("\nTabelas criadas/atualizadas!")
