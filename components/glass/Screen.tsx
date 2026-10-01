/**
 * Screen — shared screen wrapper: aurora gradient backdrop + safe area.
 * Every tab screen renders inside this so the glass elements always float
 * over the same deep-space canvas.
 *
 * The aurora washes are very-low-opacity accent blobs drawn once per
 * screen (static, pointer-transparent) — atmosphere without distraction.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { backdropGradient } from '../../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
}

interface Blob {
  size: number;
  color: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

const BLOBS: Blob[] = [
  // violet wash, top-left
  { size: 340, top: -120, left: -130, color: 'rgba(124, 108, 240, 0.13)' },
  // cyan wash, bottom-right
  { size: 300, bottom: -110, right: -120, color: 'rgba(91, 200, 232, 0.10)' },
  // rose wash, mid-right edge
  { size: 260, top: 300, right: -150, color: 'rgba(232, 139, 176, 0.08)' },
];

function AuroraWash() {
  return (
    <View style={styles.wash} pointerEvents="none">
      {BLOBS.map((b, i) => (
        <LinearGradient
          key={i}
          colors={[b.color, 'rgba(7, 9, 14, 0)']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.blob,
            {
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              top: b.top,
              left: b.left,
              right: b.right,
              bottom: b.bottom,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function Screen({ children }: ScreenProps) {
  return (
    <LinearGradient
      colors={[...backdropGradient.colors]}
      style={styles.fill}
    >
      <AuroraWash />
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wash: StyleSheet.absoluteFill,
  blob: { position: 'absolute' },
});
