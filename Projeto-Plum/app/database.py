from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import DATABASE_URL



engine = create_engine(
    DATABASE_URL,
    # Testa a conexão antes de usar: Neon/Supabase fecham conexões ociosas
    pool_pre_ping=True,
    # Recicla conexões a cada 5 min para não usar uma já encerrada
    pool_recycle=300
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)