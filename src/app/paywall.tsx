/**
 * Paywall — the REAL RevenueCat paywall (Day 5).
 *
 * - 3 tiers as glass cards: Weekly $3.99 / Monthly $9.99 / Yearly $29.99 hero
 *   ("less than $2.50/month"). Products map to ONE entitlement
 *   (`sovereign_tier`, offering `default`) in RevenueCat.
 * - API keys come ONLY from env (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` /
 *   `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`) — nothing is hardcoded.
 * - `__DEV__` simulation ONLY: when RevenueCat isn't configured in a dev
 *   build, a clearly labeled "SIMULATED" banner shows and purchases are
 *   faked. In production (non-__DEV__) builds this path CANNOT run — the
 *   purchase always goes through real RevenueCat, never a fake grant.
 * - No-key production state: honest copy — purchases activate at launch,
 *   the free quitting loop stays free forever.
 * - Close is always visible. Restore purchases always available.
 */
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { Screen } from '../../components/glass/Screen';
import { usePremium } from '../../hooks/usePremium';
import {
  initializePurchases,
  purchaseProduct,
  restorePurchasesWithBiometrics,
} from '../../services/purchases';
import { colors, radii, spacing, type } from '../../theme/tokens';
import type { PurchasePlan } from '../../types/app';

interface Tier {
  plan: PurchasePlan;
  name: string;
  price: string;
  note: string;
  hero?: boolean;
}

const TIERS: Tier[] = [
  { plan: 'weekly', name: 'Weekly', price: '$3.99', note: 'per week' },
  { plan: 'monthly', name: 'Monthly', price: '$9.99', note: 'per month' },
  {
    plan: 'yearly',
    name: 'Yearly',
    price: '$29.99',
    note: 'per year — less than $2.50/month',
    hero: true,
  },
];

const UNLOCKS = [
  'Unlimited voice journaling',
  'Advanced stats: projections & per-day charts',
  'Orb themes: Ember & Tide',
  'Noir share-card styles',
  'Smart reminders & data export',
];

const SIMULATED = __DEV__;

export default function PaywallScreen() {
  const { isPremium, refresh } = usePremium();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<PurchasePlan>('yearly');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await initializePurchases();
      if (!cancelled) setConfigured(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const noKey = configured === false;
  // Dev sandbox: RevenueCat unconfigured in a dev build → simulated purchases,
  // clearly labeled. Production builds always hit real RevenueCat.
  const simulated = noKey && SIMULATED;
  const purchasesBlocked = noKey && !SIMULATED;

  const handlePurchase = async () => {
    if (busy || purchasesBlocked) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await purchaseProduct(selected);
      if (result.success) {
        await refresh();
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        router.back();
      } else if (!result.cancelled) {
        setError(result.error ?? 'Purchase failed. Please try again.');
      }
      // User-cancelled: handled quietly per App Store guidelines.
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const result = await restorePurchasesWithBiometrics();
      if (result.restored) {
        await refresh();
        setNotice(result.message);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } else {
        setNotice(result.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {simulated && (
          <View style={styles.simBanner}>
            <Text style={styles.simText}>
              SIMULATED — dev sandbox only. No charge, no real entitlement.
            </Text>
          </View>
        )}

        <Text style={styles.kicker}>SOVEREIGN</Text>
        <Text style={styles.title}>Go deeper.{'\n'}Stay free longer.</Text>

        {isPremium ? (
          <GlassCard style={styles.memberCard}>
            <Text style={styles.memberTitle}>✓ You&apos;re a Sovereign member</Text>
            <Text style={styles.memberBody}>
              Premium is active on this device. Everything below is unlocked.
            </Text>
          </GlassCard>
        ) : (
          <>
            <View style={styles.unlocks}>
              {UNLOCKS.map((u) => (
                <View key={u} style={styles.unlockRow}>
                  <Text style={styles.check}>✓</Text>
                  <Text style={styles.unlockText}>{u}</Text>
                </View>
              ))}
            </View>

            {TIERS.map((t) => {
              const active = selected === t.plan;
              return (
                <Pressable
                  key={t.plan}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${t.name} plan, ${t.price} ${t.note}`}
                  onPress={() => setSelected(t.plan)}
                >
                  <GlassCard
                    style={[
                      styles.tier,
                      t.hero && styles.tierHero,
                      active && styles.tierSelected,
                    ]}
                  >
                    <View style={styles.tierText}>
                      <Text style={styles.tierName}>
                        {t.name}
                        {t.hero ? '  ·  BEST VALUE' : ''}
                      </Text>
                      <Text style={styles.tierNote}>{t.note}</Text>
                    </View>
                    <View style={styles.radioWrap}>
                      <View
                        style={[
                          styles.radio,
                          active && styles.radioActive,
                        ]}
                      />
                    </View>
                    <Text style={styles.tierPrice}>{t.price}</Text>
                  </GlassCard>
                </Pressable>
              );
            })}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.ctaWrap}>
              {configured === null ? (
                <ActivityIndicator color={colors.accent} />
              ) : purchasesBlocked ? (
                <Text style={styles.blocked}>
                  Purchases activate at launch — sign in with your Apple ID
                  then. The core quitting loop stays free forever.
                </Text>
              ) : (
                <GlassButton
                  title={
                    busy
                      ? 'Working…'
                      : simulated
                        ? 'Continue (simulated)'
                        : 'Continue'
                  }
                  onPress={handlePurchase}
                  disabled={busy}
                />
              )}
            </View>

            <Text style={styles.finePrint}>
              Billed through your App Store account. Cancel anytime in
              Settings. The core quitting loop — counter, pledge, relapse
              flow, urge surf — stays free forever.
            </Text>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={handleRestore}
          style={styles.restore}
          disabled={restoring}
        >
          <Text style={styles.restoreText}>
            {restoring ? 'Restoring…' : 'Restore purchases'}
          </Text>
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
  simBanner: {
    backgroundColor: colors.warning,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  simText: {
    ...type.caption,
    color: '#1A1206',
    fontWeight: '700',
    textAlign: 'center',
  },
  kicker: {
    ...type.caption,
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
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tierHero: {
    borderColor: colors.accent,
  },
  tierSelected: {
    backgroundColor: colors.accentSoft,
  },
  tierText: { flex: 1, gap: 2 },
  tierName: { ...type.headline, color: colors.text },
  tierNote: { ...type.caption, color: colors.textSecondary },
  tierPrice: { ...type.title, color: colors.text, marginLeft: spacing.sm },
  radioWrap: { marginRight: spacing.sm },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textTertiary,
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  memberCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  memberTitle: { ...type.headline, color: colors.text, marginBottom: 4 },
  memberBody: { ...type.body, color: colors.textSecondary },
  error: {
    ...type.callout,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  notice: {
    ...type.callout,
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ctaWrap: { marginTop: spacing.md },
  blocked: {
    ...type.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  finePrint: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  restore: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.sm },
  restoreText: { ...type.body, color: colors.textSecondary },
});
