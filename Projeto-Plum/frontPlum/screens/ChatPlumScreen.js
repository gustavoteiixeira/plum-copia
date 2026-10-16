import React, { useState, useEffect, useMemo } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from "../config/api";
import { lerMensagemErro } from "../services/api";
import * as SecureStore from "expo-secure-store";
import { useEscala } from "../styles/escala";


export default function ChatPlumScreen({ navigation }) {


const [mensagem,setMensagem] = useState("");
const [digitando,setDigitando] = useState(false);
const [pecaSelecionada, setPecaSelecionada] = useState(null);
const scrollRef = React.useRef();

// Área segura (barra de gestos) e estado do teclado: a caixa de envio
// fica colada no teclado quando ele está aberto
const insets = useSafeAreaInsets();

// Medidas proporcionais ao tamanho real da tela
// (o Chat rola, então a escala vem só da largura da tela)
const { ew: e, esw: es } = useEscala();
const r = (n) => Math.round(n * e);
const styles = useMemo(() => criarStyles({ e, es }), [e, es]);
const [tecladoAberto,setTecladoAberto] = useState(false);

useEffect(()=>{
  // No iOS o "Will" acompanha a animação do teclado; no Android só existe o "Did"
  const ios = Platform.OS === "ios";
  const mostrar = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow",()=>setTecladoAberto(true));
  const esconder = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide",()=>setTecladoAberto(false));
  return ()=>{ mostrar.remove(); esconder.remove(); };
},[]);
const pontos = [
  React.useRef(new Animated.Value(0)).current,
  React.useRef(new Animated.Value(0)).current,
  React.useRef(new Animated.Value(0)).current,
];


const animacoes = React.useRef([]);

  function iniciarAnimacaoDigitando(){

    animacoes.current = pontos.map((ponto,index)=>{

      const animacao = Animated.loop(

        Animated.sequence([

          Animated.delay(index * 300),

          Animated.timing(
            ponto,
            {
              toValue:1,
              duration:300,
              useNativeDriver:true,
            }
          ),

          Animated.timing(
            ponto,
            {
              toValue:0,
              duration:300,
              useNativeDriver:true,
            }
          ),

        ])

      );

      animacao.start();

      return animacao;

    });

  }

  function pararAnimacaoDigitando(){

    animacoes.current.forEach(animacao=>{
      animacao.stop();
    });

    pontos.forEach(ponto=>{
      ponto.setValue(0);
    });

  }

  const [conversas,setConversas] = useState([
  {
    tipo:"plu",
    texto:"Olá! eu sou o Plu. O que você vai vestir hoje?"
  }
  ]);


  async function enviarMensagem(){


  if(!mensagem.trim()){
  return;
  }



  const mensagemUsuario = {

  tipo:"usuario",

  texto:mensagem

  };



  setConversas(prev => [

  ...prev,

  mensagemUsuario

  ]);



  const textoEnviado = mensagem;


  setMensagem("");



  try{

    setDigitando(true);
    iniciarAnimacaoDigitando();


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

        body:JSON.stringify({

          prompt:textoEnviado,

          codigo_usuario:codigoUsuario

        })

      }
    );


  if(!resposta.ok){
  throw new Error(
    await lerMensagemErro(
      resposta,
      "Não consegui montar um look agora. Tente novamente em instantes."
    )
  );
  }


  const dados = await resposta.json();

  pararAnimacaoDigitando();
  setDigitando(false);

  const temLook =
  dados.look &&
  (
  dados.look.peca_unica ||
  dados.look.parte_superior ||
  dados.look.parte_inferior ||
  dados.look.calcado ||
  dados.look.sobreposicao ||
  dados.look.acessorio
  );


  setConversas(prev => [

  ...prev,

  {
  tipo:"plu",
  texto:dados.justificativa,
  look: temLook ? dados.look : null,
  idRecomendacao:dados.id_recomendacao,
  // null = sem avaliação | 1 = gostei | 0 = não gostei
  avaliacao:null,
  avaliando:false
  }

  ]);



  }catch(error){
  
  pararAnimacaoDigitando();
  setDigitando(false);

  console.log(
  "Erro chat:",
  error.message
  );

  // Mostra o erro como resposta do Plu, para o usuário não ficar sem retorno
  setConversas(prev => [

  ...prev,

  {
  tipo:"plu",
  texto:
    error.message === "Network request failed"
      ? "Não consegui me conectar ao servidor. Verifique sua internet e tente novamente."
      : error.message,
  look:null
  }

  ]);


  }



  }

  function renderDetalhePeca(){

  if(!pecaSelecionada){
    return null;
  }


  return(

  <Modal

  visible={true}

  transparent={true}

  animationType="slide"

  onRequestClose={() => setPecaSelecionada(null)}

  >


  <View style={styles.modalBackground}>


  <View style={styles.modalCard}>


  <TouchableOpacity

  style={styles.closeModal}

  onPress={() => setPecaSelecionada(null)}

  >

  <Ionicons

  name="close"

  size={r(28)}

  color="#555"

  />

  </TouchableOpacity>



  <Image

  source={{
  uri:pecaSelecionada.imagem
  }}

  style={styles.modalImage}

  resizeMode="contain"

  />



  <Text style={styles.modalNome}>

  {pecaSelecionada.nome}

  </Text>



  <Text style={styles.modalCategoria}>

  {pecaSelecionada.categoria}

  </Text>



  <Text style={styles.modalDescricao}>

  {pecaSelecionada.descricao}

  </Text>


  </View>


  </View>


  </Modal>

  )

  }

  
  {/* CARD DE LOOK */}
  function renderLookCard(
    look,
    idRecomendacao,
    avaliacao,
    avaliando,
    indice
  ){

    if(
    !look ||
    (
    !look.peca_unica &&
    !look.parte_superior &&
    !look.parte_inferior &&
    !look.calcado &&
    !look.sobreposicao &&
    !look.acessorio
    )
    ){
    return null;
    }

    const pecas = [

      look.peca_unica,
      look.parte_superior,
      look.parte_inferior,
      look.calcado,
      look.sobreposicao,
      look.acessorio

    ].filter(Boolean);


    return (

      <View style={styles.lookRow}>


        <Image
          source={require('../assets/images/plu-icon.png')}
          style={styles.chatAvatar}
        />


        <View style={styles.lookCard}>


          <View style={styles.lookHeader}>

            <Text style={styles.lookTitle}>
              Looks selecionados
            </Text>


            <Ionicons
              name="heart"
              size={r(12)}
              color="#6B3CB4"
            />

          </View>



          <View style={styles.lookGrid}>


            {
              pecas.map((peca)=>(

                <TouchableOpacity

                  key={String(peca.id)}

                  style={styles.lookItem}

                  onPress={() => setPecaSelecionada(peca)}

                >

                <Image

                  source={{
                    // Miniatura nos quadradinhos; detalhes usam a imagem grande
                    uri:peca.miniatura || peca.imagem
                  }}

                  style={styles.lookImage}

                  resizeMode="contain"

                />

                </TouchableOpacity>

              ))
            }


          </View>


          <Text style={styles.feedbackText}>
            Essa sugestão foi boa?
          </Text>


          <View style={styles.feedbackIcons}>


          <TouchableOpacity
          onPress={() =>
            avaliarLook(indice, idRecomendacao, 1)
          }
          disabled={avaliando}
          style={[
            styles.feedbackButton,
            avaliacao === 1 && styles.feedbackGostei
          ]}
          >

            <Ionicons
            name={avaliacao === 1 ? "thumbs-up" : "thumbs-up-outline"}
            size={r(18)}
            color={avaliacao === 1 ? "#FFFFFF" : "#404040"}
            />

            </TouchableOpacity>



            <TouchableOpacity
            onPress={() =>
              avaliarLook(indice, idRecomendacao, 0)
            }
            disabled={avaliando}
            style={[
              styles.feedbackButton,
              avaliacao === 0 && styles.feedbackNaoGostei
            ]}
            >

            <Ionicons
            name={avaliacao === 0 ? "thumbs-down" : "thumbs-down-outline"}
            size={r(18)}
            color={avaliacao === 0 ? "#FFFFFF" : "#404040"}
            />

            </TouchableOpacity>


          </View>


        </View>


      </View>

    );

  }

  // Envia a avaliação ao servidor (lança erro se falhar)
  async function enviarAvaliacao(id, avaliacao, automatica = false){

    // O backend só aceita a avaliação do dono da recomendação
    const codigoUsuario =
      await SecureStore.getItemAsync(
        "codigo_usuario"
      );

    if(!codigoUsuario){
      throw new Error("Usuário não encontrado.");
    }

    const resposta = await fetch(
      `${API_URL}/recomendacao/${id}/avaliar`,
      {
        method:"PUT",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          avaliacao,
          codigo_usuario:codigoUsuario,
          // true só no "Sair mesmo assim" (👎 automático)
          automatica
        })
      }
    );

    if(!resposta.ok){
      throw new Error("Erro ao salvar avaliação");
    }

  }


  function atualizarConversa(indice, campos){

    setConversas(prev =>
      prev.map((item, i) =>
        i === indice ? { ...item, ...campos } : item
      )
    );

  }


  // Toque no 👍/👎: muda a cor na hora e desfaz se o servidor falhar.
  // Pode trocar a avaliação depois (vale a última).
  async function avaliarLook(indice, id, avaliacao){

    if(!id){
      console.log("Recomendação sem ID");
      return;
    }

    const anterior = conversas[indice]?.avaliacao ?? null;

    if(anterior === avaliacao){
      return;
    }

    atualizarConversa(indice, { avaliacao, avaliando:true });

    try{

      await enviarAvaliacao(id, avaliacao);

      atualizarConversa(indice, { avaliando:false });

      console.log("Avaliação enviada");

    }catch(error){

      console.log("Erro avaliação:", error.message);

      atualizarConversa(indice, { avaliacao:anterior, avaliando:false });

      Alert.alert(
        "Ops!",
        "Não foi possível salvar sua avaliação. Tente novamente."
      );

    }

  }


  // ==========================
  // Aviso ao sair com looks sem avaliação
  // ==========================

  // Posição (y) de cada mensagem no chat, para rolar até o look pendente
  const posicoes = React.useRef({});

  const indicesPendentes = conversas
    .map((item, i) => (item.look && item.idRecomendacao && item.avaliacao === null ? i : -1))
    .filter(i => i >= 0);

  // Ação de saída aguardando os 👎 automáticos serem marcados
  const [acaoSaida, setAcaoSaida] = useState(null);

  // Intercepta toda forma de sair (✖, voltar do Android, gesto)
  // enquanto houver look sem avaliação
  usePreventRemove(
    indicesPendentes.length > 0 && !acaoSaida,
    ({ data }) => {

      const qtd = indicesPendentes.length;

      Alert.alert(
        qtd === 1
          ? "Você tem 1 look sem avaliação"
          : `Você tem ${qtd} looks sem avaliação`,
        "Sua avaliação ajuda o Plu a acertar mais. Se sair agora, " +
          (qtd === 1 ? "o look sem avaliação será marcado" : "os looks sem avaliação serão marcados") +
          " como \"não gostei\" 👎.",
        [
          {
            text:"Voltar e avaliar",
            style:"cancel",
            onPress: rolarParaPendente
          },
          {
            text:"Sair mesmo assim",
            style:"destructive",
            onPress: () => sairComDeslike(data.action)
          }
        ]
      );

    }
  );

  function rolarParaPendente(){

    const y = posicoes.current[indicesPendentes[0]];

    if(y !== undefined){
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated:true });
    }

  }

  async function sairComDeslike(acao){

    const pendentes = indicesPendentes.map(i => conversas[i]);

    // Envia os 👎 automáticos; se algum falhar, sai mesmo assim
    const resultados = await Promise.allSettled(
      pendentes.map(item => enviarAvaliacao(item.idRecomendacao, 0, true))
    );

    resultados
      .filter(r => r.status === "rejected")
      .forEach(r => console.log("Falha no 👎 automático:", r.reason?.message));

    // Marca localmente e libera a saída (o efeito abaixo despacha a ação)
    setConversas(prev =>
      prev.map(item =>
        item.look && item.idRecomendacao && item.avaliacao === null
          ? { ...item, avaliacao:0 }
          : item
      )
    );

    setAcaoSaida(acao);

  }

  useEffect(() => {

    if(acaoSaida){
      navigation.dispatch(acaoSaida);
    }

  }, [acaoSaida]);


  return (
      <KeyboardAvoidingView

      style={{flex:1}}

      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }

      // Nada fica acima do KeyboardAvoidingView, então não há deslocamento a compensar
      keyboardVerticalOffset={0}

      >

      <SafeAreaView style={styles.container} edges={['top','left','right']}>

      {/* HEADER */}
      <View style={styles.header}>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="close"
            size={r(28)}
            color="#8A8A8A"
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>

          <Image
            source={require('../assets/images/plu-icon.png')}
            style={styles.headerAvatar}
          />

          <View>
            <Text style={styles.headerTitle}>
              Plu
            </Text>

            <Text style={styles.headerSubtitle}>
              Estilista
            </Text>
          </View>

        </View>

        <View style={{ width: r(28) }} />

      </View>

      <ScrollView

      ref={scrollRef}

      showsVerticalScrollIndicator={false}

      keyboardShouldPersistTaps="handled"

      contentContainerStyle={styles.chatContent}

      onContentSizeChange={() =>
      scrollRef.current?.scrollToEnd({
      animated:true

      })
      
      }


      
      >
        {/* MENSAGEM DO USUÁRIO */}
        {
          conversas.map((item,index)=>(


            item.tipo === "usuario" ? (


              <View 
                key={index}
                style={styles.userRow}
              >

                <View style={styles.userBubble}>

                  <Text style={styles.userText}>
                    {item.texto}
                  </Text>

                </View>


                <View style={styles.userIcon}>

                  <Ionicons
                    name="person"
                    size={r(24)}
                    color="#7D7D7D"
                  />

                </View>


              </View>


            )


            :


            (

              <View
                key={index}
                onLayout={(e) => {
                  posicoes.current[index] = e.nativeEvent.layout.y;
                }}
              >


                <View style={styles.pluRow}>


                  <Image
                    source={require('../assets/images/plu-icon.png')}
                    style={styles.chatAvatar}
                  />


                  <View style={styles.pluBubble}>

                    <Text style={styles.pluText}>
                      {item.texto}
                    </Text>

                  </View>


                </View>



                {
                item.look && renderLookCard(
                  item.look,
                  item.idRecomendacao,
                  item.avaliacao,
                  item.avaliando,
                  index
                )
                }



              </View>

            )


          ))
        }

        {
        digitando && (

        <View style={styles.typingRow}>


        <Image
        source={require('../assets/images/plu-icon.png')}
        style={styles.chatAvatar}
        />


        <View style={styles.typingBubble}>

        <Text style={styles.typingText}>
          Plu está digitando
        </Text>

        <View style={styles.dotsContainer}>

        {
        pontos.map((ponto,index)=>(

        <Animated.Text
        key={index}
        style={[
        styles.dot,
        {
        opacity:ponto.interpolate({
          inputRange:[0,1],
          outputRange:[0.3,1]
        }),
        transform:[
        {
        translateY:ponto.interpolate({
        inputRange:[0,1],
        outputRange:[0,-5]
        })
        }
        ]
        }
        ]}
        >
        ●
        </Animated.Text>

        ))
        }

        </View>

        </View>

        </View>
        )
        }

        {renderDetalhePeca()}


      </ScrollView>

      {/* INPUT */}

      <View
        style={[
          styles.inputContainer,
          { marginBottom: tecladoAberto ? r(10) : r(16) + insets.bottom }
        ]}
      >

        <TextInput

        placeholder="Peça uma sugestão ao Plu!"

        placeholderTextColor="#B1B1B1"

        style={styles.input}

        value={mensagem}

        onChangeText={setMensagem}

        />

        <TouchableOpacity

        style={styles.sendButton}

        onPress={enviarMensagem}

        >

          <Image
            source={require('../assets/images/send.png')}
            style={styles.sendIcon}
            resizeMode="contain"
          />

        </TouchableOpacity>

      </View>

    </SafeAreaView>

    </KeyboardAvoidingView>

  );
}

