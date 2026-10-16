import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";


import * as SecureStore from "expo-secure-store";


import {
    buscarUsuario,
    registrarDispositivo
} from "../services/usuarioService";



const UserContext = createContext();



export function UserProvider({children}){


    const [usuario,setUsuario] = useState(null);

    const [loading,setLoading] = useState(true);

    const [autenticado,setAutenticado] = useState(false);



    useEffect(()=>{

        carregarUsuario();

    },[]);




    async function carregarUsuario(){


        try{


            const codigo =
            await SecureStore.getItemAsync(
                "codigo_usuario"
            );



            if(!codigo){

                setLoading(false);

                return;

            }




            const dados =
            await buscarUsuario(codigo);



            if(dados){

                setUsuario(dados);

                setAutenticado(true);

            }
            else{

                await SecureStore.deleteItemAsync(
                    "codigo_usuario"
                );

            } 


        }catch(error){


            console.log(
                "Erro carregar usuário:",
                error.message
            );


        }
        finally{

            setLoading(false);

        }


    }




    // Chamar sempre que o usuário entrar (criar, recuperar ou validar a conta).
    // Sem isso, as telas só veriam o usuário depois de reabrir o app.
    function entrar(dados){
        setUsuario(dados);
        setAutenticado(true);

        // Registra o aparelho (criar, recuperar ou entrar na conta).
        // Não espera nem bloqueia a navegação.
        if(dados?.codigo_recuperacao){
            registrarDispositivo(dados.codigo_recuperacao);
        }
    }

    async function atualizarUsuario(dados){

        setUsuario(dados);

    }




    async function logout(){


        await SecureStore.deleteItemAsync(
            "codigo_usuario"
        );


        setUsuario(null);

        setAutenticado(false);

    }




    return (

        <UserContext.Provider
            value={{
                usuario,
                setUsuario,
                entrar,
                atualizarUsuario,
                logout,
                loading,
                autenticado
            }}
        >

            {children}

        </UserContext.Provider>

    );

}





export function useUsuario(){

    return useContext(
        UserContext
    );

}