import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useEscala } from "../styles/escala";
import { Image } from "expo-image";

// Ordem de exibição das peças no cartão
export const ORDEM_VAGAS = [
  "peca_unica",
  "parte_superior",
  "sobreposicao",
  "parte_inferior",
  "calcado",
  "acessorio",
];

export function pecasDoLook(look) {
  return ORDEM_VAGAS.map((vaga) => look?.[vaga]).filter(Boolean);
}

export function formatarData(iso) {
  const data = new Date(iso);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Cartão de um look curtido: miniaturas das peças, pedido e data.
 */
export default function OutfitCard({ outfit, onPress }) {
  const { ew, esw } = useEscala();
  const styles = useMemo(() => criarStyles({ e: ew, es: esw }), [ew, esw]);

  const pecas = pecasDoLook(outfit.look);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.pecas}>
        {pecas.map((peca) => (
          <View key={peca.id} style={styles.pecaBox}>
            <Image
              source={{ uri: peca.miniatura || peca.imagem }}
              style={styles.pecaImagem}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        ))}
      </View>

      <Text style={styles.pedido} numberOfLines={1}>
        “{outfit.prompt}”
      </Text>

      <Text style={styles.data}>
        👍 {formatarData(outfit.criado_em)}
      </Text>
    </TouchableOpacity>
  );
}

// e: escala cheia (tamanhos); es: escala suave (textos). Ver styles/escala.js
function criarStyles({ e, es }) {
  const r = (n) => Math.round(n * e);
  const rt = (n) => Math.round(n * es * 10) / 10;

  return StyleSheet.create({
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: r(16),
      borderWidth: 1,
      borderColor: "#E3E3E3",
      padding: r(12),
      marginHorizontal: r(20),
      marginBottom: r(12),
    },

    pecas: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: r(8),
    },

    pecaBox: {
      width: r(56),
      height: r(56),
      borderRadius: r(10),
      backgroundColor: "#F3F3F3",
      justifyContent: "center",
      alignItems: "center",
    },

    pecaImagem: {
      width: r(48),
      height: r(48),
    },

    pedido: {
      marginTop: r(10),
      fontSize: rt(15),
      fontWeight: "600",
      color: "#1A162B",
    },

    data: {
      marginTop: r(2),
      fontSize: rt(13),
      color: "#8A8A8A",
    },
  });
}
