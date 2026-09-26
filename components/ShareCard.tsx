/**
 * ShareCard — the growth loop (spec §2.6).
 *
 * A screenshot-worthy milestone card: the Orb (static render path),
 * "N DAYS CLEAN", category, and the Sovereign wordmark. Two styles:
 * `classic` (free) and `noir` (premium).
 *
 * The root view is a forwardRef so react-native-view-shot can capture it
 * to an image for the OS share sheet. Keep `collapsable={false}` on the
 * root — required for capture on Android.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Orb } from './Orb';
import type { QuitCategory, ShareCardStyle } from '../types/app';
import { QUIT_CATEGORY_LABELS } from '../types/app';
import { colors, radii, spacing } from '../theme/tokens';

export const SHARE_CARD_WIDTH = 340;
export const SHARE_CARD_HEIGHT = 440;

interface ShareCardProps {
  days: number;
  category: QuitCategory;
  customName?: string;
  style: ShareCardStyle;
}

const STYLE_DEFS = {
  classic: {
    gradient: ['#141828', '#0B0E1A', '#101426'] as const,
    number: '#F2F4F8',
    accent: colors.accent,
    wordmark: '#A7B0C2',
  },
  noir: {
    gradient: ['#050505', '#0A0A0A', '#050505'] as const,
    number: '#F5EEDD',
    accent: '#D4AF6A',
    wordmark: '#8A7F66',
  },
} as const;

function dayWord(days: number): string {
  return days === 1 ? 'DAY CLEAN' : 'DAYS CLEAN';
}

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { days, category, customName, style },
  ref
) {
  const def = STYLE_DEFS[style];
  const categoryLabel =
    category === 'custom' && customName ? customName : QUIT_CATEGORY_LABELS[category];

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <LinearGradient
        colors={[...def.gradient]}
        style={styles.card}
      >
        <Text style={[styles.kicker, { color: def.accent }]}>
          {categoryLabel.toUpperCase()} · QUIT
        </Text>
        <Orb cleanDays={days} size={170} animated={false} />
        <Text style={[styles.number, { color: def.number }]}>{days}</Text>
        <Text style={[styles.unit, { color: def.accent }]}>{dayWord(days)}</Text>
        <View style={[styles.rule, { backgroundColor: def.accent }]} />
        <Text style={[styles.wordmark, { color: def.wordmark }]}>
          S O V E R E I G N
        </Text>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
  number: {
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: spacing.md,
  },
  unit: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 5,
  },
  rule: {
    width: 48,
    height: 2,
    borderRadius: 1,
    marginVertical: spacing.md,
    opacity: 0.7,
  },
  wordmark: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 6,
  },
});
