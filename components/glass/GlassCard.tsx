/**
 * GlassCard — frosted content card for stats and grouped content.
 *
 * Apple HIG note: glass is for nav/controls/overlays; content cards use it
 * here because the design language calls for floating stat cards (the
 * motion_conquest MEASURE scene). Text inside stays high-contrast — no
 * glass-on-glass.
 */
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import { GlassStyle, GlassSurface } from './GlassSurface';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: GlassStyle;
  /** Card inner padding. */
  padding?: number;
}

export function GlassCard({
  children,
  style,
  glassEffectStyle = 'regular',
  padding = spacing.md,
}: GlassCardProps) {
  return (
    <GlassSurface
      style={[styles.card, { padding }, style]}
      glassEffectStyle={glassEffectStyle}
      fallbackIntensity={60}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
  },
});
