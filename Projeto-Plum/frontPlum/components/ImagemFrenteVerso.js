import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Mostra a imagem da frente da peça.
 * Se houver verso, um toque na imagem alterna entre frente e verso.
 */
export default function ImagemFrenteVerso({
  frente,
  verso,
  style,
  imageStyle,
  resizeMode = "contain",
}) {
  const [mostrandoVerso, setMostrandoVerso] = React.useState(false);

  // Volta para a frente quando a peça exibida muda
  React.useEffect(() => {
    setMostrandoVerso(false);
  }, [frente, verso]);

  const uri = mostrandoVerso && verso ? verso : frente;

  if (!verso) {
    return (
      <View style={style}>
        <Image source={{ uri }} style={imageStyle} resizeMode={resizeMode} />
      </View>
    );
  }

  return (
    <View style={[style, styles.container]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setMostrandoVerso((atual) => !atual)}
        style={styles.toque}
      >
        <Image source={{ uri }} style={imageStyle} resizeMode={resizeMode} />
      </TouchableOpacity>

      <View style={styles.indicador}>
        <Ionicons name="sync" size={14} color="#4D2A95" />
        <Text style={styles.indicadorTexto}>
          {mostrandoVerso ? "Verso" : "Frente"} · toque para virar
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },

  toque: {
    width: "100%",
    alignItems: "center",
  },

  indicador: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EFE9FA",
  },

  indicadorTexto: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "600",
    color: "#4D2A95",
  },
});
