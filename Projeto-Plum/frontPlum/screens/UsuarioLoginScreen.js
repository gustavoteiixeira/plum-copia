import React, { useMemo, useState } from "react";

import {

  View,
  ImageBackground,
  Text,

  TouchableOpacity,

  TextInput,

  Modal,

  ScrollView,

  StyleSheet,

  Alert,

  KeyboardAvoidingView,

  Platform,

} from "react-native";



import * as SecureStore from "expo-secure-store";



import {

  criarUsuario,

  recuperarUsuario,

  enviarCodigoCadastro,

  enviarCodigoRecuperacao,

  confirmarRecuperacaoEmail,

} from "../services/usuarioService";

import VerificacaoCodigo from "../components/VerificacaoCodigo";

import { useUsuario } from "../context/UserContext";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEscala } from "../styles/escala";

import FormularioCadastro, { validarCadastro } from "../components/FormularioCadastro";



const TERMOS_USO_IMAGEM = `CONDIÇÕES DE USO DAS IMAGENS

Ao utilizar as funcionalidades do aplicativo que permitem selecionar imagens da galeria do dispositivo, o usuário declara estar ciente e de acordo com as condições descritas abaixo.


1\. ACESSO À GALERIA

O aplicativo poderá solicitar permissão para acessar a galeria de imagens do dispositivo exclusivamente para permitir que o usuário selecione fotografias de peças de vestuário que deseja cadastrar em seu guarda-roupa digital. O acesso à galeria será utilizado apenas para as funcionalidades relacionadas ao cadastro, visualização, organização e recomendação das peças cadastradas pelo usuário.


2\. SELEÇÃO DAS IMAGENS

O usuário possui controle sobre as imagens que deseja selecionar e disponibilizar ao aplicativo. O acesso à galeria não significa que todas as imagens armazenadas no dispositivo serão automaticamente coletadas, utilizadas ou enviadas pelo aplicativo. Apenas as imagens selecionadas pelo próprio usuário poderão ser utilizadas nas funcionalidades correspondentes.


3\. FINALIDADE DE USO

As imagens selecionadas pelo usuário poderão ser utilizadas para:
• cadastrar peças de vestuário no guarda-roupa digital;
• visualizar e organizar as peças cadastradas;
• identificar características visuais das peças;
• extrair informações como categoria, cores, estilo, textura e outras características relacionadas ao vestuário;
• realizar o processamento necessário para melhorar a identificação da peça;
• gerar recomendações e sugestões de combinações de roupas.

As imagens não deverão ser utilizadas para finalidades incompatíveis com o funcionamento das funcionalidades oferecidas pelo aplicativo.


4\. PROCESSAMENTO DAS IMAGENS

As imagens selecionadas poderão passar por processos automatizados necessários para o funcionamento do aplicativo. Esses processos poderão incluir análise visual, identificação de características da peça, extração de informações e processamento da imagem.
As informações obtidas a partir das imagens poderão ser utilizadas para melhorar a organização do guarda-roupa digital e gerar recomendações personalizadas.



5\. UTILIZAÇÃO DE INTELIGÊNCIA ARTIFICIAL

O aplicativo poderá utilizar recursos de inteligência artificial para analisar as características visuais das imagens selecionadas e identificar informações relacionadas às peças de vestuário.
O usuário está ciente de que os resultados gerados por sistemas automatizados e de inteligência artificial podem apresentar variações ou imprecisões. As informações identificadas automaticamente têm como finalidade auxiliar o funcionamento das funcionalidades de organização e recomendação disponíveis no aplicativo.


6\. RESPONSABILIDADE SOBRE AS IMAGENS

Ao selecionar e utilizar uma imagem no aplicativo, o usuário declara possuir os direitos ou autorizações necessários para sua utilização. O usuário é responsável pelo conteúdo das imagens selecionadas e compromete-se a não utilizar imagens que:
• utilizem a imagem de outras pessoas sem autorização, quando aplicável;
• contenham conteúdo ilegal ou inadequado;
• violem direitos de privacidade ou propriedade intelectual de terceiros.


7\. ARMAZENAMENTO DAS IMAGENS

As imagens selecionadas poderão ser armazenadas e associadas às peças cadastradas no guarda-roupa digital do usuário, conforme necessário para o funcionamento das funcionalidades do aplicativo.
Essas imagens poderão ser utilizadas para permitir a visualização das peças e a geração de recomendações baseadas no guarda-roupa cadastrado.


8\. EXCLUSÃO DAS IMAGENS
O usuário poderá excluir imagens e peças cadastradas por meio das funcionalidades disponibilizadas pelo aplicativo. Após a exclusão, a imagem deixará de ser utilizada nas recomendações e funcionalidades relacionadas à peça removida, observados eventuais períodos técnicos necessários para a atualização ou remoção dos dados dos sistemas utilizados pelo aplicativo.


9\. CONTROLE DE PERMISSÕES

O usuário poderá gerenciar ou revogar a permissão de acesso à galeria a qualquer momento por meio das configurações do seu dispositivo.
A revogação da permissão poderá limitar ou impedir a utilização de funcionalidades que dependam da seleção de imagens.


10\. DADOS DE CADASTRO E DO APARELHO

Para criar a conta, o aplicativo solicita nome, e-mail e gênero. O e-mail é usado para identificar a conta e permitir sua recuperação. O gênero (que pode ser "Prefiro não informar") é usado apenas de forma agregada, em estatísticas da pesquisa.
O aplicativo também registra informações técnicas do aparelho: se é um celular real, marca, modelo, sistema operacional e sua versão, tipo de aparelho e versão do aplicativo. Nenhum identificador único do aparelho é coletado.
Esses dados não são vendidos nem compartilhados, são usados apenas para o funcionamento do aplicativo e para a pesquisa acadêmica, e são apagados quando a conta é excluída.


11\. ACEITE

Ao conceder permissão de acesso à galeria e selecionar imagens para utilização no aplicativo, o usuário declara que leu e concorda com estas Condições de Uso das Imagens.
usuário autoriza a utilização das imagens selecionadas exclusivamente para as finalidades relacionadas ao cadastro, processamento, organização e recomendação de peças de vestuário dentro do aplicativo.

`;