// e: escala cheia (tamanhos); es: escala suave (textos). Ver styles/escala.js
function criarStyles({ e, es }) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;

  return StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  header: {
    // Cabeçalho fixo em 85: igual ao Guarda-roupas e ao Cadastrar peça
    height: 85,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: r(20),
  },

  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerAvatar: {
    width: r(42),
    height: r(42),
    borderRadius: r(21),
    marginRight: r(10),
  },

  headerTitle: {
    fontSize: rt(18),
    fontWeight: '700',
    color: '#1A162B',
  },

  headerSubtitle: {
    fontSize: rt(13),
    color: '#5B5B5B',
    marginTop: r(-2),
  },

  chatContent: {
    paddingHorizontal: r(18),
    paddingTop: r(25),
    paddingBottom: r(130),
  },

  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: r(20),
  },

  userBubble: {
    maxWidth: '70%',
    backgroundColor: '#EFEFEF',
    paddingHorizontal: r(18),
    paddingVertical: r(14),
    borderRadius: r(18),
  },

  userText: {
    fontSize: rt(15),
    color: '#5A5A5A',
    textAlign: 'center',
  },

  userIcon: {
    width: r(38),
    height: r(38),
    borderRadius: r(19),
    backgroundColor: '#DADADA',

    justifyContent: 'center',
    alignItems: 'center',

    marginLeft: r(10),
  },

  pluRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: r(15),
    marginBottom: r(10),
  },

  chatAvatar: {
    width: r(36),
    height: r(36),
    borderRadius: r(18),
    marginRight: r(10),
  },

  pluBubble:{
    backgroundColor:'#5A31A9',
    borderRadius:r(20),

    paddingHorizontal:r(18),
    paddingVertical:r(16),

    maxWidth:'78%',
  },

  pluText: {
    color: '#FFF',
    fontSize: rt(14),
    lineHeight: rt(20),
  },

  lookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: r(15),
    marginBottom: r(20),
  },

  lookCard: {
    width: r(180),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: r(18),
    padding: r(10),
  },

  lookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: r(10),
  },

  lookTitle: {
    fontSize: rt(10),
    color: '#6B3CB4',
    fontWeight: '700',
  },

  lookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  lookItem: {
    width: r(70),
    height: r(70),
    borderRadius: r(8),
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#E3E3E3',

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: r(8),
  },

  lookImage: {
    width: r(45),
    height: r(45),
  },

  feedbackText: {
    fontSize: rt(10),
    textAlign: 'center',
    color: '#505050',
    marginTop: r(5),
  },

  feedbackIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: r(15),
    marginTop: r(8),
  },

  feedbackButton: {
    width: r(32),
    height: r(32),
    borderRadius: r(16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFFFFF',
  },

  feedbackGostei: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },

  feedbackNaoGostei: {
    backgroundColor: '#D32F2F',
    borderColor: '#D32F2F',
  },

 

