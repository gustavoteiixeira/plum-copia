```markdown
# Plum

## Sobre o projeto
O **Plum** é uma aplicação inovadora desenvolvida para auxiliar usuários no gerenciamento do seu guarda-roupa virtual,na composição
 de looks (outfits) e no recebimento de sugestões e recomendações estilísticas personalizadas.
Utilizando inteligência artificial por meio da API do Google Gemini, o Plu analisa as peças de roupa cadastradas e imagens de looks para fornecer
feedback técnico e visual, auxiliando na escolha das melhores combinações para o dia a dia e ocasiões especiais.

## Funcionalidades
* **Gerenciamento de Guarda-Roupa**: Cadastro, listagem e remoção de peças de vestuário.
* **Processamento e Otimização de Imagens**: Remoção automática de fundo de imagens de roupas para catalogação padronizada (utilizando Rembg).
* **Recomendações de Looks Personalizados**: Geração de combinações de roupas com base nas peças cadastradas e preferências do usuário.
* **Avaliação de Looks**: Análise de imagens ou descrições de composições visuais através do Gemini, retornando pontuações e dicas de estilo.
* **Autenticação e Perfil**: Gestão de isolamento por ID de dispositivo (UUID).

## Tecnologias utilizadas

### Backend
* **Python 3.10+**
* **FastAPI**: Framework web de alta performance para a construção da API.
* **SQLAlchemy**: ORM para mapeamento e manipulação de entidades no banco de dados.
* **Pydantic**: Validação de dados e definição de schemas.
* **Google Generative AI SDK (Gemini API)**: Integração para análise inteligente de imagens e geração de recomendações.
* **Rembg / Pillow (PIL)**: Processamento e manipulação de imagens para remoção de fundo (modelo U2NET).
* **Uvicorn**: Servidor ASGI para execução do backend Python.
* **PostgreSQL**: Banco de dados relacional (Supabase/Neon.tech) para salvar metadados e URLs estruturados.
* **Google Cloud Storage**: Armazenamento em nuvem das imagens em PNG.

### Frontend
* **React Native / Expo**: Framework para desenvolvimento mobile multiplataforma.
* **JavaScript / Node.js**

## Arquitetura
O projeto adota uma arquitetura em camadas para o backend (API RESTful), separando responsabilidades de forma clara e sustentável,
integrando armazenamento híbrido (arquivos no Cloud Storage e metadados no PostgreSQL):

```text
┌────────────────────────────────────────────────────────┐
│                   Cliente Mobile                       │
│               (React Native / Expo)                    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼────────────────────────────┐
│                    Routers / Endpoints                 │
│               (Validação via Schemas Pydantic)         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Services / Business                  │
│      (Lógica de Negócio, Gemini API, Rembg)            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 Models / Database Layer                │
│                 (SQLAlchemy / PostgreSQL)              │
└────────────────────────────────────────────────────────┘

```

## Estrutura do projeto

```text
.
├── backendAtual/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── routers/
│   │   │   ├── background_router.py
│   │   │   ├── recomendacao_router.py
│   │   │   ├── roupa_router.py
│   │   │   └── usuario_router.py
│   │   ├── schemas/
│   │   │   ├── recomendacao_schema.py
│   │   │   ├── roupa_schema.py
│   │   │   └── usuario_schema.py
│   │   ├── services/
│   │   │   ├── background_service.py
│   │   │   ├── gemini_service.py
│   │   │   ├── recomendacao_service.py
│   │   │   ├── roupa_service.py
│   │   │   └── usuario_service.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── models.py
│   ├── .env.example
│   ├── create_tables.py
│   └── frontPlum/
│       ├── assets/
│       ├── App.js
│       ├── app.json
│       └── package.json

```

## Pré-requisitos

* **Python 3.10+**
* **Node.js** (v18 ou superior) e **npm** / **yarn**
* Chave de API da **Google Gemini API** (`GEMINI_API_KEY`)
* String de conexão do **PostgreSQL** (Supabase, Neon, etc)

## Instalação

### Backend

1. Navegue até o diretório do backend:
```bash
cd backendAtual

