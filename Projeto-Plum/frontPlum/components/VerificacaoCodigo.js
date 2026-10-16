import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { useEscala } from "../styles/escala";

const INTERVALO_REENVIO_S = 60;

/**
 * Tela para digitar o código de 6 dígitos enviado por e-mail.
 * Usada no cadastro e na recuperação de conta.
 *
 * onConfirmar(codigo)  -> confere o código (lança erro com mensagem)
 * onReenviar()         -> envia um novo código (lança erro com mensagem)
 * onVoltar()           -> volta para corrigir o e-mail
 */
export default function VerificacaoCodigo({
  email,
  onConfirmar,
  onReenviar,
  onVoltar,
  textoVoltar = "Corrigir e-mail",
  // true na recuperação: o código só chega se existir conta com o e-mail
  // (a tela não revela se o e-mail está cadastrado)
  condicional = false,
}) {
  const { es } = useEscala();
  const styles = React.useMemo(() => criarStyles(es), [es]);

  const [codigo, setCodigo] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState(null);
  const [aviso, setAviso] = React.useState(null);
  const [faltam, setFaltam] = React.useState(INTERVALO_REENVIO_S);

  // Contagem regressiva para liberar o "Reenviar código"
  React.useEffect(() => {
    if (faltam <= 0) {
      return;
    }

    const id = setTimeout(() => setFaltam((s) => s - 1), 1000);

    return () => clearTimeout(id);
  }, [faltam]);

  async function confirmar() {
    if (enviando) {
      return;
    }

    if (!/^\d{6}$/.test(codigo)) {
      setErro("Digite os 6 números do código.");
      return;
    }

    try {
      setEnviando(true);
      setErro(null);
      setAviso(null);

      await onConfirmar(codigo);
    } catch (error) {
      setErro(error.message || "Não foi possível confirmar o código.");
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (faltam > 0 || enviando) {
      return;
    }

    try {
      setEnviando(true);
      setErro(null);

      await onReenviar();

      setAviso("Enviamos um novo código.");
      setCodigo("");
      setFaltam(INTERVALO_REENVIO_S);
    } catch (error) {
      setErro(error.message || "Não foi possível reenviar o código.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
      <Text style={styles.titulo}>Confira seu e-mail</Text>

      <Text style={styles.texto}>
        {condicional ? "Se houver uma conta com" : "Enviamos um código de 6 números para"}
        {"\n"}
        <Text style={styles.email}>{email}</Text>
        {condicional ? ", enviamos um código de 6 números." : ""}
      </Text>

      <TextInput
        style={styles.input}
        value={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        editable={!enviando}
        onSubmitEditing={confirmar}
      />

      {!!erro && <Text style={styles.erro}>{erro}</Text>}
      {!!aviso && <Text style={styles.aviso}>{aviso}</Text>}

      <TouchableOpacity
        style={[styles.botao, enviando && { opacity: 0.7 }]}
        onPress={confirmar}
        disabled={enviando}
      >
        {enviando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.botaoTexto}>Confirmar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.link}
        onPress={reenviar}
        disabled={faltam > 0 || enviando}
      >
        <Text style={[styles.linkTexto, faltam > 0 && styles.linkDesativado]}>
          {faltam > 0 ? `Reenviar código em ${faltam}s` : "Reenviar código"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.dica}>
        {condicional
          ? "Não recebeu em alguns minutos? Confira a caixa de spam e se digitou o e-mail certo."
          : "Não recebeu? Confira a caixa de spam."}
      </Text>

      <TouchableOpacity
        style={styles.link}
        onPress={onVoltar}
        disabled={enviando}
      >
        <Text style={styles.linkTexto}>{textoVoltar}</Text>
      </TouchableOpacity>
    </View>
  );
}

// es: escala suave, proporcional ao tamanho real da tela
function criarStyles(es) {
  const r = (n) => Math.round(n * es);

  return StyleSheet.create({
    titulo: {
      fontSize: r(26),
      fontWeight: "700",
      textAlign: "center",
      color: "#1A162B",
    },

    texto: {
      marginTop: r(10),
      fontSize: r(15),
      textAlign: "center",
      color: "#555",
    },

    email: {
      fontWeight: "700",
      color: "#5A31A9",
    },

    input: {
      marginTop: r(24),
      height: r(60),
      borderWidth: 1,
      borderColor: "#DDD",
      borderRadius: r(14),
      backgroundColor: "#FFFFFF",
      textAlign: "center",
      fontSize: r(28),
      letterSpacing: r(10),
      fontWeight: "700",
      color: "#1A162B",
    },

    erro: {
      marginTop: r(12),
      color: "#D62828",
      fontSize: r(13),
      textAlign: "center",
    },

    aviso: {
      marginTop: r(12),
      color: "#2E7D32",
      fontSize: r(13),
      textAlign: "center",
    },

    botao: {
      marginTop: r(20),
      height: r(50),
      borderRadius: r(25),
      backgroundColor: "#5A31A9",
      justifyContent: "center",
      alignItems: "center",
    },

    botaoTexto: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: r(16),
    },

    link: {
      marginTop: r(16),
      alignItems: "center",
    },

    linkTexto: {
      color: "#5A31A9",
      fontWeight: "600",
      fontSize: r(14),
    },

    linkDesativado: {
      color: "#AAA",
    },

    dica: {
      marginTop: r(10),
      fontSize: r(12),
      textAlign: "center",
      color: "#888",
    },
  });
}
