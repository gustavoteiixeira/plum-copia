
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useEscala } from '../styles/escala';

export default function Dot({ active }) {
  const { ew } = useEscala();

  const styles = useMemo(() => {
    const r = (n) => Math.round(n * ew);

    return StyleSheet.create({
      dot: {
        width: r(21),
        height: r(4),
        borderRadius: r(4),
      },

      active: {
        backgroundColor: '#552BA5',
      },

      inactive: {
        backgroundColor: '#D8CEED',
      },
    });
  }, [ew]);

  return (
    <View
      style={[
        styles.dot,
        active ? styles.active : styles.inactive,
      ]}
    />
  );
}
