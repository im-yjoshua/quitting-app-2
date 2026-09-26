/**
 * Screen — shared screen wrapper: aurora gradient backdrop + safe area.
 * Every tab screen renders inside this so the glass elements always float
 * over the same deep-space canvas.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { backdropGradient } from '../../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
}

export function Screen({ children }: ScreenProps) {
  return (
    <LinearGradient
      colors={[...backdropGradient.colors]}
      style={styles.fill}
    >
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
