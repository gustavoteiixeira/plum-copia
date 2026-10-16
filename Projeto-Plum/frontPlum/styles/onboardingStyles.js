import { StyleSheet } from 'react-native';

// Medidas do bloco de baixo (bolinhas, PLUM, texto e botão).
// A tela usa estes valores para o carrossel nunca ficar por baixo do bloco.
//   e  : escala cheia (tamanhos)      es : escala suave (textos)
export function medidasOnboarding(e, es) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;

  const tituloAltura = r(72);
  const descricaoLinha = rt(20);
  // Mínimo de 52 dp: área de toque confortável mesmo em celulares estreitos
  const botaoAltura = Math.max(52, r(54), rt(20) * 1.25 + r(8) * 2);

  // Soma do bloco de baixo, reservando 2 linhas para a descrição (telas estreitas)
  const alturaBloco =
    r(32) + // respiro de baixo
    botaoAltura + r(17) + // botão + espaço acima dele
    descricaoLinha * 2 + r(2) + // descrição
    tituloAltura + // PLUM
    r(4) + r(2) + // bolinhas
    r(2); // respiro de cima

  return { alturaBloco, botaoAltura, tituloAltura, descricaoLinha };
}

// Estilos proporcionais ao tamanho da tela (ver styles/escala.js)
export default function criarOnboardingStyles({ e, es }) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;
  const { botaoAltura, tituloAltura, descricaoLinha } = medidasOnboarding(e, es);

  return StyleSheet.create({
    // Respeita a área segura do aparelho.
    safeArea: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },

    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
    },

    carouselContainer: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      zIndex: 0,
    },

    imageContainer: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    },

    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },

    content: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: r(24),
      paddingTop: r(2),
      paddingBottom: r(32),
      zIndex: 1,
    },

    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(2),
      marginBottom: r(2),
    },

    title: {
      color: '#17131D',
      fontSize: rt(60),
      fontWeight: '900',
      letterSpacing: -1.2 * es,
      textAlign: 'center',
      lineHeight: tituloAltura,
      includeFontPadding: false,
    },

    description: {
      color: '#17131D',
      fontSize: rt(14.5),
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: descricaoLinha,
      marginTop: r(2),
      flexShrink: 1,
    },

    highlight: {
      color: '#552BA5',
      fontWeight: '700',
    },

    // Largura fluida com limite para telas maiores.
    button: {
      width: '100%',
      maxWidth: 420,
      minHeight: botaoAltura,
      borderRadius: r(27),
      backgroundColor: '#17131D',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: r(17),
      paddingHorizontal: r(16),
      paddingVertical: r(8),
      flexShrink: 0,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: rt(20),
      fontWeight: '500',
      textAlign: 'center',
    },
  });
}
