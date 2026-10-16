import React, { useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { useEscala } from "../styles/escala";

export const GENEROS = ["Feminino", "Masculino", "Prefiro não informar"];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Devolve a mensagem do primeiro problema, ou null se estiver tudo certo. */
// exigirEmail: false no Perfil (lá o e-mail não pode ser alterado)
export function validarCadastro({ nome, email, genero }, { exigirEmail = true } = {}) {
  const nomeLimpo = (nome || "").trim();

  if (nomeLimpo.length < 2) {
    return "Digite seu nome.";
  }

  if (exigirEmail && !EMAIL.test((email || "").trim())) {
    return "Digite um e-mail válido.";
  }

  if (!GENEROS.includes(genero)) {
    return "Escolha uma opção de gênero.";
  }

  return null;
}

/**
 * Campos de nome, e-mail e gênero.
 * Usado no cadastro (primeiro acesso) e no Perfil.
 */
export default function FormularioCadastro({
  valores,
  onChange,
  onEnviar,
  textoBotao = "Criar conta",
  enviando = false,
  erro = null,
  // false no Perfil: o e-mail é usado para recuperar a conta
  emailEditavel = true,
}) {
  const { es } = useEscala();
  const styles = useMemo(() => criarStyles(es), [es]);

  const alterar = (campo) => (valor) => onChange({ ...valores, [campo]: valor });

  return (
    <View>
      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Seu nome"
        value={valores.nome}
        onChangeText={alterar("nome")}
        autoCapitalize="words"
        maxLength={100}
        editable={!enviando}
      />

      <Text style={styles.label}>E-mail</Text>
      {emailEditavel ? (
        <TextInput
          style={styles.input}
          placeholder="seuemail@exemplo.com"
          value={valores.email}
          onChangeText={alterar("email")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          maxLength={255}
          editable={!enviando}
        />
      ) : (
        <View style={[styles.input, styles.inputSomenteLeitura]}>
          <Text style={styles.textoSomenteLeitura}>
            {valores.email || "—"}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Gênero</Text>
      <View style={styles.generos}>
        {GENEROS.map((opcao) => {
          const ativo = valores.genero === opcao;

          return (
            <TouchableOpacity
              key={opcao}
              style={[styles.genero, ativo && styles.generoAtivo]}
              onPress={() => alterar("genero")(opcao)}
              disabled={enviando}
            >
              <Text style={[styles.generoTexto, ativo && styles.generoTextoAtivo]}>
                {opcao}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!!erro && <Text style={styles.erro}>{erro}</Text>}

      <TouchableOpacity
        style={[styles.botao, enviando && { opacity: 0.7 }]}
        onPress={onEnviar}
        disabled={enviando}
      >
        {enviando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.botaoTexto}>{textoBotao}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// es: escala suave, proporcional ao tamanho real da tela
function criarStyles(es) {
  const r = (n) => Math.round(n * es);

  return StyleSheet.create({
    label: {
      fontSize: r(15),
      color: "#555",
      marginBottom: r(6),
      marginTop: r(12),
    },

    input: {
      borderWidth: 1,
      borderColor: "#DDD",
      borderRadius: r(12),
      height: r(48),
      paddingHorizontal: r(15),
      backgroundColor: "#FFFFFF",
      fontSize: r(14),
    },

    inputSomenteLeitura: {
      justifyContent: "center",
      backgroundColor: "#F2F2F2",
    },

    textoSomenteLeitura: {
      color: "#777",
      fontSize: r(14),
    },

    generos: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: r(8),
    },

    genero: {
      paddingHorizontal: r(15),
      paddingVertical: r(11),
      borderRadius: r(20),
      borderWidth: 1,
      borderColor: "#5A31A9",
      backgroundColor: "#FFFFFF",
    },

    generoAtivo: {
      backgroundColor: "#5A31A9",
    },

    generoTexto: {
      fontSize: r(15),
      fontWeight: "600",
      color: "#5A31A9",
    },

    generoTextoAtivo: {
      color: "#FFFFFF",
    },

    erro: {
      marginTop: r(12),
      color: "#D62828",
      fontSize: r(13),
    },

    botao: {
      marginTop: r(20),
      height: r(54),
      borderRadius: r(25),
      backgroundColor: "#5A31A9",
      justifyContent: "center",
      alignItems: "center",
    },

    botaoTexto: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: r(17),
    },
  });
}
