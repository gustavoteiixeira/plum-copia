import React, {useEffect} from "react";

import {
  View,
  Text,
  ActivityIndicator
} from "react-native";

import {
  useUsuario
} from "../context/UserContext";


export default function SplashScreen({navigation}){


    const {
        usuario,
        loading
    } = useUsuario();



    useEffect(()=>{


        if(loading){
            return;
        }


        if(usuario){

            navigation.replace(
                "Home"
            );


        }else{


            navigation.replace(
                "Onboarding"
            );


        }


    },[loading,usuario]);




    return(

        <View
        style={{
            flex:1,
            justifyContent:"center",
            alignItems:"center",
            backgroundColor:"#F7F7F7"
        }}
        >

            <Text
            style={{
                fontSize:40,
                fontWeight:"900",
                color:"#1B1530"
            }}
            >
                PLUM
            </Text>


            <ActivityIndicator
            size="large"
            color="#5A31A9"
            style={{
                marginTop:20
            }}
            />

        </View>

    );

}
