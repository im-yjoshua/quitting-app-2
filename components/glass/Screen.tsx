/**
 * Screen — shared screen wrapper: pure monochrome canvas + safe area.
 *
 * Backgrounds are pure #000000 / #FFFFFF (per appearance). No aurora
 * washes, no tinted gradients — warmth comes from copy, not color.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/useTheme';

interface ScreenProps {
  children: React.ReactNode;
}

export function Screen({ children }: ScreenProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
