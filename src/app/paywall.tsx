/**
 * Paywall — the REAL RevenueCat paywall (Phase 6, plan §2.8 + §3.1).
 *
 * PRESENTATION ONLY — every line of logic below is the v2 paywall, untouched:
 * - 3 tiers: Yearly $29.99 / Monthly $9.99 / Weekly $3.99 hero order per
 *   Stitch. Products map to ONE entitlement (`sovereign_tier`, offering
 *   `default`) in RevenueCat.
 * - API keys come ONLY from env (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` /
 *   `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`) — nothing is hardcoded.
 * - `__DEV__` simulation ONLY: when RevenueCat isn't configured in a dev
 *   build, a clearly labeled "SIMULATED" banner shows and purchases are
 *   faked. In production (non-__DEV__) builds this path CANNOT run — the
 *   purchase always goes through real RevenueCat, never a fake grant.
 * - No-key production state: honest copy — purchases activate at launch,
 *   the free quitting loop stays free forever.
 * - NO free trial (plan §3.1): Stitch's "3-day free trial / Start Free
 *   Trial" is forbidden. CTA is "Continue →".
 * - Close is always visible. Restore purchases always available (header
 *   left + bottom row, per Stitch).
 * - Terms of Use (Apple's standard EULA) + Privacy Policy links on the
 *   paywall itself (App Store Guideline requirement).
 * - The auto-renewal disclosure (issue #8) is preserved VERBATIM — the
 *   DISCLOSURE constant below is character-for-character the v2 text.
 *
 * v4 presentation (Stitch): Restore + X header, glowing sphere orb with ∞,
 * "SOVEREIGN PRO" pill, "Go deeper. Stay free longer.", honest feature
 * checklist card, 3 tier cards (yearly hero first), white Continue pill.
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

import { Orb } from '../../components/orb';
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
import type { Theme } from '../../theme/tokens';
import type { PurchasePlan } from '../../types/app';

interface Tier {
  plan: PurchasePlan;
  name: string;
  price: string;
  note: string;
  tag?: string;
  hero?: boolean;
}

const TIERS: Tier[] = [
  {
    plan: 'yearly',
    name: 'Yearly',
    price: '$29.99',
    note: 'per year — less than $2.50/month',
    tag: 'Best value',
    hero: true,
  },
  { plan: 'monthly', name: 'Monthly', price: '$9.99', note: 'per month' },
  { plan: 'weekly', name: 'Weekly', price: '$3.99', note: 'per week' },
];

interface Unlock {
  title: string;
  subtitle: string;
  ios: string;
  android: string;
}

const UNLOCKS: Unlock[] = [
  {
    title: 'Voice journaling',
    subtitle: 'Record spoken reflections as audio entries',
    ios: 'mic.fill',
    android: 'mic',
  },
  {
    title: 'Advanced stats',
    subtitle: 'Projections and per-day breakdowns',
    ios: 'chart.bar.fill',
    android: 'bar_chart',
  },
  {
    title: 'Orb themes',
    subtitle: 'Ember and Tide glow styles',
    ios: 'paintpalette.fill',
    android: 'palette',
  },
  {
    title: 'Noir share cards',
    subtitle: 'High-contrast milestone cards',
    ios: 'rectangle.stack.fill',
    android: 'photo_library',
  },
  {
    title: 'Smart reminders & export',
    subtitle: 'Extra nudges plus your recovery data, portable',
    ios: 'bell.fill',
    android: 'notifications',
  },
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

/** Small SF-Symbol / Material-Symbol icon (no new native deps). */
function Icon({
  ios,
  android,
  size = 18,
  color,
}: {
  ios: string;
  android: string;
  size?: number;
  color: string;
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never }}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