export default function UsuarioLoginScreen({ navigation }) {

  const { entrar } = useUsuario();

  // Medidas proporcionais ao tamanho real da tela
  const medidas = useEscala();

  // Área segura (barra de gestos / navegação) para o painel não encostar na base
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () => criarStyles({ ...medidas, insetBottom: insets.bottom }),
    [medidas, insets.bottom]
  );

  const [recuperar, setRecuperar] = useState(false);

  const [codigo, setCodigo] = useState("");



  // Modal dos termos

  const [modalTermos, setModalTermos] = useState(false);



  // Checkbox de aceite

  const [aceitouTermos, setAceitouTermos] = useState(false);



  // Evita clique duplo ao criar conta

  const [criandoConta, setCriandoConta] = useState(false);



  // Etapa do formulário (nome, e-mail, gênero), depois do aceite dos termos

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [dadosCadastro, setDadosCadastro] = useState({ nome: "", email: "", genero: null });

  const [erroCadastro, setErroCadastro] = useState(null);



  // Tela do código de 6 dígitos: null | "cadastro" | "recuperacao"

  const [etapaCodigo, setEtapaCodigo] = useState(null);



  // Recuperação: "email" (padrão) ou "plu" (código de recuperação)

  const [modoRecuperar, setModoRecuperar] = useState("email");

  const [emailRecuperacao, setEmailRecuperacao] = useState("");

  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);



  async function handleLogin() {

    // Recuperação de conta continua funcionando normalmente

    if (recuperar && modoRecuperar === "email") {

      await pedirCodigoRecuperacao();

      return;

    }



    if (recuperar) {

      try {

        const usuario = await recuperarUsuario(codigo);



        console.log("Conta recuperada:", usuario);



        // Atualiza o usuário em memória (Home/Perfil) sem precisar reabrir o app

        entrar(usuario);



// Zera a pilha: o "voltar" do celular não retorna ao login/onboarding

        navigation.reset({ index: 0, routes: [{ name: "Home" }] });

      } catch (error) {

        console.log(

          "Erro recuperar conta:",

          error.message

        );



        Alert.alert(

          "Erro",

          error.message || "Não foi possível recuperar sua conta."

        );

      }



      return;

    }



    // Primeiro login NÃO cria mais a conta imediatamente.

    // Abre os termos primeiro.

    setAceitouTermos(false);

    setModalTermos(true);

  }



  // Aceite dos termos -> abre o formulário de cadastro

  async function aceitarTermos() {

    if (!aceitouTermos) {

      return;

    }



    /*

     * Salva localmente o aceite.

     *

     * Em produção, o ideal é salvar também

     * essa informação no BACKEND.

     */

    await SecureStore.setItemAsync(

      "aceite_termos_imagem",

      JSON.stringify({

        aceito: true,

        versao: "1.1",

        dataAceite: new Date().toISOString(),

      })

    );



    setModalTermos(false);

    setErroCadastro(null);

    setMostrarFormulario(true);

  }



  // Dados do formulário já limpos

  function dadosLimpos() {

    return {

      nome: dadosCadastro.nome.trim(),

      email: dadosCadastro.email.trim().toLowerCase(),

      genero: dadosCadastro.genero,

    };

  }



  // Formulário -> envia o código de confirmação para o e-mail

  async function enviarCadastro() {

    if (criandoConta) {

      return;

    }



    const problema = validarCadastro(dadosCadastro);



    if (problema) {

      setErroCadastro(problema);

      return;

    }



    try {

      setCriandoConta(true);

      setErroCadastro(null);



      await enviarCodigoCadastro(dadosLimpos());



      setEtapaCodigo("cadastro");

    } catch (error) {

      console.log("Erro ao enviar código:", error.message);



      // Ex.: "Este e-mail já está em uso." / "Aguarde 40 segundos..."

      setErroCadastro(error.message || "Não foi possível enviar o código.");

    } finally {

      setCriandoConta(false);

    }

  }



  // Código confirmado -> cria a conta

  async function confirmarCadastro(codigoEmail) {

    const usuario = await criarUsuario({ ...dadosLimpos(), codigo: codigoEmail });



    console.log("Novo usuário:", usuario);



    // Atualiza o usuário em memória e registra o aparelho

    entrar(usuario);



    // Zera a pilha: o "voltar" do celular não retorna ao login/onboarding

    navigation.reset({ index: 0, routes: [{ name: "Home" }] });

  }



  // Recuperação por e-mail: pede o código

  async function pedirCodigoRecuperacao() {

    if (enviandoRecuperacao) {

      return;

    }



    const email = emailRecuperacao.trim().toLowerCase();



    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {

      Alert.alert("E-mail inválido", "Digite o e-mail cadastrado na sua conta.");

      return;

    }



    try {

      setEnviandoRecuperacao(true);



      await enviarCodigoRecuperacao(email);



      setEmailRecuperacao(email);

      setEtapaCodigo("recuperacao");

    } catch (error) {

      Alert.alert("Erro", error.message || "Não foi possível enviar o código.");

    } finally {

      setEnviandoRecuperacao(false);

    }

  }



  // Recuperação por e-mail: código confirmado -> entra na conta

  async function confirmarRecuperacao(codigoEmail) {

    const usuario = await confirmarRecuperacaoEmail(emailRecuperacao, codigoEmail);



    console.log("Conta recuperada por e-mail:", usuario);



    entrar(usuario);



    navigation.reset({ index: 0, routes: [{ name: "Home" }] });

  }



  function recusarTermos() {

    setAceitouTermos(false);

    setModalTermos(false);

  }



  // Código de 6 dígitos (cadastro ou recuperação)

  if (etapaCodigo) {

    const cadastro = etapaCodigo === "cadastro";



    return (

      <KeyboardAvoidingView

        style={{ flex: 1 }}

        behavior={Platform.OS === "ios" ? "padding" : undefined}

      >

        <ScrollView

          contentContainerStyle={styles.formularioContainer}

          keyboardShouldPersistTaps="handled"

        >

          <VerificacaoCodigo

            email={cadastro ? dadosLimpos().email : emailRecuperacao}

            onConfirmar={cadastro ? confirmarCadastro : confirmarRecuperacao}

            onReenviar={() =>

              cadastro

                ? enviarCodigoCadastro(dadosLimpos())

                : enviarCodigoRecuperacao(emailRecuperacao)

            }

            onVoltar={() => setEtapaCodigo(null)}

            textoVoltar={cadastro ? "Corrigir dados" : "Usar outro e-mail"}

            condicional={!cadastro}

          />

        </ScrollView>

      </KeyboardAvoidingView>

    );

  }



  // Etapa 2 do cadastro: nome, e-mail e gênero

  if (mostrarFormulario) {

    return (

      <KeyboardAvoidingView

        style={{ flex: 1 }}

        behavior={Platform.OS === "ios" ? "padding" : undefined}

      >

        <ScrollView

          contentContainerStyle={styles.formularioContainer}

          keyboardShouldPersistTaps="handled"

        >

          <Text style={styles.titulo}>

            Crie sua conta

          </Text>



          <Text style={[styles.subtitulo, { marginBottom: 20 }]}>

            Só mais alguns dados para começar

          </Text>



          <FormularioCadastro

            valores={dadosCadastro}

            onChange={setDadosCadastro}

            onEnviar={enviarCadastro}

            enviando={criandoConta}

            erro={erroCadastro}

          />



          <TouchableOpacity

            style={{ marginTop: 18, alignItems: "center" }}

            onPress={() => setMostrarFormulario(false)}

            disabled={criandoConta}

          >

            <Text style={styles.link}>

              Voltar

            </Text>

          </TouchableOpacity>

        </ScrollView>

      </KeyboardAvoidingView>

    );

  }



  return (
    <View style={styles.screenRoot}>
      {!recuperar ? (
        <ImageBackground
          source={require("../assets/images/background-cadastro.png")}
          style={styles.backgroundCadastro}
          resizeMode="cover"
        >
          <View style={styles.painelCadastro}>
            <Text style={styles.logoPlum}>PLUM</Text>
            <Text style={styles.subtituloCadastro}>
              Escolha uma opção para <Text style={styles.destaqueAcessar}>acessar</Text> sua conta
            </Text>
            <View style={styles.botoesCadastro}>
              <TouchableOpacity style={styles.botaoLogin} onPress={() => setRecuperar(true)} activeOpacity={0.85}>
                <Text style={styles.textoBotaoLogin}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botaoCadastrar} onPress={handleLogin} activeOpacity={0.85}>
                <Text style={styles.textoBotaoCadastrar}>Cadastrar conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <KeyboardAvoidingView style={styles.recuperacaoTela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.recuperacaoConteudo} keyboardShouldPersistTaps="handled">
            <Text style={styles.titulo}>Acesse sua conta</Text>
            <Text style={styles.subtituloRecuperacao}>Recupere sua conta para continuar no PLUM</Text>
            <View style={styles.modosRow}>
              {[["email", "Pelo e-mail"], ["plu", "Pelo código PLU"]].map(([modo, rotulo]) => (
                <TouchableOpacity key={modo} style={[styles.modo, modoRecuperar === modo && styles.modoAtivo]} onPress={() => setModoRecuperar(modo)}>
                  <Text style={[styles.modoTexto, modoRecuperar === modo && styles.modoTextoAtivo]}>{rotulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {modoRecuperar === "email" ? (
              <TextInput placeholder="Digite o e-mail da sua conta" value={emailRecuperacao} onChangeText={setEmailRecuperacao} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input} />
            ) : (
              <TextInput placeholder="Digite seu código de recuperação" value={codigo} onChangeText={setCodigo} autoCapitalize="none" autoCorrect={false} style={styles.input} />
            )}
            <TouchableOpacity style={[styles.botaoPrincipal, enviandoRecuperacao && { opacity: 0.7 }]} onPress={handleLogin} disabled={enviandoRecuperacao}>
              <Text style={styles.textoBotaoPrincipal}>{modoRecuperar === "email" ? (enviandoRecuperacao ? "Enviando..." : "Enviar código") : "Vincular conta"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRecuperar(false); setCodigo(""); }} style={styles.voltarInicio}>
              <Text style={styles.link}>Voltar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={modalTermos} animationType="slide" transparent onRequestClose={recusarTermos}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Uso de imagens</Text>
            <Text style={styles.modalDescricao}>Leia as condições abaixo antes de criar sua conta.</Text>
            <ScrollView style={styles.termosContainer} contentContainerStyle={styles.termosContent} showsVerticalScrollIndicator>
              <Text style={styles.termosTexto}>{TERMOS_USO_IMAGEM}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitouTermos(!aceitouTermos)} activeOpacity={0.7}>
              <View style={[styles.checkbox, aceitouTermos && styles.checkboxSelecionado]}>{aceitouTermos && <Text style={styles.check}>✓</Text>}</View>
              <Text style={styles.checkboxTexto}>Li e concordo com as Condições de Uso das Imagens e dos dados de cadastro.</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!aceitouTermos || criandoConta} onPress={aceitarTermos} style={[styles.botaoAceitar, (!aceitouTermos || criandoConta) && styles.botaoDesabilitado]}>
              <Text style={styles.botaoAceitarTexto}>Concordar e continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={criandoConta} onPress={recusarTermos} style={styles.botaoRecusar}>
              <Text style={styles.botaoRecusarTexto}>Não concordo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


// Largura máxima do conteúdo dos formulários (evita campos esticados em telas largas)
const LARGURA_MAX_CONTEUDO = 480;

function criarStyles({ width, height, e, es, alturaTermos, insetBottom = 0 }) {
  const r = (n) => Math.round(n * e);
  const rs = (n) => Math.round(n * es);

  // Padding lateral que centraliza o conteúdo e respeita a largura máxima
  const lateral = (minimo) => Math.max(minimo, (width - LARGURA_MAX_CONTEUDO) / 2);

  return StyleSheet.create({
    screenRoot: { flex: 1, backgroundColor: "#FFFFFF" },
    backgroundCadastro: { flex: 1, width: "100%", justifyContent: "flex-end", backgroundColor: "#452783" },
    painelCadastro: {
      width: "100%", minHeight: r(250), paddingTop: r(64), paddingHorizontal: lateral(r(26)), paddingBottom: r(40) + Math.round(height * 0.04) + insetBottom,
      alignItems: "center", justifyContent: "flex-start", backgroundColor: "#FFFFFF",
      borderTopLeftRadius: r(34), borderTopRightRadius: r(34), overflow: "hidden",
    },
    logoPlum: { color: "#17131D", fontSize: r(48), lineHeight: r(46), fontWeight: "900", letterSpacing: 0.3, textAlign: "center" },
    subtituloCadastro: { marginTop: r(2), marginBottom: r(40), color: "#17131D", fontSize: r(12.5), textAlign: "center" },
    destaqueAcessar: { color: "#512D91", fontWeight: "700" },
    botoesCadastro: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: r(8) },
    botaoLogin: { flex: 1, height: r(48), borderRadius: r(20), backgroundColor: "#17131D", alignItems: "center", justifyContent: "center" },
    textoBotaoLogin: { color: "#FFFFFF", fontSize: r(14.5), fontWeight: "500" },
    botaoCadastrar: { flex: 1, height: r(48), borderRadius: r(20), backgroundColor: "#4A2A88", alignItems: "center", justifyContent: "center" },
    textoBotaoCadastrar: { color: "#FFFFFF", fontSize: r(14.5), fontWeight: "500" },
    recuperacaoTela: { flex: 1, backgroundColor: "#FFFFFF" },
    recuperacaoConteudo: { flexGrow: 1, justifyContent: "center", paddingHorizontal: lateral(rs(26)), paddingVertical: rs(32) },
    subtituloRecuperacao: { textAlign: "center", color: "#666666", marginBottom: rs(28), fontSize: rs(14) },
    voltarInicio: { alignItems: "center", paddingVertical: rs(12) },

    container: { flex: 1, justifyContent: "center", alignItems: "center", padding: rs(30), backgroundColor: "#FFF" },

    formularioContainer: {
      flexGrow: 1, justifyContent: "center", paddingVertical: rs(25),
      paddingHorizontal: lateral(rs(25)), backgroundColor: "#F7F7F7",
    },

    titulo: { textAlign: "center", fontSize: rs(26), fontWeight: "700", marginBottom: rs(10) },
    subtitulo: { textAlign: "center", marginBottom: rs(40), color: "#555", fontSize: rs(14) },

    input: {
      width: "100%", height: rs(50), borderWidth: 1, borderColor: "#CCC", borderRadius: rs(10),
      paddingHorizontal: rs(15), marginBottom: rs(20), fontSize: rs(14),
    },

    botaoPrincipal: {
      width: "100%", height: rs(50), backgroundColor: "#5A31A9", borderRadius: rs(25),
      justifyContent: "center", alignItems: "center", marginBottom: rs(20),
    },
    textoBotaoPrincipal: { color: "#FFF", fontSize: rs(16), fontWeight: "600" },

    link: { color: "#5A31A9", fontWeight: "500", fontSize: rs(14) },

    modosRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: rs(8), marginBottom: rs(14) },
    modo: {
      paddingHorizontal: rs(14), paddingVertical: rs(8), borderRadius: rs(18),
      borderWidth: 1, borderColor: "#5A31A9", backgroundColor: "#FFFFFF",
    },
    modoAtivo: { backgroundColor: "#5A31A9" },
    modoTexto: { fontSize: rs(13), fontWeight: "600", color: "#5A31A9" },
    modoTextoAtivo: { color: "#FFFFFF" },

    // -------------------------
    // MODAL
    // -------------------------

    modalBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: rs(20) },
    modalContainer: {
      width: "100%", maxWidth: 520, alignSelf: "center", backgroundColor: "#FFF",
      borderRadius: rs(20), padding: rs(20), maxHeight: "92%",
    },
    modalTitulo: { fontSize: rs(22), fontWeight: "700", color: "#222", marginBottom: rs(5) },
    modalDescricao: { fontSize: rs(14), color: "#666", marginBottom: rs(15) },

    termosContainer: {
      borderWidth: 1, borderColor: "#E5E5E5", borderRadius: rs(12), marginBottom: rs(20),
      maxHeight: alturaTermos,
    },
    termosContent: { padding: rs(15) },
    termosTexto: { fontSize: rs(14), lineHeight: rs(21), color: "#333" },

    // -------------------------
    // CHECKBOX
    // -------------------------

    checkboxContainer: { flexDirection: "row", alignItems: "flex-start", marginBottom: rs(20) },
    checkbox: {
      width: rs(24), height: rs(24), borderRadius: 5, borderWidth: 2, borderColor: "#5A31A9",
      justifyContent: "center", alignItems: "center", marginRight: rs(10), marginTop: 1,
    },
    checkboxSelecionado: { backgroundColor: "#5A31A9" },
    check: { color: "#FFF", fontWeight: "bold", fontSize: rs(16) },
    checkboxTexto: { flex: 1, fontSize: rs(14), lineHeight: rs(20), color: "#333" },

    // -------------------------
    // BOTÕES DO MODAL
    // -------------------------

    botaoAceitar: {
      backgroundColor: "#5A31A9", height: rs(50), borderRadius: rs(25),
      justifyContent: "center", alignItems: "center",
    },
    botaoDesabilitado: { opacity: 0.4 },
    botaoAceitarTexto: { color: "#FFF", fontSize: rs(16), fontWeight: "600" },
    botaoRecusar: { height: rs(45), justifyContent: "center", alignItems: "center", marginTop: 5 },
    botaoRecusarTexto: { color: "#666", fontSize: rs(15) },
  });
}
