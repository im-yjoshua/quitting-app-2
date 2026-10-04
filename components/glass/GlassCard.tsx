/**
 * GlassCard — grouped content card.
 *
 * Monochrome law: content cards are NOT glass (glass is reserved for the tab
 * bar, sheets, the Orb, and floating overlays). Cards get the ONE grey
 * surface (#1C1C1E / #F2F2F7) — the iOS Settings grouped-list look — or the
 * `outline` variant: pure canvas + hairline border for hero grids.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Card inner padding. */
  padding?: number;
  /** 'surface' (default) = the one grey · 'outline' = canvas + hairline. */
  variant?: 'surface' | 'outline';
}

export function GlassCard({
  children,
  style,
  padding = spacing.md,
  variant = 'surface',
}: GlassCardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { padding },
        variant === 'surface'
          ? { backgroundColor: theme.colors.surface }
          : {
              backgroundColor: theme.colors.background,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.hairline,
            },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
  },
});
