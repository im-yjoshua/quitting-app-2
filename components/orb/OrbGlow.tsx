/**
 * OrbGlow — a static violet glow orb.
 *
 * The premium accent for the paywall hero and the You-tab upsell row: the
 * Orb's color story (from theme/tokens — never a hex literal) without the
 * breathing animation or the day-count face. Static by construction, so
 * Reduce Motion needs no special case; the decorative layers are hidden
 * from VoiceOver.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { orbThemes } from '../../theme/tokens';
import type { OrbTheme } from '../../types/app';

interface OrbGlowProps {
  /** Core diameter in points. The halo bleeds to ~1.6×. */
  size?: number;
  theme?: OrbTheme;
  testID?: string;
}

export function OrbGlow({ size = 96, theme = 'dawn', testID }: OrbGlowProps) {
  const glow = orbThemes[theme].glow;
  const haloSize = size * 1.6;
  return (
    <View
      style={[styles.stage, { width: haloSize, height: haloSize }]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: glow,
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: glow,
            shadowColor: glow,
            shadowRadius: size * 0.5,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    opacity: 0.16,
  },
  core: {
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
