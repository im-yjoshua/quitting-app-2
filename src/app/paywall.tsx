/**
 * Paywall — STUB (the real RevenueCat paywall lands Day 5).
 *
 * Every premium trigger point routes here today: voice mic lock, orb
 * themes, noir share-card style, stats upsell, You tab premium row.
 * Shows the 3 locked tiers honestly instead of a dead end.
 */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../components/glass/GlassCard';
import { Screen } from '../../components/glass/Screen';
import { colors, spacing, type } from '../../theme/tokens';

const TIERS = [
  { id: 'weekly', name: 'Weekly', price: '$3.99', note: 'per week' },
  { id: 'monthly', name: 'Monthly', price: '$9.99', note: 'per month' },
  { id: 'yearly', name: 'Yearly', price: '$29.99', note: 'per year — best value', hero: true },
];

const UNLOCKS = [
  'Unlimited voice journaling',
  'Advanced stats: projections & per-day charts',
  'The full body-recovery timeline',
  'Orb themes: Ember & Tide',
  'Premium share-card styles',
  'Smart reminders & data export',
];

export default function PaywallScreen() {
  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Text style={styles.kicker}>SOVEREIGN</Text>
        <Text style={styles.title}>Go deeper.{'\n'}Stay free longer.</Text>

        <View style={styles.unlocks}>
          {UNLOCKS.map((u) => (
            <View key={u} style={styles.unlockRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.unlockText}>{u}</Text>
            </View>
          ))}
        </View>

        {TIERS.map((t) => (
          <GlassCard
            key={t.id}
            style={[styles.tier, t.hero && styles.tierHero]}
          >
            <View style={styles.tierText}>
              <Text style={styles.tierName}>{t.name}</Text>
              <Text style={styles.tierNote}>{t.note}</Text>
            </View>
            <Text style={styles.tierPrice}>{t.price}</Text>
          </GlassCard>
        ))}

        <Text style={styles.stub}>
          Purchases unlock Day 5 — the paywall is being wired to RevenueCat
          right now. The core quitting loop stays free forever.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.restore}
        >
          <Text style={styles.restoreText}>Not now</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  close: {
    alignSelf: 'flex-end',
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  closeText: { ...type.title, color: colors.textSecondary },
  kicker: {
    ...type.micro,
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  title: { ...type.title, color: colors.text, marginBottom: spacing.lg },
  unlocks: { gap: spacing.sm, marginBottom: spacing.lg },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { color: colors.success, fontSize: 16, fontWeight: '700' },
  unlockText: { ...type.body, color: colors.text },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    marginBottom: spacing.sm,
    opacity: 0.75,
  },
  tierHero: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    opacity: 1,
  },
  tierText: { gap: 2 },
  tierName: { ...type.headline, color: colors.text },
  tierNote: { ...type.caption, color: colors.textSecondary },
  tierPrice: { ...type.title, color: colors.text },
  stub: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  restore: { alignSelf: 'center', padding: spacing.md },
  restoreText: { ...type.body, color: colors.textSecondary },
});
