from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Boolean
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import declarative_base,relationship

Base = declarative_base()

class Usuario(Base):

    __tablename__ = "usuarios"


    # ID interno do banco
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )


    # UUID de recuperação/login
    # Exemplo: PLU-8F92KX4M7Q
    codigo_recuperacao = Column(
        String(30),
        unique=True,
        nullable=False,
        index=True
    )


    # Nome do usuário (obrigatório no cadastro)
    nome = Column(
        String(100),
        nullable=True
    )


    # E-mail (obrigatório no cadastro, único). Guardado em minúsculas.
    email = Column(
        String(255),
        unique=True,
        nullable=True,
        index=True
    )


    # Feminino | Masculino | Prefiro não informar
    genero = Column(
        String(30),
        nullable=True
    )


    criado_em = Column(
        DateTime,
        nullable=True
    )


    # Aparelhos em que a conta foi usada
    dispositivos = relationship(
        "Dispositivo",
        cascade="all, delete"
    )


    # relacionamento com roupas
    roupas = relationship(
        "Roupa",
        back_populates="usuario",
        cascade="all, delete"
    )

    recomendacoes = relationship(
        "Recomendacao",
        cascade="all, delete"
    )

class Roupa(Base):

    __tablename__ = "roupas"

    #===================
    # Identificação
    #===================

    id = Column(Integer, primary_key=True, index=True,autoincrement=True)

    # Usuário dono da peça
    usuario_id = Column(
        Integer,
        ForeignKey(
            "usuarios.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    # Nome amigável da peça
    nome = Column(String(100), nullable=False)

    #===================
    # Classificação
    #===================

    # Camiseta, camisa, calça jeans, vestido...
    tipo = Column(String(50), nullable=False)

    # Superior, Inferior, Calçado, Acessório...
    categoria = Column(String(30), nullable=False)

    #===================
    # Características
    #===================
    # ["preto", "branco"]
    cores = Column(JSON, nullable=False)

    # ["neutras"]
    paleta_cores = Column(JSON, nullable=False)

    # Casual, Streetwear...
    estilo = Column(String(50), nullable=False)

    # Casual, Social, Formal...
    formalidade = Column(String(30), nullable=False)

    # Algodão, Jeans...
    tecido = Column(String(50), nullable=True)

    #===================
    # Contexto de uso
    #===================

    # ["faculdade", "trabalho", "festa"]
    ocasioes = Column(JSON, nullable=False)

    # ["verão", "primavera"]
    estacoes = Column(JSON, nullable=False)

    #===================
    # Descrição
    #===================

    # Texto completo gerado pelo Gemini
    descricao = Column(Text, nullable=False)

    # URL da imagem processada (frente)
    imagem_url = Column(String(255),nullable=False)

    # URL da foto do verso (opcional)
    imagem_verso_url = Column(String(255), nullable=True)

    # Peça superior que também pode ser usada aberta por cima de outra
    # (ex.: camisa de botão). Peças da categoria Sobreposição são sempre True.
    pode_sobrepor = Column(Boolean, nullable=False, default=False, server_default="false")

    # Imagem pequena (WebP 256 px) usada nas listas do app
    miniatura_url = Column(String(255), nullable=True)
    
    # relacionamento com usuario
    usuario = relationship(
        "Usuario",
        back_populates="roupas"
    )


class Recomendacao(Base):

    __tablename__ = "recomendacoes"


    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )


    usuario_id = Column(
        Integer,
        ForeignKey(
            "usuarios.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )


    prompt = Column(
        Text,
        nullable=False
    )


    justificativa = Column(
        Text,
        nullable=True
    )


    # Peças utilizadas no look

    parte_superior_id = Column(
        Integer,
        nullable=True
    )


    parte_inferior_id = Column(
        Integer,
        nullable=True
    )


    calcado_id = Column(
        Integer,
        nullable=True
    )


    sobreposicao_id = Column(
        Integer,
        nullable=True
    )


    acessorio_id = Column(
        Integer,
        nullable=True
    )


    # Vestido/macacão: substitui parte superior e inferior
    peca_unica_id = Column(
        Integer,
        nullable=True
    )


    # Avaliação futura do usuário
    # 1 = gostei
    # 0 = não gostei
    # NULL = ainda não avaliou

    avaliacao = Column(
        Boolean,
        nullable=True
    )


    criado_em = Column(
        DateTime,
        nullable=False
    )


    # Quando o usuário deu 👍/👎 (marca o fim da decisão numa sessão)
    avaliado_em = Column(
        DateTime,
        nullable=True
    )


    # True = 👎 dado automaticamente porque o usuário saiu do chat sem avaliar
    avaliacao_automatica = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )


class MetricaIA(Base):
    """Uma linha por operação de IA (prévia, análise ou recomendação)."""

    __tablename__ = "metricas_ia"


    id = Column(Integer, primary_key=True, index=True, autoincrement=True)


    # SET NULL: ao excluir a conta, a métrica fica sem identificação
    usuario_id = Column(
        Integer,
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )


    # preview | analise_peca | recomendacao
    tipo = Column(String(20), nullable=False, index=True)

    sucesso = Column(Boolean, nullable=False)

    # Nome do erro quando falhou (ex.: FalhaIAError)
    erro = Column(String(60), nullable=True)

    # Só recomendação: look | resposta | fora_do_tema
    tipo_resposta = Column(String(20), nullable=True)

    # Só análise: foi enviada a foto do verso?
    com_verso = Column(Boolean, nullable=True)

    # Só recomendação com look: repetiu exatamente uma combinação do histórico?
    look_repetido = Column(Boolean, nullable=True)

    modelo = Column(String(60), nullable=True)


    # Milissegundos
    tempo_fila_ms = Column(Integer, nullable=True)

    tempo_rembg_ms = Column(Integer, nullable=True)

    tempo_gemini_ms = Column(Integer, nullable=True)

    tempo_total_ms = Column(Integer, nullable=True)


    tokens_entrada = Column(Integer, nullable=True)

    tokens_cache = Column(Integer, nullable=True)

    tokens_saida = Column(Integer, nullable=True)


    criado_em = Column(DateTime, nullable=False, index=True)


class Dispositivo(Base):
    """
    Aparelho em que a conta foi usada (prova de uso em celulares reais).
    Uma conta pode ter vários (ex.: recuperou a conta em outro celular).
    """

    __tablename__ = "dispositivos"


    id = Column(Integer, primary_key=True, index=True, autoincrement=True)


    usuario_id = Column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


    # False = emulador/simulador
    celular_real = Column(Boolean, nullable=True)

    marca = Column(String(60), nullable=True)

    fabricante = Column(String(60), nullable=True)

    modelo = Column(String(100), nullable=True)

    # Android | iOS
    sistema = Column(String(30), nullable=True)

    versao_sistema = Column(String(30), nullable=True)

    # celular | tablet | desktop | tv | desconhecido
    tipo = Column(String(20), nullable=True)

    versao_app = Column(String(20), nullable=True)


    primeiro_acesso = Column(DateTime, nullable=False)

    ultimo_acesso = Column(DateTime, nullable=False)


class CodigoEmail(Base):
    """
    Código de 6 dígitos enviado por e-mail.
    Guarda só o hash (com sal), nunca o código em si.
    """

    __tablename__ = "codigos_email"


    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    email = Column(String(255), nullable=False, index=True)

    # cadastro | recuperacao (um código não serve para a outra finalidade)
    finalidade = Column(String(20), nullable=False)

    sal = Column(String(32), nullable=False)

    codigo_hash = Column(String(64), nullable=False)

    tentativas = Column(Integer, nullable=False, default=0)

    # True depois de usado, invalidado por um código novo ou por excesso de tentativas
    usado = Column(Boolean, nullable=False, default=False)

    criado_em = Column(DateTime, nullable=False)

    expira_em = Column(DateTime, nullable=False)
