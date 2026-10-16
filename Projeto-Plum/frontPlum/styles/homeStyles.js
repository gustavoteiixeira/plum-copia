import { StyleSheet } from 'react-native';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Proporções reais dos PNGs (largura / altura).
const RAZAO_CARD = 364 / 194; // guarda_roupas.png e chat_plum.png
const RAZAO_BOTAO = 665 / 106; // cadastrar_peca.png
const RAZAO_PERSONA = 249 / 376; // personas/*.png

// As fotos das personas têm uma margem transparente em cima: o topo do cabelo
// começa a ~1,5% da altura e o cartão a ~10,6%. O vão do carrossel desconta isso,
// para a distância visível até a foto ser a que se pede.
const MARGEM_TOPO_FOTO = 0.015;
const DISTANCIA_VISIVEL = 8; // dp entre a chamada e o topo da foto

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Fração da largura ocupada pela persona central do carrossel.
const LARGURA_PERSONA = 0.58;

// Largura máxima da área de conteúdo (evita botões gigantes em tablets).
const LARGURA_MAX = 560;

/**
 * Calcula todas as medidas da Home a partir do tamanho da janela.
 * Tudo é proporcional à largura, então o layout mantém a mesma
 * aparência relativa em qualquer aparelho. A altura só entra como
 * limitador, para não estourar em telas curtas.
 */
export function medidasHome(width, height) {
  const largura = Math.min(width, LARGURA_MAX);

  const scaleX = clamp(largura / BASE_WIDTH, 0.75, 1.6);
  const scaleY = clamp(height / BASE_HEIGHT, 0.7, 1.6);
  const scale = Math.min(scaleX, scaleY);

  // Distância do topo da tela até a saudação (proporcional à altura).
  const topoOffset = clamp(height * 0.085, 40, 96);

  // Quanto o botão do perfil ("Olá, Nome.") sobe em relação à posição normal.
  // Proporcional à altura; o limite deixa ao menos 32 dp até o topo da tela,
  // para não encostar na barra de status.
  const subidaPerfil = clamp(Math.min(height * 0.032, topoOffset - 32), 0, 48);

  // Cards "Guarda-roupas" e "Chat": metade da largura, altura pela proporção da imagem.
  const margemCards = largura * 0.04;
  const espacoCards = largura * 0.03;
  const cardWidth = (largura - 2 * margemCards - espacoCards) / 2;
  const cardHeight = cardWidth / RAZAO_CARD;

  // Botão "Cadastrar peça": quase a largura inteira.
  const bottomWidth = largura * 0.94;
  const bottomHeight = bottomWidth / RAZAO_BOTAO;

  // Carrossel: proporcional à largura; a altura limita se a tela for curta.
  const alturaNatural = (largura * LARGURA_PERSONA) / RAZAO_PERSONA;
  const vaoAprox = DISTANCIA_VISIVEL * scaleY - MARGEM_TOPO_FOTO * alturaNatural;
  const alturaFixa =
    topoOffset + // respiro do topo
    vaoAprox + // vão entre a chamada e o carrossel
    (30 + 52 + 26) * scale + // saudação + logotipo + chamada
    cardHeight +
    bottomHeight +
    12 * scaleY + // espaço entre cards e botão
    30 * scale + // rodapé
    36; // respiros mínimos entre os grupos
  const sobra = height - alturaFixa;
  const carouselHeight = Math.round(
    clamp(Math.min(alturaNatural, sobra), 140, 640)
  );
  // Vão final: distância visível menos a margem transparente da foto (pode ser ~0)
  const vaoCarrossel = DISTANCIA_VISIVEL * scaleY - MARGEM_TOPO_FOTO * carouselHeight;
  const itemWidth = Math.round(
    Math.min(largura * LARGURA_PERSONA, carouselHeight * RAZAO_PERSONA * 1.08)
  );

  return {
    topoOffset,
    subidaPerfil,
    vaoCarrossel,
    largura,
    scale,
    scaleX,
    scaleY,
    margemCards,
    espacoCards,
    cardWidth,
    cardHeight,
    bottomWidth,
    bottomHeight,
    carouselHeight,
    itemWidth,
  };
}

export default function createHomeStyles(width, height) {
  const m = medidasHome(width, height);
  const { scale, scaleX, scaleY } = m;

  return StyleSheet.create({
    homeContainer: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },

    // Preserva a distribuição e os espaçamentos do layout original.
    homeContent: {
      flex: 1,
      paddingHorizontal: 0,
      paddingTop: m.topoOffset,
      paddingBottom: 6 * scaleY,
      justifyContent: 'space-between',
    },

    // Topo: saudação, logotipo e chamada ficam juntos, com espaços fixos.
    topo: {
      width: '100%',
    },

    header: {
      width: '100%',
      alignItems: 'center',
    },

    greetingButton: {
      alignSelf: 'flex-start',
      marginLeft: 12 * scaleX,
      // Deslocamento relativo: sobe só o botão, sem empurrar o PLUM nem o resto
      position: 'relative',
      top: -m.subidaPerfil,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7 * scale,
      maxWidth: '70%',
    },

    profileIcon: {
      width: 30 * scale,
      height: 30 * scale,
      borderWidth: 1,
      borderColor: '#A59CB8',
      borderRadius: 15 * scale,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    greetingText: {
      fontSize: 11.5 * scale,
      color: '#414042',
      flexShrink: 1,
    },

    // Mantém o tamanho e a posição vertical originais do logotipo.
    homeTitle: {
      fontSize: 44 * scale,
      fontWeight: '900',
      letterSpacing: -1.5 * scale,
      color: '#17131F',
      textAlign: 'center',
      includeFontPadding: false,
      marginTop: 4 * scaleY,
    },

    descriptionContainer: {
      alignItems: 'center',
      justifyContent: 'center', 
      paddingTop: 0,
      paddingBottom: 0,
      paddingHorizontal: 12 * scaleX,
      marginTop: 2 * scaleY,
    },

    homeDescription: {
      textAlign: 'center',
      fontSize: 16 * scale,
      fontWeight: '700',
      color: '#17131F',
    },

    homeDescriptionHighlight: {
      color: '#552593',
      fontWeight: '800',
    },

    carouselContainer: {
      alignSelf: 'center',
      overflow: 'hidden',
      marginTop: m.vaoCarrossel,
    },

    carouselContent: {
      alignItems: 'center',
    },

    carouselItem: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    personaImage: {
      // A imagem usa a mesma área para todas as personas.
      width: '100%',
      height: '100%',
    },

    // Cards e botão de cadastro ficam juntos, com um respiro pequeno.
    ferramentas: {
      width: '100%',
      gap: 12 * scaleY,
    },

    cardsRow: {
      width: m.largura,
      alignSelf: 'center',
      paddingHorizontal: m.margemCards,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: m.espacoCards,
    },

    toolButton: {
      width: m.cardWidth,
      height: m.cardHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    toolCard: {
      width: '100%',
      height: '100%',
    },

    bottomButton: {
      width: m.largura,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },

    bottomCard: {
      width: m.bottomWidth,
      height: m.bottomHeight,
    },

    footer: {
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },

    footerText: {
      textAlign: 'center',
      fontSize: 13.5 * scale,
      color: '#96919A',
      paddingBottom: 8 * scaleY,
    },
  });
}
