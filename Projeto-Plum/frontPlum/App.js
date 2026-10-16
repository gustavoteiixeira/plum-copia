
//import './utils/limparUsuario';

import React from "react";

import {
    UserProvider,
    useUsuario
} from "./context/UserContext";


import AppNavigator from "./navigation/AppNavigator";

import {
    ActivityIndicator,
    View
} from "react-native";



function Root(){

    const {
        usuario,
        loading
    } = useUsuario();



    if(loading){

        return(

            <View
            style={{
                flex:1,
                justifyContent:"center",
                alignItems:"center"
            }}
            >

                <ActivityIndicator
                size="large"
                color="#5A31A9"
                />

            </View>

        );

    }


    return(
        <AppNavigator
            initialRoute={
                usuario
                ?
                "Home"
                :
                "Onboarding"
            }
        />
    );

}




export default function App(){

    return(

        <UserProvider>

            <Root/>

        </UserProvider>

    );

}