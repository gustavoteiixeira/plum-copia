import * as SecureStore from "expo-secure-store";

import {
    API_URL
} from "../config/api";



// =================================================
// Lista roupas do usuário logado
// =================================================

export async function listarMinhasRoupas(){


    const codigo =
    await SecureStore.getItemAsync(
        "codigo_usuario"
    );


    if(!codigo){

        throw new Error(
            "Usuário não encontrado."
        );

    }



    const resposta = await fetch(
        `${API_URL}/roupas/usuario/${codigo}`
    );



    if(!resposta.ok){

        throw new Error(
            "Erro ao carregar roupas."
        );

    }



    return await resposta.json();

}




// =================================================
// Busca detalhes de uma roupa
// =================================================

export async function buscarRoupa(id){

    const codigo =
        await SecureStore.getItemAsync(
            "codigo_usuario"
        );

    const resposta = await fetch(
        `${API_URL}/roupa/${id}?codigo_usuario=${codigo}`
    );

    if(!resposta.ok){

        throw new Error(
            "Roupa não encontrada."
        );

    }

    return await resposta.json();

}



// =================================================
// Excluir roupa
// =================================================

export async function excluirRoupa(id){

    const codigo =
        await SecureStore.getItemAsync(
            "codigo_usuario"
        );

    const resposta = await fetch(
        `${API_URL}/roupa/${id}?codigo_usuario=${codigo}`,
        {
            method:"DELETE"
        }
    );

    if(!resposta.ok){

        throw new Error(
            "Erro ao excluir roupa."
        );

    }

    return true;

}