```


2. Crie e ative um ambiente virtual:
```bash
python -m venv venv
# No Linux/macOS:
source venv/bin/activate
# No Windows:
venv\Scripts\activate

```


3. Instale as dependências:
```bash
pip install -r requirements.txt

```



### Frontend

1. Navegue até a pasta do projeto mobile:
```bash
cd backendAtual/frontPlum

```


2. Instale as dependências com npm ou yarn:
```bash
npm install
npx expo install react-native-safe-area-context

```



## Configuração das variáveis de ambiente

No diretório `backendAtual/`, crie um arquivo `.env` baseado no `.env.example`:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GEMINI_API_KEY=sua_chave_da_api_gemini
GEMINI_MODEL=gemini-3.5-flash-lite
REMBG_MODEL=u2net

```

No frontend (`frontPlum`), configure o `.env` informando a URL do backend:

```env
API_URL=http://localhost:8000

```

## Banco de dados

Por padrão, o projeto utiliza **PostgreSQL** para persistência dos metadados extraídos das imagens, utilizando o ORM SQLAlchemy.
Para inicializar e criar as tabelas no banco de dados, execute no diretório `backendAtual`:

```bash
python create_tables.py

```

## Execução

### Backend

Para iniciar o servidor FastAPI com live-reload:

```bash
cd backendAtual
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

```

A API estará acessível em `http://localhost:8000`. As documentações interativas estarão disponíveis em:

* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`

### Frontend

Para iniciar o aplicativo mobile com Expo:

```bash
cd backendAtual/frontPlum
npx expo start

```

## Fluxo da aplicação

1. **Primeiro Acesso**: O app gera um UUID salvo no armazenamento interno, isolando o banco de dados e os arquivos do usuário na nuvem.
2. **Catalogação**: O usuário tira fotos das suas roupas. A foto tem a rotação corrigida e o tamanho reduzido, passa pela remoção de fundo (Rembg, modelo `birefnet-general-lite`) e é recortada e centralizada em um PNG quadrado padronizado. Todo o processamento acontece em memória e fora do event loop, sem travar o servidor.
3. **Análise IA**: O PNG limpo passa pelo Google Gemini para extração textual das características (cor, anatomia, uso social). A imagem e o registro só são salvos se a análise der certo; em caso de falha, o app recebe uma mensagem amigável e nada é gravado.

> **Conferência do recorte:** depois de cada foto, o app mostra o resultado da remoção de fundo (`POST /preview-peca`). Se o recorte ficar ruim, o usuário tira outra foto e a prévia é descartada (`DELETE /preview-peca/{id}`). Só os recortes aprovados vão para o Gemini (`POST /analisar-peca`), sem refazer o processamento. Prévias não usadas ficam em `temp_previews/` e expiram após `PREVIEW_TTL_MIN` minutos.

> **Frente e verso:** além da foto da frente, o usuário pode enviar (opcionalmente) a foto do verso da peça. As duas passam pela remoção de fundo e são analisadas em **uma única requisição** ao Gemini. No guarda-roupa, um toque na imagem vira a peça. Após atualizar o projeto, rode `python create_tables.py` para criar a coluna `imagem_verso_url`.

> Na primeira execução, o rembg baixa o modelo (`~/.u2net`), o que pode levar alguns minutos. O modelo é carregado uma única vez quando o servidor sobe.
4. **Composição e Recomendação**: O usuário solicita sugestões no *Chat Plu* e a IA monta e sugere looks com base nas peças cadastradas.
5. **Avaliação de Look**: O backend aciona o `gemini_service.py`, processa as imagens e descrições das peças disponíveis e retorna a combinação ideal com justificativas, dicas e a opção do usuário favoritar o look.

## Métricas (TCC)

O backend registra cada operação de IA na tabela `metricas_ia`: prévias (remoção de fundo), análises de peça e mensagens do chat. Ficam salvos tempos, tokens (incluindo os vindos do cache) e falhas. Quando uma conta é excluída, as métricas dela ficam sem identificação.

```bash
# Resumo no terminal + CSVs em relatorios/ (metricas_ia, sessoes, resumo)
python relatorio_metricas.py

