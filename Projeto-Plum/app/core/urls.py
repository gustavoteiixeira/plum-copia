"""
URLs públicas das imagens.

O banco guarda só o caminho (ex.: "/saida/roupa_abc.png").
A URL completa é montada na hora de responder, com o APP_URL do .env.
Assim, se o IP/domínio do servidor mudar, basta editar o .env.
"""

from app.core.config import APP_URL


def url_publica(caminho):

    if not caminho:
        return caminho

    # Registro antigo (ainda com a URL completa): devolve como está
    if caminho.startswith(("http://", "https://")):
        return caminho

    return f"{APP_URL.rstrip('/')}/{caminho.lstrip('/')}"
