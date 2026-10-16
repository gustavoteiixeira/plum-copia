import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Medidas de escala para as telas de acesso (login, cadastro, código).
 *
 * Tudo é derivado do tamanho real da janela, sem depender de um aparelho
 * específico:
 *  - e  : escala "cheia" (painel inicial, botões grandes).
 *  - es : escala "suave" (formulários e textos), que cresce mais devagar
 *         para os campos não ficarem exagerados em telas grandes.
 *  - ew / esw: o mesmo, mas só pela largura (telas que rolam).
 *  - alturaTermos: altura da caixa de texto dos termos, proporcional à tela.
 *
 * A altura entra só como limitador (min), para telas baixas não estourarem.
 */
export function medidasEscala(width, height) {
  const sx = clamp(width / BASE_WIDTH, 0.8, 1.5);
  const sy = clamp(height / BASE_HEIGHT, 0.8, 1.5);
  const e = Math.min(sx, sy);
  const es = 1 + (e - 1) * 0.75;

  // Escala só pela largura: para telas que rolam (a altura não limita o layout),
  // como o Chat. Evita encolher textos em aparelhos largos e baixos.
  const ew = clamp(width / BASE_WIDTH, 0.85, 1.5);
  const esw = 1 + (ew - 1) * 0.75;

  return {
    width,
    height,
    e,
    es,
    ew,
    esw,
    alturaTermos: clamp(height * 0.4, 200, 520),
  };
}

export function useEscala() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => medidasEscala(width, height), [width, height]);
}