inputContainer: {
  marginHorizontal: r(30),

  height: r(52),
  backgroundColor: '#EAEAEA',
  borderRadius: r(26),

  flexDirection: 'row',
  alignItems: 'center',

  paddingLeft: r(20),
  paddingRight: r(8),

  // Sombra suave, como na referência
  shadowColor: '#000',
  shadowOffset: {
    width: r(0),
    height: r(3),
  },
  shadowOpacity: 0.18,
  shadowRadius: 2.5,

  // Android
  elevation: 3,

  // Contorno sutil
  borderWidth: 0.5,
  borderColor: '#F7F7F7',
},

  input: {
    flex: 1,
    fontSize: rt(15),
    color: '#1A162B',
  },

  sendButton: {
    width: r(38),
    height: r(38),
    borderRadius: r(19),

    backgroundColor: '#000000',

    justifyContent: 'center',
    alignItems: 'center',
  },

  sendIcon: {
    width: r(18),
    height: r(18),
  },

  typingRow:{
  flexDirection:'row',
  alignItems:'flex-end',
  marginTop:r(15),
  marginBottom:r(20),
  },

  typingBubble:{
    backgroundColor:'#5A31A9',
    borderRadius:r(20),

    paddingHorizontal:r(18),
    paddingVertical:r(12),

    flexDirection:'row',
    alignItems:'center',
  },


  typingText:{
    color:'#FFF',
    fontSize:rt(14),
  },


  dotsContainer:{
    flexDirection:'row',
    marginLeft:r(6),
  },


  dot:{
    color:'#FFF',
    fontSize:rt(14),
    marginHorizontal:r(2),
  },  

  modalBackground:{
  flex:1,
  backgroundColor:'rgba(0,0,0,0.45)',
  justifyContent:'center',
  alignItems:'center',
  },


  modalCard:{
  width:'85%',
  backgroundColor:'#FFF',
  borderRadius:r(25),
  padding:r(20),
  alignItems:'center',
  },


  closeModal:{
  position:'absolute',
  right:r(15),
  top:r(15),
  zIndex:2,
  },


  modalImage:{
  width:r(220),
  height:r(220),
  marginTop:r(20),
  },


  modalNome:{
  fontSize:rt(22),
  fontWeight:'700',
  color:'#1A162B',
  marginTop:r(15),
  },


  modalCategoria:{
  fontSize:rt(14),
  color:'#6B3CB4',
  marginTop:r(5),
  },


  modalDescricao:{
  fontSize:rt(15),
  color:'#555',
  textAlign:'center',
  marginTop:r(15),
  lineHeight:rt(22),
  },

  });
}
