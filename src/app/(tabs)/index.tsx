/**
 * Home — the soul of the app (spec §2.2).
 *
 * Layout top→bottom:
 * - The Orb (hero, ~55% of viewport): living liquid-glass sphere, tap for
 *   the exact clean-time sheet.
 * - Clean time: `DAY 47` + live-ticking `1,128 h 24 m 10 s` (1s, pauses when
 *   backgrounded).
 * - Pledge button: full-width glass CTA. "Pledge today" → tap → haptic →
 *   "Pledged ✓ · N-day pledge streak".
 * - Rotating reason (8s fade) — the emotional hook from onboarding.
 * - "Craving right now?" → Urge Surf. "I slipped" (quiet, shame-free) → Relapse.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState as RNAppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Orb } from '../../../components/Orb';
import { CelebrationSheet } from '../../../components/CelebrationSheet';
import { ShareCardSheet } from '../../../components/ShareCardSheet';
import { GlassButton } from '../../../components/glass/GlassButton';
import { GlassCard } from '../../../components/glass/GlassCard';
import { Screen } from '../../../components/glass/Screen';
import { MS_PER_DAY } from '../../../services/chronometerEngine';
import { hasPledgedToday } from '../../../services/pledge';
import { useAppState } from '../../../state/AppStateContext';
import { useMilestoneCelebration } from '../../../hooks/useMilestoneCelebration';
import { usePremium } from '../../../hooks/usePremium';
import { colors, spacing, type } from '../../../theme/tokens';

const REASON_ROTATE_MS = 8000;

function ExactTimeSheet({
  visible,
  onClose,
  nowMs,
  startMs,
}: {
  visible: boolean;
  onClose: () => void;
  nowMs: number;
  startMs: number;
}) {
  const cleanMs = Math.max(0, nowMs - startMs);
  const days = Math.floor(cleanMs / MS_PER_DAY);
  const hours = Math.floor(cleanMs / 3_600_000) % 24;
  const minutes = Math.floor(cleanMs / 60_000) % 60;
  const seconds = Math.floor(cleanMs / 1000) % 60;
  const started = new Date(startMs).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <GlassCard style={styles.sheetCard}>
            <Text style={styles.sheetEyebrow}>EXACT CLEAN TIME</Text>
            <Text style={styles.sheetTime}>
              {days}d {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m{' '}
              {String(seconds).padStart(2, '0')}s
            </Text>
            <Text style={styles.sheetSub}>Clean since {started}</Text>
            <GlassButton title="Close" onPress={onClose} tone="neutral" style={styles.sheetBtn} />
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function HomeScreen() {
  const { state, loading, pledgeNow } = useAppState();
  const { width } = useWindowDimensions();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sheetVisible, setSheetVisible] = useState(false);
  const celebration = useMilestoneCelebration();
  const { isPremium } = usePremium();

  // 1s live tick, paused while backgrounded.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => setNowMs(Date.now()), 1000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNowMs(Date.now());
        start();
      } else {
        stop();
      }
    });
    start();
    return () => {
      stop();
      sub.remove();
    };
  }, []);

  // Route guard: no quit = onboarding not complete.
  useEffect(() => {
    if (!loading && state && !state.quit) {
      router.replace('/onboarding');
    }
  }, [loading, state]);

  const quit = state?.quit;

  // Rotating reasons — 8s fade between the onboarding-captured reasons.
  const reasons = quit?.reasons ?? [];
  const [reasonIdx, setReasonIdx] = useState(0);
  const reasonFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reasons.length < 2) return;
    const id = setInterval(() => {
      Animated.timing(reasonFade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setReasonIdx((i) => (i + 1) % reasons.length);
        Animated.timing(reasonFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, REASON_ROTATE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasons.length]);

  if (loading || !state) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (!quit) return null; // redirecting to onboarding

  const cleanMs = Math.max(0, nowMs - Date.parse(quit.startDate));
  const cleanDays = Math.floor(cleanMs / MS_PER_DAY);
  const totalHours = Math.floor(cleanMs / 3_600_000);
  const minutes = Math.floor(cleanMs / 60_000) % 60;
  const seconds = Math.floor(cleanMs / 1000) % 60;
  const counterLine = `${totalHours.toLocaleString('en-US')} h ${String(minutes).padStart(2, '0')} m ${String(seconds).padStart(2, '0')} s`;

  const pledged = hasPledgedToday(state.pledge, nowMs);
  const pledgeStreak = state.pledge.pledgeStreak;
  const orbSize = Math.min(width * 0.62, 300);

  const handlePledge = async () => {
    const counted = await pledgeNow();
    if (counted) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.orbHero}>
          <Orb
            cleanDays={cleanMs / MS_PER_DAY}
            theme={state.settings.orbTheme}
            size={orbSize}
            onPress={() => setSheetVisible(true)}
          />
        </View>

        <View style={styles.counter}>
          <Text style={styles.streakEyebrow}>CURRENT STREAK</Text>
          <Text style={styles.dayNumber}>
            {cleanDays.toLocaleString('en-US')}
          </Text>
          <Text style={styles.dayCaption}>
            day{cleanDays === 1 ? '' : 's'} clean
          </Text>
          <Text style={styles.counterLine}>{counterLine}</Text>
        </View>

        <View style={styles.pledgeWrap}>
          <GlassButton
            title={
              pledged
                ? `Pledged ✓${pledgeStreak > 0 ? ` · ${pledgeStreak}-day streak` : ''}`
                : 'Pledge today'
            }
            onPress={handlePledge}
            disabled={pledged}
          />
        </View>

        {reasons.length > 0 && (
          <Animated.Text style={[styles.reason, { opacity: reasonFade }]}>
            {reasons[reasonIdx % reasons.length]}
          </Animated.Text>
        )}

        <View style={styles.links}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/urge-surf')}
            style={styles.cravingLink}
          >
            <Text style={styles.cravingText}>Craving right now?</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/relapse')}
            style={styles.slipLink}
          >
            <Text style={styles.slipText}>I slipped</Text>
          </Pressable>
        </View>

      </ScrollView>

      <ExactTimeSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        nowMs={nowMs}
        startMs={Date.parse(quit.startDate)}
      />

      {celebration.celebration !== null && (
        <CelebrationSheet
          visible
          milestone={celebration.celebration}
          onShare={celebration.openShare}
          onDismiss={celebration.dismissCelebration}
        />
      )}

      {celebration.celebration !== null && (
        <ShareCardSheet
          visible={celebration.shareOpen}
          days={celebration.celebration}
          category={quit.category}
          customName={quit.customName}
          isPremium={isPremium}
          onRequestPremium={() => {
            celebration.closeShare();
            router.push('/paywall');
          }}
          onClose={celebration.closeShare}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  orbHero: {
    minHeight: '42%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  counter: { alignItems: 'center', marginTop: spacing.sm },
  streakEyebrow: {
    ...type.caption,
    color: colors.textTertiary,
    letterSpacing: 3,
  },
  dayNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -2,
    lineHeight: 80,
    marginTop: spacing.xs,
  },
  dayCaption: { ...type.callout, color: colors.textSecondary, marginTop: 2 },
  counterLine: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  pledgeWrap: { marginTop: spacing.lg },
  reason: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  links: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.md },
  cravingLink: { paddingVertical: spacing.sm },
  cravingText: { ...type.body, color: colors.accent, fontWeight: '600' },
  slipLink: { paddingVertical: spacing.sm },
  slipText: { ...type.callout, color: colors.textTertiary },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetCard: { width: '100%', padding: spacing.xl, alignItems: 'center' },
  sheetEyebrow: { ...type.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  sheetTime: { ...type.title, color: colors.text, textAlign: 'center' },
  sheetSub: { ...type.callout, color: colors.textSecondary, marginTop: spacing.sm },
  sheetBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
