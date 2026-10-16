import * as SecureStore from "expo-secure-store";

import {
    API_URL
} from "../config/api";

import { lerMensagemErro } from "./api";



export async function recomendarLook(prompt){


    const codigoUsuario =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );


    if(!codigoUsuario){

        throw new Error(
            "Usuário não encontrado."
        );

    }



    const resposta = await fetch(
        `${API_URL}/recomendar-look`,
        {
            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body: JSON.stringify({

                prompt: prompt,

                codigo_usuario: codigoUsuario

            })

        }
    );



    if(!resposta.ok){

        const erro =
        await resposta.text();


        console.log(
            "Erro recomendação:",
            erro
        );


        throw new Error(
            "Erro ao gerar recomendação"
        );

    }



    return await resposta.json();

}



// =================================================
// Looks curtidos (👍), do mais recente para o mais antigo
// =================================================

export async function listarOutfits(){

    const codigoUsuario =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );

    if(!codigoUsuario){
        throw new Error("Usuário não encontrado.");
    }

    let resposta;

    try {

        resposta = await fetch(
            `${API_URL}/outfits?codigo_usuario=${encodeURIComponent(codigoUsuario)}`
        );

    } catch (erro) {

        throw new Error(
            "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
        );

    }

    if(!resposta.ok){

        throw new Error(
            await lerMensagemErro(
                resposta,
                "Não foi possível carregar seus outfits."
            )
        );

    }

    return await resposta.json();

}
