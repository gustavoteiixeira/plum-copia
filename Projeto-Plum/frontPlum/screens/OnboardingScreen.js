
import React, { useMemo, useState } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Carousel from 'react-native-reanimated-carousel';

import Dot from '../components/Dot';
import criarOnboardingStyles, { medidasOnboarding } from '../styles/onboardingStyles';
import { useEscala } from '../styles/escala';

import {
  verificarUsuarioLocal,
  buscarUsuario,
} from '../services/usuarioService';

import { useUsuario } from '../context/UserContext';

const images = [
  require('../assets/images/banner1.png'),
  require('../assets/images/banner2.png'),
  require('../assets/images/banner3.png'),
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Atualiza as medidas quando a tela ou orientação muda.
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { entrar } = useUsuario();

  // Escala pela largura da tela (nunca encolhe o botão e os textos em telas baixas)
  const { ew: e, esw: es } = useEscala();
  const styles = useMemo(() => criarOnboardingStyles({ e, es }), [e, es]);
  const { alturaBloco } = useMemo(() => medidasOnboarding(e, es), [e, es]);

  // Considera as áreas seguras para calcular o espaço disponível.
  const availableHeight = Math.max(
    height - insets.top - insets.bottom,
    300
  );

  // Altura do carrossel: a mesma de antes, mas nunca maior que o espaço que
  // sobra acima do bloco de baixo (bolinhas, PLUM, texto e botão).
  const carouselHeight = Math.min(
    width * 1.5,
    availableHeight * (availableHeight < 650 ? 0.64 : 0.72),
    availableHeight - alturaBloco - 8
  );

  async function handleEntrar() {
    try {
      const codigo = await verificarUsuarioLocal();

      // Sem código salvo, solicita o login.
      if (!codigo) {
        navigation.navigate('UsuarioLogin');
        return;
      }

      const usuario = await buscarUsuario(codigo);

      // Se o usuário não existir mais no banco, solicita novo login.
      if (!usuario) {
        navigation.navigate('UsuarioLogin');
        return;
      }

      entrar(usuario);

      // Impede o retorno ao onboarding pelo botão voltar.
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.log('Erro ao entrar:', error.message);

      Alert.alert(
        'Não foi possível entrar',
        error.message || 'Não foi possível conectar. Tente novamente.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tentar de novo', onPress: handleEntrar },
        ]
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Imagens proporcionais à tela do aparelho */}
        <View style={[styles.carouselContainer, { height: carouselHeight }]}>
          <Carousel
            loop
            autoPlay
            autoPlayInterval={3000}
            scrollAnimationDuration={800}
            width={width}
            height={carouselHeight}
            data={images}
            onSnapToItem={setCurrentIndex}
            renderItem={({ item }) => (
              <View style={styles.imageContainer}>
                <Image
                  source={item}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            )}
          />
        </View>

        {/* Indicadores, marca, descrição e botão */}
        <View style={styles.content}>
          <View style={styles.pagination}>
            {images.map((_, index) => (
              <Dot key={index} active={currentIndex === index} />
            ))}
          </View>

          <Text style={styles.title}>PLUM</Text>

          <Text style={styles.description}>
            Bem-vindo ao seu{' '}
            <Text style={styles.highlight}>novo</Text>{' '}
            jeito de se vestir.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleEntrar}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Entrar agora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
