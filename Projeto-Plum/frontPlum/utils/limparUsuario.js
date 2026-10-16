import * as SecureStore from 'expo-secure-store';


async function limparUsuario(){

    try{

        await SecureStore.deleteItemAsync(
            "codigo_usuario"
        );


        console.log(
            "Código do usuário removido do SecureStore"
        );


    }catch(error){

        console.log(
            "Erro ao limpar usuário:",
            error.message
        );

    }

}


limparUsuario();