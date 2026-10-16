import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  listarMinhasRoupas,
  buscarRoupa,
  excluirRoupa
} from "../services/roupaService";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from "expo-secure-store";
import ImagemFrenteVerso from "../components/ImagemFrenteVerso";
import OutfitCard, { pecasDoLook, formatarData } from "../components/OutfitCard";
import { listarOutfits } from "../services/recomendacaoService";
import { useEscala } from "../styles/escala";
// expo-image guarda as imagens em cache no celular (não baixa de novo)
import { Image as ImagemCache } from "expo-image";

export default function GuardaRoupaScreen({ navigation, route }) {

  // Medidas proporcionais à largura da tela (a lista rola, então a altura não limita)
  const { width, ew: e, esw: es } = useEscala();
  const r = (n) => Math.round(n * e);

  // Grade: 3 colunas em celulares, 4 em telas largas; o card ocupa o espaço disponível
  const colunas = width >= 600 ? 4 : 3;
  const margem = r(8);
  const larguraGrade = Math.min(width, 640);
  const card = Math.floor((larguraGrade - colunas * 2 * margem) / colunas);

  const styles = useMemo(
    () => criarStyles({ e, es, card, margem }),
    [e, es, card, margem]
  );

  const [activeTab, setActiveTab] = useState('roupas');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [roupas, setRoupas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [roupaSelecionada, setRoupaSelecionada] = useState(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Aba Outfits (looks curtidos)
  const [outfits, setOutfits] = useState([]);
  const [carregandoOutfits, setCarregandoOutfits] = useState(false);
  const [erroOutfits, setErroOutfits] = useState(null);
  const [outfitSelecionado, setOutfitSelecionado] = useState(null);

  useEffect(() => {

    buscarRoupas();

  }, []);

  // Chegou do "Salvar peça" no cadastro: abre os detalhes da peça recém-cadastrada
  const abrirPecaId = route?.params?.abrirPecaId;

  useEffect(() => {

    if (!abrirPecaId) {
      return;
    }

    // Espera a transição de tela terminar antes de abrir o modal
    const timer = setTimeout(() => {

      abrirDetalhes({ id: abrirPecaId });

      // Limpa o parâmetro: não reabre ao voltar para a tela
      navigation.setParams({ abrirPecaId: undefined });

    }, 350);

    return () => clearTimeout(timer);

  }, [abrirPecaId]);

  // Recarrega toda vez que a aba Outfits é aberta (pega 👍 recentes)
  useEffect(() => {

    if (activeTab === 'outfits') {
      buscarOutfits();
    }

  }, [activeTab]);

  async function buscarOutfits() {

    try {

      setCarregandoOutfits(true);
      setErroOutfits(null);

      setOutfits(await listarOutfits());

    } catch (error) {

      console.log("Erro ao buscar outfits:", error.message);

      setErroOutfits(error.message);

    } finally {

      setCarregandoOutfits(false);

    }

  }

  // Toque numa peça do outfit: fecha o outfit e abre os detalhes da peça
  function abrirPecaDoOutfit(peca) {

    setOutfitSelecionado(null);

    setTimeout(() => abrirDetalhes(peca), 350);

  }

  useEffect(() => {

    console.log(
        "NOVA ROUPA:",
        roupaSelecionada
    );

}, [roupaSelecionada]);

// Aba -> categoria cadastrada no banco
const CATEGORIA_POR_ABA = {
  Tops: "Superior",
  Bottom: "Inferior",
  "Peça única": "Peça única",
  Sapatos: "Calçado",
  Acessorios: "Acessório",
  "Sobreposição": "Sobreposição",
};

const roupasFiltradas = roupas.filter((item)=>
  activeCategory === "Todos" ||
  item.categoria === CATEGORIA_POR_ABA[activeCategory]
);

async function buscarRoupas() {

  try {

    console.log("Buscando roupas do usuário...");


    const dados =
    await listarMinhasRoupas();


    console.log(
      "Roupas recebidas:",
      JSON.stringify(dados,null,2)
    );


    setRoupas(dados);


  } catch(error) {


    console.log(
      "Erro ao buscar roupas:",
      error.message
    );


  } finally {


    setCarregando(false);


  }

}

async function abrirDetalhes(item) {

  try {

    const roupaCompleta =
    await buscarRoupa(item.id);

    console.log(
      "DETALHES:",
      JSON.stringify(roupaCompleta, null, 2)
    );

    setRoupaSelecionada(roupaCompleta);

    console.log(
        "ESTADO:",
        roupaCompleta
    );

    setMostrarDetalhes(true);
    
  } catch (error) {

    console.log(error);

  }

}

async function deletarRoupa(){

  Alert.alert(
    "Excluir peça",
    "Deseja realmente remover essa peça?",
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
            
              await excluirRoupa(
                  roupaSelecionada.id
              );


            setRoupas(
              roupas.filter(
                item => item.id !== roupaSelecionada.id
              )
            );


            setMostrarDetalhes(false);

            setRoupaSelecionada(null);


          }catch(error){

            console.log(
              "Erro ao excluir:",
              error.message
            );

          }

        }

      }

    ]
  );

}



  const categorias = [
    'Todos',
    'Tops',
    'Bottom',
    'Peça única',
    'Sapatos',
    'Acessorios',
    'Sobreposição',
  ];

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close"
            size={30}
            color="#8A8A8A"
          />
        </TouchableOpacity>

        <Text style={styles.title}>
          Meu Guarda-roupas
        </Text>

        <View style={{ width: 30 }} />

      </View>

      {/* ABAS */}
      <View style={styles.tabsContainer}>

        <TouchableOpacity
          onPress={() => setActiveTab('roupas')}
        >

          <Text
            style={[
              styles.tabText,
              activeTab === 'roupas' &&
                styles.activeTabText
            ]}
          >
            Roupas
          </Text>

          {activeTab === 'roupas' &&
            <View style={styles.tabIndicator} />
          }

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('outfits')}
        >

          <Text
            style={[
              styles.tabText,
              activeTab === 'outfits' &&
                styles.activeTabText
            ]}
          >
            Outfits
          </Text>

          {activeTab === 'outfits' &&
            <View style={styles.tabIndicator} />
          }

        </TouchableOpacity>

      </View>

      {activeTab === 'roupas' ? (

        <>

          {/* CATEGORIAS */}

          {/* Rolável na horizontal: as abas não cabem todas na largura */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >

            {categorias.map((categoria) => (

              <TouchableOpacity
                key={categoria}
                onPress={() => setActiveCategory(categoria)}
              >


                <View
                  style={[
                    styles.categoryButton,

                    activeCategory === categoria &&
                      styles.categoryButtonActive
                  ]}
                >

                  <Text
                    style={[
                      styles.categoryText,

                      activeCategory === categoria &&
                        styles.categoryTextActive
                    ]}
                  >
                    {categoria}
                  </Text>

                </View>

              </TouchableOpacity>

            ))}

          </ScrollView>

          {/* PÁGINA DE ROUPAS */}

          <FlatList

          data={roupasFiltradas}

          keyExtractor={(item)=> item.id.toString()}

          key={`grade-${colunas}`}

          numColumns={colunas}

          showsVerticalScrollIndicator={false}

          contentContainerStyle={styles.lista}

          renderItem={({item})=>(

          <TouchableOpacity

          style={styles.card}

          activeOpacity={0.7}

          onPress={() => abrirDetalhes(item)}

          >


          {/* Miniatura (WebP leve); peças antigas sem miniatura usam a imagem grande */}
          <ImagemCache

          source={{
          uri:item.miniatura_url || item.imagem_url
          }}

          style={styles.image}

          contentFit="contain"

          cachePolicy="memory-disk"

          transition={150}

          />


          </TouchableOpacity>

          )}

          /> 

        </>

      ) : (

        carregandoOutfits && outfits.length === 0 ? (

          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#4D2A95" />
          </View>

        ) : erroOutfits ? (

          <View style={styles.emptyContainer}>

            <Text style={styles.outfitsVazioTexto}>
              {erroOutfits}
            </Text>

            <TouchableOpacity
              style={styles.fecharButton}
              onPress={buscarOutfits}
            >
              <Text style={styles.fecharTexto}>
                Tentar de novo
              </Text>
            </TouchableOpacity>

          </View>

        ) : outfits.length === 0 ? (

          <View style={styles.emptyContainer}>

            <Ionicons
              name="heart-outline"
              size={r(56)}
              color="#C5C5C5"
            />

            <Text style={styles.outfitsVazioTexto}>
              Você ainda não curtiu nenhum look.{"\n"}
              Peça sugestões ao Plu e toque em 👍 nas que gostar!
            </Text>

          </View>

        ) : (

          <FlatList
            data={outfits}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.outfitsLista}
            showsVerticalScrollIndicator={false}
            refreshing={carregandoOutfits}
            onRefresh={buscarOutfits}
            renderItem={({ item }) => (
              <OutfitCard
                outfit={item}
                onPress={() => setOutfitSelecionado(item)}
              />
            )}
          />

        )

      )}


      {/* DETALHE DO OUTFIT */}
      <Modal
        visible={!!outfitSelecionado}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOutfitSelecionado(null)}
      >

        <View style={styles.modalBackground}>

          <View style={styles.modalContainer}>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "center" }}
            >

              {outfitSelecionado && (

                <>

                  <Text style={styles.modalTitulo}>
                    “{outfitSelecionado.prompt}”
                  </Text>

                  <Text style={styles.outfitData}>
                    👍 {formatarData(outfitSelecionado.criado_em)}
                  </Text>

                  <View style={styles.outfitPecas}>

                    {pecasDoLook(outfitSelecionado.look).map((peca) => (

                      <TouchableOpacity
                        key={peca.id}
                        style={styles.outfitPeca}
                        activeOpacity={0.7}
                        onPress={() => abrirPecaDoOutfit(peca)}
                      >

                        <Image
                          source={{ uri: peca.imagem }}
                          style={styles.outfitPecaImagem}
                          resizeMode="contain"
                        />

                        <Text style={styles.outfitPecaNome} numberOfLines={2}>
                          {peca.nome}
                        </Text>

                      </TouchableOpacity>

                    ))}

                  </View>

                  {!!outfitSelecionado.justificativa && (
                    <Text style={[styles.modalTexto, { textAlign: "center" }]}>
                      {outfitSelecionado.justificativa}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.fecharButton}
                    onPress={() => setOutfitSelecionado(null)}
                  >
                    <Text style={styles.fecharTexto}>
                      Fechar
                    </Text>
                  </TouchableOpacity>

                </>

              )}

            </ScrollView>

          </View>

        </View>

      </Modal>


      <Modal

      visible={mostrarDetalhes}

      transparent={true}

      animationType="slide"

      onRequestClose={()=>setMostrarDetalhes(false)}

      >


      <View style={styles.modalBackground}>

      {/* Contêiner inclui a faixa das bolinhas, para o toque funcionar no Android */}
      <View style={styles.detalhesWrapper}>

      <View style={[styles.modalContainer, styles.detalhesCard]}>

      <ScrollView

      showsVerticalScrollIndicator={false}

      contentContainerStyle={{
      alignItems:"center",
      paddingTop:14,
      paddingBottom:10
      }}

      >


      {
      roupaSelecionada && (

      <>


      <ImagemFrenteVerso

      frente={roupaSelecionada.imagem_url}

      verso={roupaSelecionada.imagem_verso_url}

      style={styles.imagemContainer}

      imageStyle={styles.modalImagem}

      />



      <Text style={styles.modalTitulo}>

      {roupaSelecionada.nome}

      </Text>

      <Text style={styles.modalTexto}>
      Categoria: {roupaSelecionada.categoria}
      </Text>

      <Text style={styles.modalTexto}>
      Tipo: {roupaSelecionada.tipo}
      </Text>

      <Text style={styles.modalTexto}>
      Estilo: {roupaSelecionada.estilo}
      </Text>

      <Text style={styles.modalTexto}>
      Formalidade: {roupaSelecionada.formalidade}
      </Text>

      <Text style={styles.modalTexto}>
      Tecido: {roupaSelecionada.tecido}
      </Text>

      <Text style={styles.modalTexto}>
      Cores: {roupaSelecionada.cores?.join(", ")}
      </Text>

      <Text style={styles.modalTexto}>
      Paleta: {roupaSelecionada.paleta_cores?.join(", ")}
      </Text>

      <Text style={styles.modalTexto}>
      Ocasiões: {roupaSelecionada.ocasioes?.join(", ")}
      </Text>

      <Text style={styles.modalTexto}>
      Estações: {roupaSelecionada.estacoes?.join(", ")}
      </Text>

      {roupaSelecionada.pode_sobrepor &&
        roupaSelecionada.categoria !== "Sobreposição" && (
        <Text style={styles.sobreporTexto}>
          Também pode ser usada como sobreposição
        </Text>
      )}

      <Text
        style={[
          styles.modalTexto,
          { marginTop: 20 }
        ]}
      >
      {roupaSelecionada.descricao}
      </Text>

      </>

      )

      }

      </ScrollView>

      </View>

      {/* Botões fixos no topo do card: sempre visíveis, mesmo com rolagem */}
      <View style={styles.botoesTopo}>

        <TouchableOpacity
          style={[styles.botaoBolinha, styles.botaoBolinhaFechar]}
          onPress={()=>setMostrarDetalhes(false)}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Ionicons name="close" size={r(24)} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botaoBolinha, styles.botaoBolinhaExcluir]}
          onPress={deletarRoupa}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Excluir peça"
        >
          <Ionicons name="trash-outline" size={r(22)} color="#FFFFFF" />
        </TouchableOpacity>

      </View>

      </View>


      </View>


      </Modal>

    </SafeAreaView>
  );
}
// e: escala cheia (tamanhos); es: escala suave (textos). Ver styles/escala.js
function criarStyles({ e, es, card, margem }) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;

  return StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  header: {
    // Fixo em 85: mesma altura de "Adicionar Peças" e do Chat
    height: 85,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E3E3',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: r(20),
  },

  title: {
    fontSize: rt(18),
    fontWeight: '700',
    color: '#1A162B',
  },

  // ---------- ABAS ----------

  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: r(80),
    marginTop: r(15),
  },

  tabText: {
    fontSize: rt(18),
    color: '#1A162B',
    fontWeight: '500',
  },

  activeTabText: {
    fontWeight: '700',
  },

  tabIndicator: {
    height: r(3),
    backgroundColor: '#1A162B',
    borderRadius: r(5),
    marginTop: r(4),
  },

  // ---------- CATEGORIAS ----------

  // flexGrow 0: o ScrollView não estica na vertical e empurra a lista
  categoryScroll: {
    flexGrow: 0,
    marginTop: r(40),
    marginBottom: r(8),
  },

  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r(12),
  },

  categoryButton: {
    paddingHorizontal: r(14),
    paddingVertical: r(9),
    borderRadius: r(12),
  },

  categoryButtonActive: {
    backgroundColor: '#171220',
  },

  categoryText: {
    fontSize: rt(15),
    fontWeight: '500',
    color: '#171220',
  },

  categoryTextActive: {
    color: '#FFF',
  },

  // ---------- PÁGINA DE ROUPAS ----------


  lista:{
    paddingBottom:r(20),
    alignItems:"center",
  },

  // ---------- CARD ----------

  card:{

  width:card,

  height:card,

  margin:margem,

  backgroundColor:'#F3F3F3',

  borderWidth:1,

  borderColor:'#D8D8D8',

  borderRadius:r(12),

  justifyContent:'center',

  alignItems:'center',

  },

  // ---------- OUTFITS ----------

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image:{

  width:Math.round(card * 0.86),

  height:Math.round(card * 0.86),

  },
  outfitsLista: {
    paddingTop: r(20),
    paddingBottom: r(30),
  },

  outfitsVazioTexto: {
    marginTop: r(14),
    marginHorizontal: r(40),
    fontSize: rt(15),
    textAlign: 'center',
    color: '#777',
  },

  outfitData: {
    marginTop: r(4),
    fontSize: rt(13),
    color: '#8A8A8A',
  },

  outfitPecas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: r(12),
    marginTop: r(18),
  },

  outfitPeca: {
    width: r(110),
    alignItems: 'center',
  },

  outfitPecaImagem: {
    width: r(100),
    height: r(100),
    borderRadius: r(12),
    backgroundColor: '#F3F3F3',
  },

  outfitPecaNome: {
    marginTop: r(6),
    fontSize: rt(13),
    textAlign: 'center',
    color: '#555',
  },

  modalBackground:{
    flex:1,
    backgroundColor:"rgba(0,0,0,0.5)",
    justifyContent:"center",
    alignItems:"center",
  },


  modalContainer:{
      width:"85%",
      maxHeight:"85%",
      backgroundColor:"#FFFFFF",
      borderRadius:r(25),
      padding:r(25),
  },


  modalImagem:{
    width:"100%",
    height:r(260),
    maxWidth:r(260),
  },

  imagemContainer:{
    width:"100%",
    // minHeight: deixa espaço para o indicador "frente/verso"
    minHeight:r(260),
    justifyContent:"center",
    alignItems:"center",
    },


  modalTitulo:{
    marginTop:r(15),
    fontSize:rt(22),
    fontWeight:"700",
    color:"#1A162B",
  },


  sobreporTexto:{
    marginTop:r(10),
    fontSize:rt(14),
    fontWeight:"600",
    color:"#4D2A95",
  },


  modalTexto:{
    marginTop:r(10),
    fontSize:rt(16),
    color:"#555",
  },


  // Contêiner do card + faixa das bolinhas (topo extra para o toque funcionar no Android)
  detalhesWrapper:{
    width:"85%",
    maxHeight:"88%",
    paddingTop:r(22),
  },

  // O card ocupa o wrapper (a largura e a altura máxima vêm de detalhesWrapper)
  detalhesCard:{
    width:"100%",
    maxHeight:"100%",
  },

  // Bolinhas fixas no topo do card de detalhes (fechar / excluir)
  botoesTopo:{
    position:"absolute",
    top:r(0),
    left:r(20),
    flexDirection:"row",
    gap:r(12),
    zIndex:10,
    elevation:10,
  },

  botaoBolinha:{
    width:r(44),
    height:r(44),
    borderRadius:r(22),
    alignItems:"center",
    justifyContent:"center",
    shadowColor:"#000",
    shadowOffset:{ width:r(0), height:r(2) },
    shadowOpacity:0.25,
    shadowRadius:4,
    elevation:6,
  },

  botaoBolinhaFechar:{
    backgroundColor:"#4D2A95",
  },

  botaoBolinhaExcluir:{
    backgroundColor:"#D32F2F",
  },


  fecharButton:{
    marginTop:r(25),
    backgroundColor:"#4D2A95",
    paddingHorizontal:r(50),
    paddingVertical:r(14),
    borderRadius:r(25),
  },


  fecharTexto:{
    color:"#FFF",
    fontWeight:"700",
    fontSize:rt(17),
  },
  



  });
}
