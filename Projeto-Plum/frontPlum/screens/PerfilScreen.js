import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { 
  salvarPerfil,
  excluirUsuario,
  buscarEstatisticas
} from "../services/usuarioService";

import * as Clipboard from "expo-clipboard";

import FormularioCadastro, { validarCadastro } from "../components/FormularioCadastro";

import {
  useUsuario
} from "../context/UserContext";

import { useEscala } from "../styles/escala";

export default function PerfilScreen({ navigation }) {

    // Medidas proporcionais à largura da tela (a tela rola, então a altura não limita)
    const { ew: e, esw: es } = useEscala();
    const r = (n) => Math.round(n * e);
    const styles = useMemo(() => criarStyles({ e, es }), [e, es]);

    const {
      usuario,
      setUsuario
    } = useUsuario();


    // Dados editáveis do perfil
    const [dadosPerfil,setDadosPerfil] = useState({
      nome: usuario?.nome ?? "",
      email: usuario?.email ?? "",
      genero: usuario?.genero ?? null
    });
    const [salvando,setSalvando] = useState(false);
    const [erroPerfil,setErroPerfil] = useState(null);

    // null = carregando ou falhou (o cartão simplesmente não aparece)
    const [estatisticas,setEstatisticas] = useState(null);

    // Quando o usuário em memória muda (login, recuperação), atualiza a tela
    const codigoUsuario = usuario?.codigo_recuperacao;

    useEffect(()=>{

      setDadosPerfil({
        nome: usuario?.nome ?? "",
        email: usuario?.email ?? "",
        genero: usuario?.genero ?? null
      });

    },[codigoUsuario, usuario?.nome, usuario?.email, usuario?.genero]);


    async function salvarDadosPerfil(){

      const problema = validarCadastro(dadosPerfil, { exigirEmail: false });

      if(problema){
        setErroPerfil(problema);
        return;
      }

      try{

        setSalvando(true);
        setErroPerfil(null);

        // O e-mail não é alterado no Perfil (usado para recuperar a conta)
        const usuarioAtualizado = await salvarPerfil({
          nome: dadosPerfil.nome.trim(),
          genero: dadosPerfil.genero
        });

        setUsuario(usuarioAtualizado);

        Alert.alert("Pronto!", "Seu perfil foi atualizado.");

      }catch(error){

        console.log("Erro ao salvar perfil:", error.message);

        // Ex.: "Este e-mail já está em uso."
        setErroPerfil(error.message);

      }finally{

        setSalvando(false);

      }

    }

    useEffect(()=>{

      if(!codigoUsuario){
        setEstatisticas(null);
        return;
      }

      let ativo = true;

      buscarEstatisticas()
        .then((dados)=>{ if(ativo) setEstatisticas(dados); })
        .catch((error)=>{
          console.log("Erro estatísticas:", error.message);
        });

      // Evita mostrar estatísticas de uma conta anterior se a resposta chegar atrasada
      return ()=>{ ativo = false; };

    },[codigoUsuario]);


    async function copiarCodigo(){

        if(!usuario?.codigo_recuperacao){

            return;

        }


        await Clipboard.setStringAsync(
            usuario.codigo_recuperacao
        );


        console.log(
            "Código copiado:",
            usuario.codigo_recuperacao
        );

    }



    async function excluirConta(){


        Alert.alert(
            "Excluir conta",
            "Todos seus dados serão apagados. Deseja continuar?",
            [
                {
                    text:"Cancelar",
                    style:"cancel"
                },

                {
                    text:"Excluir",
                    style:"destructive",

                    async onPress(){

                        try{


                            await excluirUsuario();


                            setUsuario(null);


                            // Zera a pilha: o "voltar" não retorna à conta excluída
                            navigation.reset({
                                index: 0,
                                routes: [{ name: "Onboarding" }]
                            });


                        }catch(error){


                            console.log(
                                "Erro excluir:",
                                error.message
                            );


                        }

                    }

                }
            ]
        );

    }



  //===================================================================================================
  return (

    <SafeAreaView style={styles.container}>

      {/* HEADER */}

      <View style={styles.header}>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="close"
            size={28}
            color="#fdfdfd"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Meu Perfil
        </Text>

        <View style={{ width: 28 }} />

      </View>


      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

      {/* Avatar */}

      <View style={styles.avatarContainer}>

        <Ionicons
          name="person-circle"
          size={r(85)}
          color="#f6f1ff"
        />

      </View>


      {/* Estatísticas */}

      {estatisticas && (

        <View style={[styles.card, styles.statsCard]}>

          <Text style={styles.statsTitulo}>
            Suas estatísticas
          </Text>

          <View style={styles.statsRow}>

            <View style={styles.statItem}>
              <Text style={styles.statValor}>
                {estatisticas.pecas_analisadas}
              </Text>
              <Text style={styles.statLabel}>
                Peças analisadas
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValor}>
                {estatisticas.recomendacoes}
              </Text>
              <Text style={styles.statLabel}>
                Looks recomendados
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValor}>
                {estatisticas.avaliadas}
              </Text>
              <Text style={styles.statLabel}>
                Looks avaliados
              </Text>
            </View>

          </View>

          <Text style={styles.statsAvaliacoes}>
            👍 {estatisticas.gostei}   ·   👎 {estatisticas.nao_gostei}
          </Text>

        </View>

      )}


      {/* Card */}

      <View style={styles.card}>

        <Text style={styles.label}>
          Código de recuperação
        </Text>

        <Text style={styles.codigo}>
        {usuario?.codigo_recuperacao ?? ""}
        </Text> 


        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={copiarCodigo}
        >

          <Text style={styles.secondaryButtonText}>
            Copiar código
          </Text>

        </TouchableOpacity>



        <FormularioCadastro
          valores={dadosPerfil}
          onChange={setDadosPerfil}
          onEnviar={salvarDadosPerfil}
          textoBotao="Salvar"
          emailEditavel={false}
          enviando={salvando}
          erro={erroPerfil}
        />



          <TouchableOpacity
          style={styles.deleteButton}
          onPress={excluirConta}
          >

          <Text style={styles.deleteText}>
            Excluir conta
          </Text>

        </TouchableOpacity>

      </View>

      </ScrollView>

    </SafeAreaView>

  );

}

