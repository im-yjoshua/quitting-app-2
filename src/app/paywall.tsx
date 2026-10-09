/**
 * Paywall — the REAL RevenueCat paywall (Day 5).
 *
 * - 3 tiers: Weekly $3.99 / Monthly $9.99 / Yearly $29.99 hero
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
 * - Terms of Use (Apple's standard EULA) + Privacy Policy links on the
 *   paywall itself (App Store Guideline requirement).
 *
 * Monochrome reskin: value before price, honest unlock list, tiers as
 * surface blocks, yearly hero elevated with an accent border + glow,
 * inverted Continue.
 */
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { Screen } from '../../components/glass/Screen';
import { PRIVACY_POLICY_URL } from '../../constants';
import { usePremium } from '../../hooks/usePremium';
import {
  initializePurchases,
  purchaseProduct,
  restorePurchasesWithBiometrics,
} from '../../services/purchases';
import { radii, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
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

const APPLE_STANDARD_EULA =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const SIMULATED = __DEV__;

export default function PaywallScreen() {
  const theme = useTheme();
  const c = theme.colors;
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

  const openPrivacy = () => {
    if (!PRIVACY_POLICY_URL) {
      Alert.alert(
        'Coming at launch',
        'The privacy policy ships with the App Store listing — the full text is already drafted.'
      );
      return;
    }
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.topSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={styles.close}
          >
            <SymbolView
              name="xmark"
              tintColor={c.text}
              style={styles.closeIcon}
            />
          </Pressable>
        </View>

        {simulated && (
          <View style={[styles.simBanner, { backgroundColor: c.warning }]}>
            <Text style={styles.simText}>
              SIMULATED — dev sandbox only. No charge, no real entitlement.
            </Text>
          </View>
        )}

        <Text style={[styles.kicker, { color: c.metadata }]}>SOVEREIGN</Text>
        <Text style={[styles.title, { color: c.text }]}>
          Go deeper.{'\n'}Stay free longer.
        </Text>

        {isPremium ? (
          <View
            style={[
              styles.memberCard,
              { backgroundColor: c.surface, borderColor: c.accent },
            ]}
          >
            <Text style={[styles.memberTitle, { color: c.text }]}>
              ✓ You&apos;re a Sovereign member
            </Text>
            <Text style={[styles.memberBody, { color: c.text }]}>
              Premium is active on this device. Everything below is unlocked.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.unlocks}>
              {UNLOCKS.map((u) => (
                <View key={u} style={styles.unlockRow}>
                  <Text style={[styles.check, { color: c.success }]}>✓</Text>
                  <Text style={[styles.unlockText, { color: c.text }]}>
                    {u}
                  </Text>
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
                  onPress={() => {
                    void Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light
                    );
                    setSelected(t.plan);
                  }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View
                    style={[
                      styles.tier,
                      {
                        backgroundColor: active
                          ? c.accentSoft
                          : c.surface,
                        borderColor: active || t.hero ? c.accent : 'transparent',
                      },
                      t.hero && {
                        shadowColor: c.accent,
                        shadowOpacity: 0.35,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 4 },
                      },
                    ]}
                  >
                    <View style={styles.tierText}>
                      <Text style={[styles.tierName, { color: c.text }]}>
                        {t.name}
                        {t.hero ? (
                          <Text
                            style={[styles.heroTag, { color: c.accent }]}
                          >
                            {'  ·  BEST VALUE'}
                          </Text>
                        ) : null}
                      </Text>
                      <Text
                        style={[styles.tierNote, { color: c.metadata }]}
                      >
                        {t.note}
                      </Text>
                    </View>
                    <Text
                      style={[styles.tierPrice, { color: c.text }, styles.tabular]}
                    >
                      {t.price}
                    </Text>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: active ? c.accent : c.metadata,
                          backgroundColor: active
                            ? c.accent
                            : 'transparent',
                        },
                      ]}
                    >
                      {active && (
                        <Text style={[styles.radioCheck, { color: c.onAccent }]}>
                          ✓
                        </Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {error ? (
              <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
            ) : null}
            {notice ? (
              <Text style={[styles.notice, { color: c.success }]}>{notice}</Text>
            ) : null}

            <View style={styles.ctaWrap}>
              {configured === null ? (
                <ActivityIndicator color={c.accent} />
              ) : purchasesBlocked ? (
                <Text style={[styles.blocked, { color: c.text }]}>
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

            <Text style={[styles.finePrint, { color: c.metadata }]}>
              Payment is charged to your Apple ID at confirmation.
              Subscriptions auto-renew unless turned off at least 24 hours
              before the current period ends; your account is charged for
              renewal within 24 hours of period end. Manage or cancel anytime
              in Settings. The core quitting loop — counter, pledge, relapse
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
          <Text style={[styles.restoreText, { color: c.accent }]}>
            {restoring ? 'Restoring…' : 'Restore purchases'}
          </Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(APPLE_STANDARD_EULA)}
            style={styles.legalLink}
          >
            <Text style={[styles.legalText, { color: c.metadata }]}>
              Terms of Use
            </Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: c.metadata }]}>·</Text>
          <Pressable
            accessibilityRole="link"
            onPress={openPrivacy}
            style={styles.legalLink}
          >
            <Text style={[styles.legalText, { color: c.metadata }]}>
              Privacy Policy
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  topSpacer: { flex: 1 },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 20, height: 20 },
  simBanner: {
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
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  title: { ...type.title1, marginBottom: spacing.lg },
  unlocks: { gap: spacing.sm, marginBottom: spacing.lg },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { fontSize: 16, fontWeight: '700' },
  unlockText: { ...type.body, flex: 1 },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  tierText: { flex: 1, gap: 2 },
  tierName: { ...type.headline },
  heroTag: { ...type.caption, fontWeight: '700' },
  tierNote: { ...type.caption },
  tierPrice: { ...type.title2, marginRight: spacing.sm },
  tabular: { ...type.tabular },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheck: { fontSize: 13, fontWeight: '700' },
  memberCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  memberTitle: { ...type.headline, marginBottom: 4 },
  memberBody: { ...type.body },
  error: {
    ...type.headline,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  notice: {
    ...type.headline,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ctaWrap: { marginTop: spacing.md },
  blocked: {
    ...type.headline,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  finePrint: {
    ...type.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  restore: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  restoreText: { ...type.headline },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legalLink: { paddingVertical: spacing.sm },
  legalText: { ...type.caption },
  legalDot: { ...type.caption },
  pressed: { opacity: 0.7 },
});