/** Rounded icon tile, Stitch-style. */
function IconTile({
  theme,
  ios,
  android,
}: {
  theme: Theme;
  ios: string;
  android: string;
}) {
  const c = theme.colors;
  return (
    <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
      <Icon ios={ios} android={android} size={18} color={c.accent} />
    </View>
  );
}

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={handleRestore}
          disabled={restoring}
          style={styles.restoreTop}
          hitSlop={8}
        >
          <Text style={[styles.restoreTopText, { color: c.metadata }]}>
            {restoring ? 'Restoring…' : 'Restore'}
          </Text>
        </Pressable>
        <View style={styles.topSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={[styles.close, { backgroundColor: c.surface }]}
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
        <Orb
          cleanDays={0}
          size={128}
          accessibilityLabel="Sovereign Pro"
          centerContent={
            <Text style={[styles.infinity, { color: c.text }]}>∞</Text>
          }
        />
      </View>

      <View style={styles.pillRow}>
        <View style={[styles.proPill, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <View style={[styles.proDot, { backgroundColor: c.success }]} />
          <Text style={[styles.proPillText, { color: c.text }]}>
            SOVEREIGN PRO
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: c.text }]}>
        Go deeper. Stay free longer.
      </Text>
      <Text style={[styles.subcopy, { color: c.metadata }]}>
        Voice journaling, deeper stats, custom orb themes, and more — built
        for the long road.
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
          <View style={[styles.checklist, { backgroundColor: c.surface }]}>
            {UNLOCKS.map((u, i) => (
              <View
                key={u.title}
                style={[
                  styles.unlockRow,
                  i < UNLOCKS.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                ]}
              >
                <IconTile theme={theme} ios={u.ios} android={u.android} />
                <View style={styles.unlockTextWrap}>
                  <Text style={[styles.unlockTitle, { color: c.text }]}>
                    {u.title}
                  </Text>
                  <Text style={[styles.unlockSub, { color: c.metadata }]}>
                    {u.subtitle}
                  </Text>
                </View>
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
                      borderColor: active ? c.accent : c.hairline,
                    },
                  ]}
                >
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
                  <View style={styles.tierText}>
                    <View style={styles.tierNameRow}>
                      <Text style={[styles.tierName, { color: c.text }]}>
                        {t.name}
                      </Text>
                      {t.tag ? (
                        <View
                          style={[styles.heroTag, { backgroundColor: c.accent }]}
                        >
                          <Text
                            style={[styles.heroTagText, { color: c.onAccent }]}
                          >
                            {t.tag}
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
                title={simulated ? 'Continue (simulated)' : 'Continue →'}
                onPress={handlePurchase}
                loading={busy}
              />
            )}
          </View>
        </>
      )}

      <View style={styles.legalRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={handleRestore}
          disabled={restoring}
          style={styles.legalLink}
          hitSlop={8}
        >
          <Text style={[styles.legalText, { color: c.metadata }]}>
            Restore Purchases
          </Text>
        </Pressable>
        <Text style={[styles.legalDot, { color: c.metadata }]}>·</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(APPLE_STANDARD_EULA)}
          style={styles.legalLink}
          hitSlop={8}
        >
          <Text style={[styles.legalText, { color: c.metadata }]}>
            Terms of Service
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

      <Text style={[styles.finePrint, { color: c.metadata }]}>
        {DISCLOSURE}
      </Text>
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
  restoreTop: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  restoreTopText: { ...typeScale.headline },
  topSpacer: { flex: 1 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 16, height: 16 },
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
  hero: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  infinity: { fontSize: 40, fontWeight: '300' },
  pillRow: { alignItems: 'center', marginBottom: spacing.md },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  proDot: { width: 7, height: 7, borderRadius: 3.5 },
  proPillText: {
    ...typeScale.footnote,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { ...typeScale.title1, textAlign: 'center', marginBottom: spacing.sm },
  subcopy: {
    ...typeScale.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  checklist: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  unlockTextWrap: { flex: 1, gap: 2 },
  unlockTitle: { ...typeScale.headline },
  unlockSub: { ...typeScale.footnote },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    ...typeScale.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tierNote: { ...typeScale.footnote },
  tierPrice: { ...typeScale.headline },
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
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  legalLink: { paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  legalText: { ...typeScale.footnote },
  legalDot: { ...typeScale.footnote },
  finePrint: {
    ...typeScale.footnote,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  pressed: { opacity: 0.7 },
});
