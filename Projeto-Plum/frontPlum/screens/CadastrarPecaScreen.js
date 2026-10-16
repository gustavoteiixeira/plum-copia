import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from "expo-image-picker";
import {
  gerarPreview,
  descartarPreview,
  girarPreview,
  analisarPecaAprovada,
} from "../services/api";
import ImagemFrenteVerso from "../components/ImagemFrenteVerso";
import { useEscala } from "../styles/escala";

// Mensagens exibidas durante cada tipo de loading
const ETAPAS = {
  preview: [
    "Removendo o fundo da foto...",
    "Recortando a peça...",
    "Quase pronto...",
  ],
  analise: [
    "Identificando cores e estilo...",
    "Montando a descrição da peça...",
    "Quase pronto...",
  ],
};

// Recorte aprovado de um lado da peça
const LADO_VAZIO = { idPreview: null, urlPreview: null };

// Botão grande com título, descrição e ícone (substitui as imagens com texto embutido)
function BotaoAcaoGrande({ styles, titulo, descricao, icone, escuro, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.botaoGrande, escuro && styles.botaoGrandeEscuro]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${descricao}`}
    >
      <View style={styles.botaoGrandeTextos}>
        <Text style={[styles.botaoGrandeTitulo, escuro && styles.botaoGrandeTituloEscuro]}>
          {titulo}
        </Text>
        <Text style={[styles.botaoGrandeDescricao, escuro && styles.botaoGrandeDescricaoEscuro]}>
          {descricao}
        </Text>
      </View>

      <View style={[styles.botaoGrandeIcone, escuro && styles.botaoGrandeIconeClaro]}>
        <Image
          source={icone}
          style={[styles.botaoGrandeIconeImg, { tintColor: escuro ? "#17131D" : "#FFFFFF" }]}
          resizeMode="contain"
        />
      </View>
    </TouchableOpacity>
  );
}

export default function CadastrarPecaScreen({ navigation }) {
  // Medidas proporcionais à largura da tela (a tela rola, então a altura não limita)
  const { ew: e, esw: es } = useEscala();
  const r = (n) => Math.round(n * e);
  const styles = React.useMemo(() => criarStyles({ e, es }), [e, es]);

  //estados
  const [frente, setFrente] = React.useState(LADO_VAZIO);
  const [verso, setVerso] = React.useState(LADO_VAZIO);
  // Qual lado da peça a câmera/galeria vai preencher
  const [ladoAtivo, setLadoAtivo] = React.useState("frente");
  // null | "preview" (removendo fundo) | "analise" (Gemini)
  const [carregando, setCarregando] = React.useState(null);
  const [etapa, setEtapa] = React.useState(0);
  // Recorte aguardando aprovação: { lado, origem, idPreview, url }
  const [revisao, setRevisao] = React.useState(null);
  // true enquanto o servidor gira o recorte
  const [girando, setGirando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [mostrarResultado, setMostrarResultado] = React.useState(false);

  const ladoSelecionado = ladoAtivo === "verso" ? verso : frente;


  // Troca a mensagem do loading a cada 3s (para na última)
  React.useEffect(() => {
    setEtapa(0);

    if (!carregando) {
      return;
    }

    const intervalo = setInterval(() => {
      setEtapa((atual) =>
        Math.min(atual + 1, ETAPAS[carregando].length - 1)
      );
    }, 3000);

    return () => clearInterval(intervalo);
  }, [carregando]);


  // Ao sair da tela sem analisar, descarta os recortes no servidor
  const previewsAbertas = React.useRef([]);

  React.useEffect(() => {
    previewsAbertas.current = [
      frente.idPreview,
      verso.idPreview,
      revisao?.idPreview,
    ].filter(Boolean);
  }, [frente, verso, revisao]);

  React.useEffect(() => {
    return () => {
      previewsAbertas.current.forEach(descartarPreview);
    };
  }, []);


  // ==========================
  // Foto -> recorte (prévia)
  // ==========================

  async function escolherFoto(origem, lado = ladoAtivo) {

    const permissao =
      origem === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert(
        "Permissão negada",
        origem === "camera"
          ? "Permita o acesso à câmera para tirar a foto."
          : "Permita o acesso à galeria para escolher a foto."
      );
      return;
    }

    const selecao =
      origem === "camera"
        ? await ImagePicker.launchCameraAsync({
            // Abre o editor nativo para recortar a foto antes de enviar.
            // Android: recorte livre. iOS: o sistema força recorte quadrado.
            allowsEditing: true,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 1,
          });

    if (selecao.canceled) {
      return;
    }

    try {

      setCarregando("preview");

      const preview = await gerarPreview(selecao.assets[0].uri);

      setRevisao({
        lado,
        origem,
        idPreview: preview.id_preview,
        url: preview.url,
      });

    } catch (error) {

      console.log("Erro na prévia:", error);

      Alert.alert(
        "Ops! Não deu certo",
        error.message || "Não foi possível processar a foto. Tente novamente."
      );

    } finally {

      setCarregando(null);

    }
  }


  // ==========================
  // Aprovação do recorte
  // ==========================

  function aprovarRecorte() {

    const { lado, idPreview, url } = revisao;

    const anterior = lado === "verso" ? verso : frente;

    // Substituiu um recorte já aprovado: descarta o antigo
    if (anterior.idPreview) {
      descartarPreview(anterior.idPreview);
    }

    const aprovado = { idPreview, urlPreview: url };

    if (lado === "verso") {
      setVerso(aprovado);
    } else {
      setFrente(aprovado);
    }

    setLadoAtivo(lado);
    setRevisao(null);
  }

  async function girarRecorte(sentido) {

    if (girando) {
      return;
    }

    try {

      setGirando(true);

      const girada = await girarPreview(revisao.idPreview, sentido);

      setRevisao((atual) => atual && { ...atual, url: girada.url });

    } catch (error) {

      console.log("Erro ao girar:", error);

      // 410: recorte expirou, precisa tirar a foto de novo
      if (error.status === 410) {
        setRevisao(null);
      }

      Alert.alert(
        "Ops! Não deu certo",
        error.message || "Não foi possível girar a imagem. Tente novamente."
      );

    } finally {

      setGirando(false);

    }
  }

  function refazerRecorte() {

    const { lado, origem, idPreview } = revisao;

    descartarPreview(idPreview);

    setRevisao(null);

    // Espera o modal fechar antes de abrir a câmera/galeria
    setTimeout(() => escolherFoto(origem, lado), 400);
  }

  function cancelarRevisao() {

    descartarPreview(revisao.idPreview);

    setRevisao(null);
  }

  function removerVerso() {

    if (verso.idPreview) {
      descartarPreview(verso.idPreview);
    }

    setVerso(LADO_VAZIO);
    setLadoAtivo("frente");
  }


  // ==========================
  // Análise (Gemini)
  // ==========================

  async function analisarPeca() {

    if (!frente.idPreview) {
      Alert.alert("Falta a foto", "Adicione e aprove a foto da frente primeiro.");
      return;
    }

    // Evita enviar a mesma peça duas vezes
    if (carregando) {
      return;
    }

    try {

      setCarregando("analise");

      const resposta = await analisarPecaAprovada(
        frente.idPreview,
        verso.idPreview
      );

      console.log("Resposta backend:", resposta);

      // O servidor já apagou as prévias usadas
      setFrente(LADO_VAZIO);
      setVerso(LADO_VAZIO);
      setLadoAtivo("frente");

      setResultado(resposta);
      setMostrarResultado(true);

    } catch (error) {

      console.log("ERRO COMPLETO:", error);

      // 410: recortes expiraram no servidor, precisa refazer as fotos
      if (error.status === 410) {
        setFrente(LADO_VAZIO);
        setVerso(LADO_VAZIO);
        setLadoAtivo("frente");
      }

      // Outros erros: os recortes continuam, basta tentar de novo
      Alert.alert(
        "Ops! Não deu certo",
        error.message ||
          "Não foi possível analisar a peça. Tente novamente em instantes."
      );

    } finally {

      setCarregando(null);

    }
  }

  function fecharResultado() {
    setResultado(null);
    setMostrarResultado(false);
  }

  // "Salvar peça": a peça já foi gravada na análise; leva o usuário ao Guarda-roupas
  // com os detalhes dela abertos. O replace tira o Cadastrar da pilha, então o
  // "voltar" do Guarda-roupas leva à Home (e não de volta ao cadastro).
  const navegandoRef = React.useRef(false);

  function salvarPeca() {
    // Trava contra toque duplo: só navega uma vez
    if (navegandoRef.current) {
      return;
    }

    const idPeca = resultado?.id;

    fecharResultado();

    if (!idPeca) {
      return;
    }

    navegandoRef.current = true;

    // Espera o modal terminar de fechar antes de trocar de tela
    setTimeout(() => {
      navigation.replace("GuardaRoupa", { abrirPecaId: idPeca });
    }, 300);
  }

  

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
          Adicionar Peças
        </Text>

        <View style={{ width: 30 }} />
      </View>

      {/* Corpo rolável: com fontes maiores o conteúdo pode passar da altura em telas baixas */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.corpoConteudo}
      >

        {/* SELETOR FRENTE / VERSO (aparece depois da frente aprovada) */}
        {frente.idPreview && (

          <View style={styles.ladosRow}>

            {["frente", "verso"].map((lado) => (

              <TouchableOpacity
                key={lado}
                style={[
                  styles.ladoButton,
                  ladoAtivo === lado && styles.ladoButtonAtivo
                ]}
                onPress={() => setLadoAtivo(lado)}
                disabled={!!carregando}
              >

                <Text
                  style={[
                    styles.ladoTexto,
                    ladoAtivo === lado && styles.ladoTextoAtivo
                  ]}
                >
                  {lado === "frente" ? "Frente" : "Verso (opcional)"}
                </Text>

                {lado === "verso" && verso.idPreview && (
                  <Ionicons
                    name="checkmark-circle"
                    size={r(16)}
                    color={ladoAtivo === "verso" ? "#FFFFFF" : "#4D2A95"}
                    style={{ marginLeft: 4 }}
                  />
                )}

              </TouchableOpacity>

            ))}

          </View>

        )}

        {/* ÁREA DA FOTO */}
        <View style={[
          styles.uploadContainer,
          frente.idPreview && { marginTop: 16 }
        ]}>

          {/* Um pouco menor com o seletor visível, para caber na tela */}
          <View style={[
            styles.uploadBox,
            frente.idPreview && { width: "62%" },
            ladoSelecionado.urlPreview && styles.uploadBoxRecorte
          ]}>

            {ladoSelecionado.urlPreview ? (

              <>

                <Image
                  source={{ uri: ladoSelecionado.urlPreview }}
                  style={styles.recorteImagem}
                  resizeMode="contain"
                />

                <View style={styles.aprovadoBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={r(14)}
                    color="#FFFFFF"
                  />
                  <Text style={styles.aprovadoTexto}>
                    Recorte aprovado
                  </Text>
                </View>

              </>

            ) : ladoAtivo === "verso" ? (

              <View style={styles.versoVazio}>

                <Ionicons
                  name="repeat"
                  size={r(50)}
                  color="#C5C5C5"
                />

                <Text style={styles.versoVazioTexto}>
                  Tem estampa, logo ou detalhe atrás?{"\n"}
                  Adicione uma foto do verso para uma análise mais completa.
                </Text>

              </View>

            ) : (

              <View style={styles.vazioFrente}>

                <Ionicons
                  name="add"
                  size={r(56)}
                  color="#C5C5C5"
                />
              </View>

            )}

            {ladoAtivo === "verso" && verso.idPreview && !carregando && (

              <TouchableOpacity
                style={styles.removerVersoButton}
                onPress={removerVerso}
              >
                <Ionicons
                  name="trash-outline"
                  size={r(18)}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

            )}

          </View>

          <Image
            source={require('../assets/images/aviso.png')}
            style={styles.aviso}
            resizeMode="contain"
          />

        </View>

        {
          !frente.idPreview ? (

            <>
              <BotaoAcaoGrande
                styles={styles}
                titulo="Tirar Foto"
                descricao="Abra sua câmera e tire uma foto da sua roupa."
                icone={require("../assets/images/camera.png")}
                onPress={() => escolherFoto("camera", "frente")}
                disabled={!!carregando}
              />

              <BotaoAcaoGrande
                styles={styles}
                titulo="Galeria"
                descricao="Selecione uma peça de roupa guardada na sua fototeca."
                icone={require("../assets/images/galeria.png")}
                escuro
                onPress={() => escolherFoto("galeria", "frente")}
                disabled={!!carregando}
              />

            </>

          ) : (

            <>

              <View style={styles.acoesRow}>

                <TouchableOpacity
                  style={styles.acaoButton}
                  onPress={() => escolherFoto("camera")}
                  disabled={!!carregando}
                >
                  <Image
                    source={require("../assets/images/camera.png")}
                    style={styles.icon}
                    resizeMode="contain"
                  />

                  <Text style={styles.acaoTexto}>
                    {ladoSelecionado.idPreview ? "Nova foto" : "Tirar foto"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.acaoButton, styles.acaoButtonRoxo]}
                  onPress={() => escolherFoto("galeria")}
                  disabled={!!carregando}
                >
                <Image
                  source={require("../assets/images/galeria.png")}
                  style={[
                    styles.icon,
                    {
                      tintColor:"#FFFFFF"
                    }
                  ]}
                />

                  <Text 
                  style={[
                    styles.acaoTexto,
                    {
                      color:"#FFFFFF"
                    }
                  ]}
                  >
                    Galeria
                  </Text>
                </TouchableOpacity>

              </View>

              <TouchableOpacity
                style={[
                  styles.analisarButton,
                  carregando && styles.analisarButtonDesativado
                ]}
                activeOpacity={0.8}
                onPress={analisarPeca}
                disabled={!!carregando}
              >

                {
                  carregando === "analise" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.analisarButtonText}>
                      Analisar peça
                    </Text>
                  )
                }

              </TouchableOpacity>

            </>

          )
        }

      </ScrollView>

      {/* LOADING + REVISÃO DO RECORTE (um único modal, evita modais empilhados) */}
      <Modal
        visible={!!carregando || !!revisao}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Botão "voltar" do Android durante a revisão = cancelar
          if (revisao && !carregando && !girando) {
            cancelarRevisao();
          }
        }}
      >

        <View style={styles.modalBackground}>

          {carregando ? (

            <View style={styles.loadingContainer}>

              <ActivityIndicator
                size="large"
                color="#4D2A95"
              />

              <Text style={styles.loadingTitulo}>
                {carregando === "preview"
                  ? "Preparando a foto"
                  : "Analisando sua peça"}
              </Text>

              <Text style={styles.loadingTexto}>
                {ETAPAS[carregando][etapa]}
              </Text>

            </View>

          ) : revisao && (

            <View style={styles.modalContainer}>

              <Text style={styles.resultadoTitulo}>
                Confira o recorte
              </Text>

              <Text style={styles.revisaoSubtitulo}>
                {revisao.lado === "verso" ? "Verso da peça" : "Frente da peça"}
              </Text>

              <View style={styles.revisaoImagemBox}>

                <Image
                  source={{ uri: revisao.url }}
                  style={[
                    styles.revisaoImagem,
                    girando && { opacity: 0.4 }
                  ]}
                  resizeMode="contain"
                />

                {girando && (
                  <ActivityIndicator
                    style={StyleSheet.absoluteFill}
                    size="large"
                    color="#4D2A95"
                  />
                )}

              </View>

              {/* GIRAR 90° */}
              <View style={styles.girarRow}>

                <TouchableOpacity
                  style={[
                    styles.girarButton,
                    girando && styles.analisarButtonDesativado
                  ]}
                  onPress={() => girarRecorte("anti_horario")}
                  disabled={girando}
                >
                  <Ionicons
                    name="arrow-undo"
                    size={r(20)}
                    color="#4D2A95"
                  />
                  <Text style={styles.girarTexto}>Girar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.girarButton,
                    girando && styles.analisarButtonDesativado
                  ]}
                  onPress={() => girarRecorte("horario")}
                  disabled={girando}
                >
                  <Text style={styles.girarTexto}>Girar</Text>
                  <Ionicons
                    name="arrow-redo"
                    size={r(20)}
                    color="#4D2A95"
                  />
                </TouchableOpacity>

              </View>

              <Text style={styles.observacao}>
                A peça ficou inteira, sem pedaços do fundo e na posição certa?
              </Text>

              <View style={styles.modalBotoes}>

                <TouchableOpacity
                  style={[
                    styles.salvarButton,
                    girando && styles.analisarButtonDesativado
                  ]}
                  onPress={aprovarRecorte}
                  disabled={girando}
                >
                  <Text style={styles.salvarTexto}>
                    Ficou bom, continuar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.novaButton}
                  onPress={refazerRecorte}
                  disabled={girando}
                >
                  <Text style={styles.novaTexto}>
                    {revisao.origem === "camera"
                      ? "Tirar outra foto"
                      : "Escolher outra foto"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelarButton}
                  onPress={cancelarRevisao}
                  disabled={girando}
                >
                  <Text style={styles.cancelarTexto}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

              </View>

            </View>

          )}

        </View>

      </Modal>


      <Modal
        visible={mostrarResultado}
        transparent={true}
        animationType="slide"
        onRequestClose={fecharResultado}
      >

      <View style={styles.modalBackground}>

      <View style={styles.modalContainer}>


      {
      resultado && (

      <>

      <ImagemFrenteVerso
        frente={resultado.url}
        verso={resultado.url_verso}
        imageStyle={styles.resultadoImagem}
      />


      <Text style={styles.resultadoTitulo}>
        {resultado.analise.nome}
      </Text>


      <Text style={styles.resultadoTexto}>
      Categoria: {resultado.analise.categoria}
      </Text>


      <Text style={styles.resultadoTexto}>
      Estilo: {resultado.analise.estilo}
      </Text>


      <Text style={styles.resultadoTexto}>
      Cores: {resultado.analise.cores.join(", ")}
      </Text>

      {resultado.analise.pode_sobrepor &&
        resultado.analise.categoria !== "Sobreposição" && (
        <Text style={styles.sobreporTexto}>
          Também pode ser usada como sobreposição
        </Text>
      )}


      <Text style={styles.observacao}>
      {resultado.analise.descricao}
      </Text>


      </>

      )


      }


      <View style={styles.modalBotoes}>


        <TouchableOpacity

          style={styles.salvarButton}

          onPress={salvarPeca}

        >

          <Text style={styles.salvarTexto}>
            Salvar peça
          </Text>

        </TouchableOpacity>



        <TouchableOpacity

          style={styles.novaButton}

          onPress={fecharResultado}

        >

          <Text style={styles.novaTexto}>
            Cadastrar outra peça
          </Text>

        </TouchableOpacity>


      </View>


      </View>

      </View>


      </Modal>

    </SafeAreaView>
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
    // Fixo em 85: mesma altura do Guarda-roupas e do Chat
    height: 85,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: r(20),
  },

  title: {
    fontSize: rt(18),
    fontWeight: '700',
    color: '#1B152D',
  },

  // Conteúdo do ScrollView: respiro embaixo para o último botão não encostar na borda
  corpoConteudo: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  uploadContainer: {
    alignItems: 'center',
    marginTop: r(40),
  },

  uploadBox: {
    width: '70%',
    aspectRatio: 0.72,

    borderWidth: 2,
    borderColor: '#9E9E9E',
    borderStyle: 'dashed',
    borderRadius: r(28),

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: '#FAFAFA',
  },

  // Estado inicial da caixa da foto: "+" e orientações
  vazioFrente: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: r(16),
  },

  dicaFoto: {
    width: '100%',
    marginTop: r(14),
    paddingVertical: r(12),
    paddingHorizontal: r(12),
    borderRadius: r(16),
    backgroundColor: '#F1ECF8',
    gap: r(10),
  },

  aviso: {
    width: r(160),
    height: r(55),
    marginTop: r(-10),
  },

  // Botões grandes "Tirar Foto" / "Galeria" (antes eram imagens com o texto embutido)
  botaoGrande: {
    // 82% da largura (igual ao antigo: tela menos 38 dp de cada lado), centralizado
    width: '82%',
    maxWidth: 480,
    alignSelf: 'center',
    minHeight: r(84),
    marginTop: r(30),
    paddingVertical: r(14),
    paddingLeft: r(22),
    paddingRight: r(14),
    borderRadius: r(26),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: r(0), height: r(3) },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },

  botaoGrandeEscuro: {
    marginTop: r(14),
    backgroundColor: '#17131D',
  },

  botaoGrandeTextos: {
    flex: 1,
    paddingRight: r(12),
  },

  botaoGrandeTitulo: {
    fontSize: rt(19),
    fontWeight: '700',
    color: '#111111',
  },

  botaoGrandeDescricao: {
    marginTop: r(4),
    fontSize: rt(14.5),
    lineHeight: rt(20),
    color: '#6F6F6F',
  },

  botaoGrandeTituloEscuro: {
    color: '#FFFFFF',
  },

  botaoGrandeDescricaoEscuro: {
    color: '#C9C5D0',
  },

  botaoGrandeIcone: {
    width: r(52),
    height: r(52),
    borderRadius: r(26),
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoGrandeIconeClaro: {
    backgroundColor: '#FFFFFF',
  },

  botaoGrandeIconeImg: {
    width: r(26),
    height: r(26),
  },

  analisarButton: {

  height:r(58),

  borderRadius:r(29),

  marginHorizontal:r(38),

  marginTop:r(20),

  justifyContent:"center",

  alignItems:"center",

  backgroundColor:"#1B152D",

  },


  analisarButtonText: {

  fontSize:rt(19),

  fontWeight:"600",

  color:"#FFFFFF",

  },

  analisarButtonDesativado: {
    opacity: 0.7,
  },

  ladosRow: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: r(20),
    padding: r(4),
    borderRadius: r(22),
    backgroundColor: "#ECE8F3",
  },

  ladoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: r(18),
    paddingVertical: r(10),
    borderRadius: r(20),
  },

  ladoButtonAtivo: {
    backgroundColor: "#4D2A95",
  },

  ladoTexto: {
    fontSize: rt(16),
    fontWeight: "600",
    color: "#4D2A95",
  },

  ladoTextoAtivo: {
    color: "#FFFFFF",
  },

  versoVazio: {
    alignItems: "center",
    paddingHorizontal: r(20),
  },

  versoVazioTexto: {
    marginTop: r(12),
    fontSize: rt(14),
    color: "#8A8A8A",
    textAlign: "center",
  },

  // Fundo lilás: deixa visíveis falhas do recorte (partes transparentes)
  uploadBoxRecorte: {
    borderStyle: "solid",
    borderColor: "#5d1ce0",
    backgroundColor: "#E6DFF3",
  },

  recorteImagem: {
    width: "90%",
    height: "90%",
  },

  aprovadoBadge: {
    position: "absolute",
    bottom: r(12), 
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: r(10),
    paddingVertical: r(4),
    borderRadius: r(12),
    backgroundColor: "#2E7D32",
  },

  aprovadoTexto: {
    marginLeft: r(4),
    fontSize: rt(13),
    fontWeight: "700",
    color: "#FFFFFF",
  },

  revisaoSubtitulo: {
    marginTop: r(4),
    fontSize: rt(15),
    color: "#8A8A8A",
  },

  revisaoImagemBox: {
    marginTop: r(15),
    width: r(230),
    height: r(230),
    borderRadius: r(20),
    backgroundColor: "#E6DFF3",
    justifyContent: "center",
    alignItems: "center",
  },

  revisaoImagem: {
    width: "92%",
    height: "92%",
  },

  girarRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: r(12),
    marginTop: r(12),
  },

  girarButton: {
    flexDirection: "row", 
    alignItems: "center",
    gap: r(6),
    paddingHorizontal: r(16),
    paddingVertical: r(10),
    borderRadius: r(20),
    borderWidth: 1,
    borderColor: "#4D2A95",
    backgroundColor: "#FFFFFF",
  },

  girarTexto: {
    fontSize: rt(16),
    fontWeight: "600",
    color: "#4D2A95",
  },

  sobreporTexto: {
    marginTop: r(8),
    fontSize: rt(15),
    fontWeight: "600",
    color: "#4D2A95",
  },

  cancelarButton: {
    marginTop: r(12),
    alignItems: "center",
    paddingVertical: r(10),
  },

  cancelarTexto: {
    fontSize: rt(17),
    fontWeight: "600",
    color: "#8A8A8A",
  },

  removerVersoButton: {
    position: "absolute",
    top: r(12),
    right: r(12),
    width: r(34),
    height: r(34),
    borderRadius: r(17),
    backgroundColor: "rgba(211,47,47,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingContainer: {
    width: "75%",
    backgroundColor: "#FFFFFF",
    borderRadius: r(25),
    paddingVertical: r(30),
    paddingHorizontal: r(20),
    alignItems: "center",
  },

  loadingTitulo: {
    marginTop: r(18),
    fontSize: rt(18),
    fontWeight: "700",
    color: "#1B152D",
  },

  loadingTexto: {
    marginTop: r(8),
    fontSize: rt(15),
    color: "#666",
    textAlign: "center",
  },

  modalBackground:{
    flex:1,
    backgroundColor:"rgba(0,0,0,0.5)",
    justifyContent:"center",
    alignItems:"center",
  },


  modalContainer:{
    width:"85%",
    backgroundColor:"#FFFFFF",
    borderRadius:r(25),
    padding:r(20),
    alignItems:"center",
  },


  resultadoImagem:{
    width:r(180),
    height:r(180),
    borderRadius:r(20),
  },


  resultadoTitulo:{
    marginTop:r(15),
    fontSize:rt(22),
    fontWeight:"700",
    color:"#1B152D",
  },


  resultadoTexto:{
    marginTop:r(8),
    fontSize:rt(17),
    color:"#555",
  },


  observacao:{
    marginTop:r(15),
    fontSize:rt(15),
    textAlign:"center",
    color:"#666",
  },


  fecharButton:{
    marginTop:r(20),
    backgroundColor:"#4D2A95",
    paddingVertical:r(12),
    paddingHorizontal:r(40),
    borderRadius:r(25),
  },


  fecharTexto:{
    color:"#FFF",
    fontSize:rt(17),
    fontWeight:"600",
  },

  trocarButton: {

    height: r(58),

    borderRadius: r(29),

    borderWidth: 1,

    borderColor: "#4D2A95",

    marginHorizontal: r(38),

    marginTop: r(70),

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#FFFFFF",

  },

  trocarButtonText: {

    marginLeft: r(10),

    fontSize: rt(19),

    fontWeight: "600",

    color: "#4D2A95",

  },

  acoesRow:{
    flexDirection:"row",
    justifyContent:"space-between",
    marginHorizontal:r(38),
    marginTop:r(35),
  },

  acaoButton: {
    flex: 1,
    marginHorizontal:r(6),
    height: r(88),
    borderRadius: r(20),

    borderWidth: 1,
    borderColor: "#4D2A95",

    backgroundColor: "#FFFFFF",

    justifyContent: "center",
    alignItems: "center",

    gap: r(5),
  },

  acaoButtonRoxo:{
    backgroundColor:"#4D2A95",
    borderColor:"#4D2A95",
  },

  acaoTexto: {
      marginTop: r(8),
      fontSize: rt(16),
      fontWeight: "700",
      color: "#4D2A95",
  },

    icon: {
      width: r(28),
      height: r(28),
    },

  modalBotoes:{
    width:"100%",
    marginTop:r(20),
  },


  salvarButton:{
    height:r(58),
    borderRadius:r(25),

    backgroundColor:"#4D2A95",

    justifyContent:"center",
    alignItems:"center",

    marginBottom:r(12),
  },


  salvarTexto:{
    color:"#FFFFFF",
    fontSize:rt(17),
    fontWeight:"700",
  },


  novaButton:{
    height:r(58),
    borderRadius:r(25),

    borderWidth:1,
    borderColor:"#4D2A95",

    backgroundColor:"#FFFFFF",

    justifyContent:"center",
    alignItems:"center",
  },


  novaTexto:{
    color:"#4D2A95",
    fontSize:rt(17),
    fontWeight:"700",
  },
    
  });
}
