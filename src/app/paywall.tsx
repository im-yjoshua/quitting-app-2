/**
 * Paywall — the REAL RevenueCat paywall (Phase 7 v3 reskin, plan §3.8).
 *
 * PRESENTATION ONLY — every line of logic below is the v2 paywall, untouched:
 * - 3 tiers: Weekly $3.99 / Monthly $9.99 / Yearly $29.99 hero. Products map
 *   to ONE entitlement (`sovereign_tier`, offering `default`) in RevenueCat.
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
 * - The auto-renewal disclosure (issue #8) is preserved VERBATIM — the
 *   DISCLOSURE constant below is character-for-character the v2 text.
 *
 * v3 presentation: Orb glow hero, "Go deeper. Stay free longer.", checkmark
 * unlock list, 3 tier cards (yearly = hero with BEST VALUE tag), inverted
 * Continue.
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
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OrbGlow } from '../../components/orb/OrbGlow';
import { InvertedButton, Screen } from '../../components/ui';
import { PRIVACY_POLICY_URL } from '../../constants';
import { usePremium } from '../../hooks/usePremium';
import {
  initializePurchases,
  purchaseProduct,
  restorePurchasesWithBiometrics,
} from '../../services/purchases';
import { radii, spacing, type as typeScale } from '../../theme/tokens';
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

/**
 * GATE (issue #8): this text is fixed. Do not paraphrase, trim, or
 * "improve" it — copy character-for-character.
 */
const DISCLOSURE =
  'Payment is charged to your Apple ID at confirmation. ' +
  'Subscriptions auto-renew unless turned off at least 24 hours ' +
  'before the current period ends; your account is charged for ' +
  'renewal within 24 hours of period end. Manage or cancel anytime ' +
  'in Settings. The core quitting loop — counter, pledge, relapse ' +
  'flow, urge surf — stays free forever.';

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
  const simulated = noKey && __DEV__;
  const purchasesBlocked = noKey && !__DEV__;

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
    <Screen scrollable scrollContentStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.topSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={8}
        >
          <SymbolView name="xmark" tintColor={c.text} style={styles.closeIcon} />
        </Pressable>
      </View>

      {simulated && (
        <View style={[styles.simBanner, { backgroundColor: c.inverted }]}>
          <Text style={[styles.simText, { color: c.background }]}>
            SIMULATED — dev sandbox only. No charge, no real entitlement.
          </Text>
        </View>
      )}

      <View style={styles.hero}>
        <OrbGlow size={88} />
      </View>
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
                <Text style={[styles.unlockText, { color: c.text }]}>{u}</Text>
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
                  void Haptics.selectionAsync();
                  setSelected(t.plan);
                }}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View
                  style={[
                    styles.tier,
                    {
                      backgroundColor: active ? c.accentSoft : c.surface,
                      borderColor: active || t.hero ? c.accent : 'transparent',
                    },
                    t.hero && {
                      shadowColor: c.accent,
                      shadowOpacity: 0.35,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 8,
                    },
                  ]}
                >
                  <View style={styles.tierText}>
                    <View style={styles.tierNameRow}>
                      <Text style={[styles.tierName, { color: c.text }]}>
                        {t.name}
                      </Text>
                      {t.hero ? (
                        <View
                          style={[
                            styles.heroTag,
                            { backgroundColor: c.accentSoft },
                          ]}
                        >
                          <Text
                            // Full-brightness label: violet-on-wash falls
                            // below 4.5:1 in light mode at 12pt.
                            style={[styles.heroTagText, { color: c.text }]}
                          >
                            BEST VALUE
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.tierNote, { color: c.metadata }]}>
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
                        backgroundColor: active ? c.accent : 'transparent',
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
              <InvertedButton
                title={simulated ? 'Continue (simulated)' : 'Continue'}
                onPress={handlePurchase}
                loading={busy}
              />
            )}
          </View>

          <Text style={[styles.finePrint, { color: c.metadata }]}>
            {DISCLOSURE}
          </Text>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={handleRestore}
        style={styles.restore}
        disabled={restoring}
        hitSlop={8}
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
          hitSlop={8}
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
          hitSlop={8}
        >
          <Text style={[styles.legalText, { color: c.metadata }]}>
            Privacy Policy
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
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
    ...typeScale.footnote,
    fontWeight: '700',
    textAlign: 'center',
  },
  hero: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  kicker: {
    ...typeScale.footnote,
    letterSpacing: 4,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  title: { ...typeScale.largeTitle, textAlign: 'center', marginBottom: spacing.lg },
  unlocks: { gap: spacing.sm, marginBottom: spacing.lg },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { ...typeScale.headline, fontWeight: '700' },
  unlockText: { ...typeScale.body, flex: 1 },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  tierText: { flex: 1, gap: spacing.xs },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tierName: { ...typeScale.headline },
  heroTag: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroTagText: {
    ...typeScale.footnote,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tierNote: { ...typeScale.footnote },
  tierPrice: { ...typeScale.headline, marginRight: spacing.sm },
  tabular: { ...typeScale.tabular },
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
  memberTitle: { ...typeScale.headline, marginBottom: spacing.xs },
  memberBody: { ...typeScale.body },
  error: {
    ...typeScale.headline,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  notice: {
    ...typeScale.headline,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ctaWrap: { marginTop: spacing.md },
  blocked: {
    ...typeScale.headline,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  finePrint: {
    ...typeScale.footnote,
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
  restoreText: { ...typeScale.headline },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legalLink: { paddingVertical: spacing.sm },
  legalText: { ...typeScale.footnote },
  legalDot: { ...typeScale.footnote },
  pressed: { opacity: 0.7 },
});
