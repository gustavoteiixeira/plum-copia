import * as SecureStore from 'expo-secure-store';

import { API_URL } from "../config/api";
import { lerMensagemErro } from "./api";
import { obterInfoDispositivo } from "./dispositivo";

const MENSAGEM_SEM_CONEXAO =
    "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";



// =================================================
// Verifica se existe usuário salvo no aparelho
// =================================================

export async function verificarUsuarioLocal(){

    const codigo =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );


    return codigo;

}



// =================================================
// Cria um novo usuário
// =================================================

// dados: { nome, email, genero }
export async function criarUsuario(dados){


    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/usuario/criar`,
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify(dados)
            }
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }


    if(!resposta.ok){

        // Ex.: 409 "Este e-mail já está em uso."
        throw new Error(
            await lerMensagemErro(
                resposta,
                "Erro ao criar sua conta. Tente novamente."
            )
        );

    }


    const usuario = await resposta.json();



    await SecureStore.setItemAsync(
        "codigo_usuario",
        usuario.codigo_recuperacao
    );



    return usuario;

}



// =================================================
// Busca usuário no backend pelo código salvo
// =================================================

export async function buscarUsuario(codigo){

    console.log(
        `${API_URL}/usuario/verificar/${codigo}`
    );

    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/usuario/verificar/${codigo}`
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }


    // null SÓ quando a conta não existe mais (404).
    // Outros erros (429, 500...) lançam exceção para quem chamou
    // NÃO apagar o código salvo no celular.
    if(resposta.status === 404){

        return null;

    }

    if(!resposta.ok){

        throw new Error(
            await lerMensagemErro(
                resposta,
                "Não foi possível verificar sua conta. Tente novamente."
            )
        );

    }



    return await resposta.json();

}



// =================================================
// Recupera conta por código informado pelo usuário
// =================================================

export async function recuperarUsuario(codigo){


    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/usuario/recuperar?codigo=${encodeURIComponent(codigo)}`,
            {
                method:"POST"
            }
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }



    if(!resposta.ok){

        // Mostra a mensagem do servidor (ex.: 429 "Muitas tentativas...")
        throw new Error(
            await lerMensagemErro(
                resposta,
                "Código inválido"
            )
        );

    }



    const usuario = await resposta.json();



    await SecureStore.setItemAsync(
        "codigo_usuario",
        usuario.codigo_recuperacao
    );



    return usuario;

}

// =================================================
// Atualiza dados do perfil do usuário
// =================================================

// dados: { nome?, email?, genero? } (só os campos enviados mudam)
export async function salvarPerfil(dados){

    const codigo =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );

    if(!codigo){
        throw new Error("Usuário não encontrado no aparelho");
    }

    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/usuario/${encodeURIComponent(codigo)}`,
            {
                method:"PUT",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify(dados)
            }
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }

    if(!resposta.ok){

        throw new Error(
            await lerMensagemErro(
                resposta,
                "Não foi possível salvar o perfil."
            )
        );

    }

    return await resposta.json();

}


export async function excluirUsuario(){


    const codigo =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );


    if(!codigo){

        throw new Error(
            "Usuário não encontrado"
        );

    }



    const resposta = await fetch(
        `${API_URL}/usuario/${codigo}`,
        {
            method:"DELETE"
        }
    );



    if(!resposta.ok){

        throw new Error(
            "Erro ao excluir usuário"
        );

    }



    await SecureStore.deleteItemAsync(
        "codigo_usuario"
    );


    return true;

}


// =================================================
// Estatísticas exibidas no Perfil
// { pecas_analisadas, recomendacoes, avaliadas, gostei, nao_gostei }
// =================================================

export async function buscarEstatisticas(){

    const codigo =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );

    if(!codigo){
        throw new Error("Usuário não encontrado.");
    }

    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/usuario/${encodeURIComponent(codigo)}/estatisticas`
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }

    if(!resposta.ok){

        throw new Error(
            await lerMensagemErro(
                resposta,
                "Não foi possível carregar as estatísticas."
            )
        );

    }

    return await resposta.json();

}


// =================================================
// Registra o aparelho em uso (falhas são ignoradas)
// =================================================

export async function registrarDispositivo(codigo){

    try {

        const resposta = await fetch(
            `${API_URL}/usuario/${encodeURIComponent(codigo)}/dispositivo`,
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify(obterInfoDispositivo())
            }
        );

        if(!resposta.ok){
            console.log(
                "Servidor recusou o registro do dispositivo:",
                resposta.status,
                await resposta.text()
            );
        }

    } catch (erro) {

        console.log("Falha ao registrar dispositivo:", erro.message);

    }

}


// =================================================
// Verificação e recuperação por e-mail
// =================================================

// POST JSON com mensagens amigáveis (lança Error com a mensagem do servidor)
async function postarJson(caminho, corpo, mensagemPadrao){

    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}${caminho}`,
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify(corpo)
            }
        );

    } catch (erro) {

        throw new Error(MENSAGEM_SEM_CONEXAO);

    }

    if(!resposta.ok){

        throw new Error(
            await lerMensagemErro(resposta, mensagemPadrao)
        );

    }

    return await resposta.json();

}


// Cadastro: confere nome/e-mail/gênero e envia o código ao e-mail
export async function enviarCodigoCadastro(dados){

    return await postarJson(
        "/usuario/cadastro/enviar-codigo",
        dados,
        "Não foi possível enviar o código. Tente novamente."
    );

}


// Recuperação: sempre devolve a mesma mensagem (não revela se o e-mail existe)
export async function enviarCodigoRecuperacao(email){

    return await postarJson(
        "/usuario/recuperar-email/enviar-codigo",
        { email },
        "Não foi possível enviar o código. Tente novamente."
    );

}


// Recuperação: confere o código e entra na conta
export async function confirmarRecuperacaoEmail(email, codigo){

    const usuario = await postarJson(
        "/usuario/recuperar-email/confirmar",
        { email, codigo },
        "Não foi possível confirmar o código."
    );

    await SecureStore.setItemAsync(
        "codigo_usuario",
        usuario.codigo_recuperacao
    );

    return usuario;

}
