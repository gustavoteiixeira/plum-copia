import React, { useRef, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  Image,
  TouchableOpacity,
  Animated,
  FlatList,
  useWindowDimensions,
} from 'react-native';

import { useUsuario } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import createHomeStyles, { medidasHome } from '../styles/homeStyles';

// Personas originais do carrossel.
const PERSONAS = [
  { id: '1', source: require('../assets/images/personas/1.png') },
  { id: '2', source: require('../assets/images/personas/2.png') },
  { id: '3', source: require('../assets/images/personas/3.png') },
  { id: '4', source: require('../assets/images/personas/4.png') },
  { id: '5', source: require('../assets/images/personas/5.png') },
  { id: '6', source: require('../assets/images/personas/6.png') },
];

// Clones nas pontas permitem o loop sem mudar a aparência do carrossel.
const LOOP_PERSONAS = [
  { ...PERSONAS[PERSONAS.length - 1], loopId: 'clone-before' },
  ...PERSONAS.map((item) => ({ ...item, loopId: `main-${item.id}` })),
  { ...PERSONAS[0], loopId: 'clone-after' },
];

const AUTO_PLAY_INTERVAL = 3000;
export default function HomeScreen({ navigation }) {
  const { usuario } = useUsuario();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Todas as medidas são proporcionais à tela (ver medidasHome).
  const medidas = useMemo(
    () => medidasHome(screenWidth, screenHeight),
    [screenWidth, screenHeight]
  );
  const styles = useMemo(
    () => createHomeStyles(screenWidth, screenHeight),
    [screenWidth, screenHeight]
  );

  const uiScale = medidas.scale;
  const { itemWidth, carouselHeight } = medidas;

  const carouselRef = useRef(null);
  const scrollX = useRef(new Animated.Value(itemWidth)).current;
  const currentIndex = useRef(1);
  const isInteracting = useRef(false);

  // Reinicia a posição inicial se a largura do aparelho mudar.
  useEffect(() => {
    currentIndex.current = 1;
    isInteracting.current = false;
    scrollX.setValue(itemWidth);

    const initialFrame = requestAnimationFrame(() => {
      carouselRef.current?.scrollToOffset({
        offset: itemWidth,
        animated: false,
      });
    });

    const interval = setInterval(() => {
      if (isInteracting.current) return;

      // Avança apenas até o clone final; o handler faz o salto invisível.
      const nextIndex = Math.min(currentIndex.current + 1, LOOP_PERSONAS.length - 1);
      currentIndex.current = nextIndex;
      carouselRef.current?.scrollToOffset({
        offset: nextIndex * itemWidth,
        animated: true,
      });
    }, AUTO_PLAY_INTERVAL);

    return () => {
      cancelAnimationFrame(initialFrame);
      clearInterval(interval);
    };
  }, [itemWidth, scrollX]);

  const handleMomentumScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / itemWidth);

    // Clone final: volta à primeira persona real e sincroniza a animação.
    if (index === LOOP_PERSONAS.length - 1) {
      const offset = itemWidth;
      currentIndex.current = 1;
      carouselRef.current?.scrollToOffset({ offset, animated: false });
      scrollX.setValue(offset);
      return;
    }

    // Clone inicial: volta à última persona real (persona 6).
    if (index === 0) {
      const offset = PERSONAS.length * itemWidth;
      currentIndex.current = PERSONAS.length;
      carouselRef.current?.scrollToOffset({ offset, animated: false });
      scrollX.setValue(offset);
      return;
    }

    currentIndex.current = index;
  };

  const renderPersona = ({ item, index }) => {
    const inputRange = [
      (index - 1) * itemWidth,
      index * itemWidth,
      (index + 1) * itemWidth,
    ];

    // Todas as personas, inclusive a 6 e os clones, usam a mesma interpolação.
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.84, 1, 0.84],
      extrapolate: 'clamp',
    });

    return (
      <View
        style={[
          styles.carouselItem,
          { width: itemWidth, height: carouselHeight },
        ]}
      >
        <Animated.Image
          source={item.source}
          resizeMode="contain"
          style={[
            styles.personaImage,
            {
              width: itemWidth,
              height: carouselHeight,
              transform: [{ scale }],
            },
          ]}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.homeContainer}>
      <View style={styles.homeContent}>
        <View style={styles.topo}>
          {/* Cabeçalho e perfil. */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.greetingButton}
              onPress={() => navigation.navigate('Perfil')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
            >
              <View style={styles.profileIcon}>
                <Ionicons
                  name="person-outline"
                  size={18 * uiScale}
                  color="#8C79A9"
                />
              </View>

              <Text style={styles.greetingText} numberOfLines={1}>
                Olá{usuario?.nome ? `, ${usuario.nome}` : ''}.
              </Text>
            </TouchableOpacity>

            <Text style={styles.homeTitle}>PLUM</Text>
          </View>

          {/* Texto de chamada. */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.homeDescription}>
              O que você vai{' '}
              <Text style={styles.homeDescriptionHighlight}>vestir</Text>{' '}
              hoje?
            </Text>
          </View>
        </View>

        {/* Carrossel centralizado, com loop e escala uniforme. */}
        <View
          style={[
            styles.carouselContainer,
            { width: screenWidth, height: carouselHeight },
          ]}
        >
          <Animated.FlatList
            ref={carouselRef}
            data={LOOP_PERSONAS}
            renderItem={renderPersona}
            keyExtractor={(item) => item.loopId}
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            decelerationRate="fast"
            snapToInterval={itemWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            initialScrollIndex={1}
            initialNumToRender={LOOP_PERSONAS.length}
            getItemLayout={(_, index) => ({
              length: itemWidth,
              offset: itemWidth * index,
              index,
            })}
            contentContainerStyle={[
              styles.carouselContent,
              { paddingHorizontal: (screenWidth - itemWidth) / 2 },
            ]}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollBeginDrag={() => {
              isInteracting.current = true;
            }}
            onScrollEndDrag={() => {
              isInteracting.current = false;
            }}
            scrollEventThrottle={16}
          />
        </View>

        <View style={styles.ferramentas}>
          {/* Cards principais. */}
          <View style={styles.cardsRow}>
            <TouchableOpacity
              style={styles.toolButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('GuardaRoupa')}
              accessibilityRole="button"
              accessibilityLabel="Meu Guarda-roupas"
            >
              <Image
                source={require('../assets/images/guarda_roupas.png')}
                style={styles.toolCard}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ChatPlum')}
              accessibilityRole="button"
              accessibilityLabel="Chat Plum"
            >
              <Image
                source={require('../assets/images/chat_plum.png')}
                style={styles.toolCard}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Cadastro de peça. */}
          <TouchableOpacity
            style={styles.bottomButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CadastrarPeca')}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar peça"
          >
            <Image
              source={require('../assets/images/cadastrar_peca.png')}
              style={styles.bottomCard}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Rodapé. */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            A inteligência por trás do seu estilo.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