// e: escala cheia (tamanhos); es: escala suave (textos). Ver styles/escala.js
function criarStyles({ e, es }) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;

  return StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:"#452887"
  },

  header:{
    // Mesma altura de "Meu Guarda-roupas", "Adicionar Peças" e do Chat
    height:85,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:r(20)
  },

  headerTitle:{
    fontSize:rt(21),
    fontWeight:"700",
    color:"#ffffff"
  },

  scrollContent:{
    paddingHorizontal:r(20),
    paddingBottom:r(30),
    alignItems:"center"
  },

  statsCard:{
    marginBottom:r(16),
    paddingVertical:r(16)
  },

  statsTitulo:{
    fontSize:rt(17),
    fontWeight:"700",
    color:"#452887",
    marginBottom:r(18),
  },

  statsRow:{
    flexDirection:"row",
    justifyContent:"space-between"
  },

  statItem:{
    flex:1,
    alignItems:"center"
  },

  statValor:{
    fontSize:rt(24),
    fontWeight:"700",
    color:"#452887"
  },

  statLabel:{
    marginTop:r(4),
    fontSize:rt(13.5),
    color:"#777",
    textAlign:"center"
  },

  statsAvaliacoes:{
    marginTop:r(12),
    textAlign:"center",
    fontSize:rt(15.5),
    color:"#555"
  },

  avatarContainer:{
    alignItems:"center",
    marginBottom:r(20)
  },

  card:{
    // Largura total até 560 dp, centralizado (as margens ficam no scrollContent)
    width:"100%",
    maxWidth:560,
    backgroundColor:"#FFF",
    borderRadius:r(20),
    padding:r(22),
    elevation:2
  },

  label:{
    fontSize:rt(15.5),
    color:"#555",
    marginBottom:r(8),
    marginTop:r(10)
  },

  input:{
    borderWidth:1,
    borderColor:"#DDD",
    borderRadius:r(12),
    height:r(48),
    paddingHorizontal:r(15)
  },

  codigo:{
    fontSize:rt(18),
    fontWeight:"700",
    color:"#5A31A9",
    marginTop:r(5),
    marginBottom:r(20)
  },

  secondaryButton:{
    height:r(52),
    borderRadius:r(26),
    borderWidth:1,
    borderColor:"#5A31A9",
    justifyContent:"center",
    alignItems:"center",
    marginBottom:r(15)
  },

  secondaryButtonText:{
    color:"#5A31A9",
    fontWeight:"600",
    fontSize:rt(17)
  },

  primaryButton:{
    height:r(50),
    borderRadius:r(25),
    backgroundColor:"#5A31A9",
    justifyContent:"center",
    alignItems:"center"
  },

  primaryButtonText:{
    color:"#FFF",
    fontWeight:"700",
    fontSize:rt(16)
  },

  deleteText:{
    color:"#D62828",
    textAlign:"center",
    fontWeight:"600",
    fontSize:rt(17)
  },

  // Área de toque maior para o "Excluir conta"
  deleteButton:{
    marginTop:r(22),
    paddingVertical:r(12),
    alignItems:"center"
  }

  });
}
