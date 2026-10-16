"""
Testa o envio de e-mail (configuração do Gmail com senha de app).

Uso:
    python testar_email.py seu_email@exemplo.com

Envia um e-mail com um código de exemplo. Se falhar, mostra o motivo.
"""

import logging
import sys

from app.core.config import EMAIL_REMETENTE, EMAIL_SENHA_APP
from app.core.exceptions import FalhaEnvioEmailError
from app.services.email_service import enviar_codigo


logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")


def main():

    if len(sys.argv) != 2:
        print("Uso: python testar_email.py seu_email@exemplo.com")
        return 1

    destino = sys.argv[1]

    print(f"Remetente: {EMAIL_REMETENTE or '(vazio)'}")
    print(f"Senha de app: {'configurada (' + str(len(EMAIL_SENHA_APP)) + ' caracteres)' if EMAIL_SENHA_APP else '(vazia)'}")

    if not EMAIL_REMETENTE or not EMAIL_SENHA_APP:
        print("\n❌ Defina EMAIL_REMETENTE e EMAIL_SENHA_APP no .env do backend.")
        return 1

    if len(EMAIL_SENHA_APP) != 16:
        print("⚠️  A senha de app do Google costuma ter 16 letras. Confira se copiou certo.")

    try:
        enviar_codigo(destino, "123456", "cadastro")
    except FalhaEnvioEmailError:
        print("\n❌ Não foi possível enviar. Veja o motivo na linha ERROR acima.")
        print("   Dicas: verificação em duas etapas ativa? Senha de APP (não a senha normal)?")
        return 1

    print(f"\n✅ E-mail enviado para {destino}. Confira a caixa de entrada e o spam.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
