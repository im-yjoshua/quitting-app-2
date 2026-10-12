/**
 * ShareCard — the growth loop (Phase 7, Stitch share_card reference).
 *
 * Premium dark card aesthetic: violet ring, big number, the Sovereign
 * quote. Content is strictly honest (plan §3.2): Stitch's "ATTESTATION
 * ENGINE / PROOF #47-8912 // VERIFIED / FOCUS VECTOR / CLEAN RATIO /
 * DECISION MATRIX / VAULT ATTESTED / CRYPTOGRAPHIC ZERO-KNOWLEDGE"
 * theater is false for a local-only app and is stripped. The footer
 * states the truth: "Recorded on this device."
 *
 * Two styles: `classic` (free, obsidian-violet) and `noir` (premium,
 * black-gold). All art colors come from theme/tokens.ts (shareCardThemes)
 * — no hex literals in this component.
 *
 * The root view is a forwardRef so react-native-view-shot can capture it
 * to an image for the OS share sheet. Keep `collapsable={false}` on the
 * root — required for capture on Android.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from './ui/ProgressRing';
import type { QuitCategory, ShareCardStyle } from '../types/app';
import { QUIT_CATEGORY_LABELS } from '../types/app';
import { radii, shareCardThemes, spacing } from '../theme/tokens';

export const SHARE_CARD_WIDTH = 340;
export const SHARE_CARD_HEIGHT = 440;

interface ShareCardProps {
  days: number;
  category: QuitCategory;
  customName?: string;
  style: ShareCardStyle;
}

function dayWord(days: number): string {
  return days === 1 ? 'DAY CLEAN' : 'DAYS CLEAN';
}

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { days, category, customName, style },
  ref
) {
  const def = shareCardThemes[style];
  const categoryLabel =
    category === 'custom' && customName
      ? customName
      : QUIT_CATEGORY_LABELS[category];

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <LinearGradient colors={[...def.gradient]} style={styles.card}>
        {/* Wordmark — no proof numbers, no "verified". */}
        <View style={styles.header}>
          <SymbolView
            name="shield.fill"
            tintColor={def.accent}
            style={styles.shield}
          />
          <Text style={[styles.headerText, { color: def.accent }]}>
            Sovereign
          </Text>
        </View>

        <ProgressRing
          progress={1}
          size={150}
          stroke={9}
          color={def.accent}
          trackColor={def.gradient[0]}
        >
          <View style={styles.ringCenter}>
            <SymbolView
              name="diamond.fill"
              tintColor={def.accent}
              style={styles.gem}
            />
          </View>
        </ProgressRing>

        <Text style={[styles.number, { color: def.number }]}>{days}</Text>
        <Text style={[styles.unit, { color: def.accent }]}>
          {dayWord(days)}
        </Text>
        <Text style={[styles.focus, { color: def.body }]}>
          {categoryLabel.toUpperCase()} · QUIT
        </Text>

        <View
          style={[styles.rule, { backgroundColor: def.accent }]}
        />
        <Text style={[styles.quote, { color: def.body }]}>
          &ldquo;Freedom is not the absence of desire, but the mastery of
          choice.&rdquo;
        </Text>

        {/* Honest footer, replacing the attestation theater. */}
        <Text style={[styles.footer, { color: def.wordmark }]}>
          Recorded on this device.
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
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  shield: { width: 18, height: 18 },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gem: { width: 30, height: 30 },
  number: {
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: spacing.sm,
    lineHeight: 88,
  },
  unit: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 5,
  },
  focus: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
  rule: {
    width: 48,
    height: 2,
    borderRadius: 1,
    marginVertical: spacing.sm,
    opacity: 0.7,
  },
  quote: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  footer: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
});
