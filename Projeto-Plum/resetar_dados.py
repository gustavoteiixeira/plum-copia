"""
Apaga TODOS os dados do PLUM para recomeçar os testes do zero:
- todas as tabelas do banco (usuários, roupas, recomendações, métricas);
- as imagens em saida/, temp_previews/ e debug_rembg/.

Depois recria as tabelas (create_tables.py).

Uso:
    python resetar_dados.py
"""

import runpy
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.config import DATABASE_URL
from app.database import engine
from app.models import Base


PASTAS_IMAGENS = ("saida", "temp_previews", "debug_rembg")


def main():

    # Mostra QUAL banco será apagado (sem a senha)
    url = make_url(DATABASE_URL)

    print("\n⚠️  ATENÇÃO: isto apaga TODOS os dados e imagens do PLUM.")
    print(f"   Banco: {url.host}:{url.port or ''}/{url.database}")
    print(f"   Pastas: {', '.join(PASTAS_IMAGENS)}\n")

    if input('Digite APAGAR para confirmar: ').strip() != "APAGAR":
        print("Cancelado. Nada foi apagado.")
        return

    Base.metadata.drop_all(bind=engine)

    print("✔ Tabelas apagadas")

    removidos = 0

    for pasta in PASTAS_IMAGENS:

        caminho = Path(pasta)

        if not caminho.is_dir():
            continue

        for arquivo in caminho.iterdir():

            if arquivo.is_file():
                arquivo.unlink()
                removidos += 1

    print(f"✔ {removidos} arquivo(s) de imagem removido(s)")

    print("\nRecriando as tabelas...")

    runpy.run_path("create_tables.py")


if __name__ == "__main__":
    main()
