const SERVER_IP = process.env.EXPO_PUBLIC_SERVER_IP;
const PORT = process.env.EXPO_PUBLIC_PORT;

export const API_URL = `http://${SERVER_IP}:${PORT}`;

console.log("API USADA:", API_URL);
import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";

export const ENDPOINTS = {
  upload: `${API_URL}/remove-bg`,
  roupas: `${API_URL}/roupas`,
  usuario: `${API_URL}/usuario`,
};

// uriVerso é opcional: foto do verso da peça
export async function uploadImagem(uri, uriVerso = null) {
  const codigoUsuario =
    await SecureStore.getItemAsync("codigo_usuario");

  if (!codigoUsuario) {
    throw new Error("Usuário não encontrado.");
  }

  const arquivo = new File(uri);

  const formData = new FormData();

  formData.append("file", arquivo);
  formData.append("codigo_usuario", codigoUsuario);

  if (uriVerso) {
    formData.append("file_verso", new File(uriVerso));
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}/remove-bg`,
      {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch (erro) {
    console.log("Falha de rede:", erro);

    throw new Error(
      "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
    );
  }

  if (!response.ok) {
    throw new Error(
      await lerMensagemErro(
        response,
        "Não foi possível analisar a peça. Tente novamente em instantes."
      )
    );
  }

  return await response.json();
}

async function obterCodigoUsuario() {
  const codigoUsuario =
    await SecureStore.getItemAsync("codigo_usuario");

  if (!codigoUsuario) {
    throw new Error("Usuário não encontrado.");
  }

  return codigoUsuario;
}

// fetch com mensagem amigável para falha de rede
async function requisicao(url, opcoes, mensagemErro) {
  let response;

  try {
    response = await fetch(url, opcoes);
  } catch (erro) {
    console.log("Falha de rede:", erro);

    throw new Error(
      "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
    );
  }

  if (!response.ok) {
    const erro = new Error(await lerMensagemErro(response, mensagemErro));

    // Permite à tela tratar casos específicos (ex.: 410 = prévia expirada)
    erro.status = response.status;

    throw erro;
  }

  return await response.json();
}

// =================================================
// Pré-visualização do recorte (antes da análise)
// =================================================

// Remove o fundo da foto e devolve { id_preview, url }
export async function gerarPreview(uri) {
  const codigoUsuario = await obterCodigoUsuario();

  const formData = new FormData();

  formData.append("file", new File(uri));
  formData.append("codigo_usuario", codigoUsuario);

  return await requisicao(
    `${API_URL}/preview-peca`,
    {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    },
    "Não foi possível processar a foto. Tente novamente."
  );
}

// Gira o recorte 90° no servidor. sentido: "horario" | "anti_horario"
// Devolve { id_preview, url } (a url muda a cada giro, para não usar cache)
export async function girarPreview(idPreview, sentido = "horario") {
  const codigoUsuario = await obterCodigoUsuario();

  return await requisicao(
    `${API_URL}/preview-peca/${idPreview}/girar`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_usuario: codigoUsuario,
        sentido,
      }),
    },
    "Não foi possível girar a imagem. Tente novamente."
  );
}

// Descarta um recorte reprovado (erros são ignorados: a prévia expira sozinha)
export async function descartarPreview(idPreview) {
  try {
    const codigoUsuario = await obterCodigoUsuario();

    await fetch(
      `${API_URL}/preview-peca/${idPreview}?codigo_usuario=${encodeURIComponent(codigoUsuario)}`,
      { method: "DELETE" }
    );
  } catch (erro) {
    console.log("Falha ao descartar prévia:", erro);
  }
}

// Analisa com o Gemini os recortes aprovados e cadastra a peça
export async function analisarPecaAprovada(idPreviewFrente, idPreviewVerso = null) {
  const codigoUsuario = await obterCodigoUsuario();

  return await requisicao(
    `${API_URL}/analisar-peca`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_usuario: codigoUsuario,
        id_preview_frente: idPreviewFrente,
        id_preview_verso: idPreviewVerso,
      }),
    },
    "Não foi possível analisar a peça. Tente novamente em instantes."
  );
}

// Lê a mensagem amigável enviada pelo backend ({"detail": "..."}).
// Se não houver, usa a mensagem padrão.
export async function lerMensagemErro(response, mensagemPadrao) {
  const texto = await response.text();

  console.log("Erro backend:", response.status, texto);

  try {
    const dados = JSON.parse(texto);

    if (typeof dados.detail === "string" && dados.detail) {
      return dados.detail;
    }
  } catch {
    // resposta não era JSON
  }

  return mensagemPadrao;
}