# Apaga TODOS os dados e imagens e recria as tabelas (pede confirmação)
python resetar_dados.py
```

No app, a tela de Perfil mostra as estatísticas do usuário: peças analisadas, looks recomendados e avaliações.

## Precisão do recorte

Depois do modelo, a máscara passa por `app/services/mascara_service.py`: histerese (recupera áreas claras "em dúvida" conectadas à peça), fechamento de entalhes estreitos, regra de ilhas (mantém detalhes pequenos perto da peça) e preenchimento de buracos. Os ajustes ficam no `.env` (`REMBG_HISTERESE*`, `REMBG_FECHAMENTO_PCT`, `REMBG_ILHAS_PERTO_PCT`, `REMBG_TTA`, `REMBG_PAD_QUADRADO`).

O relatório de métricas mostra "prévias por peça analisada": quanto menor, menos o usuário refaz a foto, ou seja, melhor o recorte.

> Os scripts de teste usados para ajustar o recorte e medir o desempenho (`testar_mascara.py`, `comparar_recortes.py` e `benchmark_imagem.py`) foram removidos do repositório, mas continuam no histórico do Git (commits do PR #13 e do PR #17).

## E-mail (verificação e recuperação de conta)

O cadastro confirma o e-mail com um código de 6 dígitos, e a conta pode ser recuperada pelo e-mail ou pelo código PLU. O envio usa uma conta Gmail com **senha de app**:

1. Crie uma conta Gmail para o app e ative a **verificação em duas etapas**.
2. Em *Conta Google → Segurança → Senhas de app*, gere uma senha (16 letras).
3. No `.env` do backend, preencha `EMAIL_REMETENTE` e `EMAIL_SENHA_APP` (sem espaços).
4. Teste: `python testar_email.py seu_email@exemplo.com`

Os códigos valem 10 minutos, aceitam 5 tentativas e só podem ser reenviados a cada 60 s. No banco fica apenas o hash do código.

## Hospedagem (CPU e memória)

O que mais consome recursos é a remoção de fundo (rembg). Medições em um PC com 6 núcleos (script de benchmark, 1 foto por vez):

| Modelo | Tempo por foto | RAM no pico |
|---|---|---|
| u2netp | 0,33 s | 0,8 GB |
| silueta | 0,61 s | 0,8 GB |
| u2net | 0,54 s | 1,1 GB |
| isnet-general-use | 1,21 s | 1,7 GB |
| birefnet-general-lite | 5,79 s | 11,3 GB |
| birefnet-general / dis / hrsod, bria-rmbg | ~12,3 s | ~12,4 GB |

Recomendações:

- Use um modelo leve (`REMBG_MODEL`) e **1 worker** no uvicorn (cada worker carrega o modelo na própria memória).
- `REMBG_MAX_CONCORRENCIA=1` e `REMBG_THREADS` = nº de vCPUs da máquina.
- A fila (`FILA_MAX_TAMANHO`, `FILA_MAX_ESPERA_S`) recusa com "tente novamente em instantes" quando o servidor está cheio, em vez de deixar a RAM/CPU estourar. A espera aparece no `relatorio_metricas.py`.
- RAM necessária ≈ `REMBG_MAX_CONCORRENCIA` × pico do modelo + folga para o sistema.

## Desenvolvimento

Ao contribuir para o projeto, garanta as seguintes boas práticas:

* Defina schemas Pydantic claros no diretório `app/schemas/` para validação de entrada/saída.
* Isole regras de negócio no diretório `app/services/` e mantenha os `routers` apenas para recebimento de requisições.
* Mantenha as chaves e segredos estritamente no arquivo `.env` e evite versionar credenciais. Adicione a pasta `venv` e os arquivos `.env` no seu `.gitignore`.

## Autores

* **Os Gurí**
