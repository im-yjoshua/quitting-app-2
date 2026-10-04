/**
 * Home — the soul of the app.
 *
 * Monochrome canvas; the Orb is the only color story. Top→bottom:
 * - The Orb (hero): living glass sphere, tap for the exact clean-time sheet.
 * - DAY 47 — giant full-brightness numeral + live-ticking counter below.
 * - Pledge button: inverted primary. "Pledge today" → "Pledged ✓ · streak".
 * - Rotating reason (slow 12s crossfade) — the emotional hook.
 * - "Craving right now?" (quiet accent link) → Urge Surf.
 *   "I slipped" (quiet) → Relapse.
 *
 * Logic (pledge flow, route guard, milestone + share wiring, 1s tick) is
 * unchanged from the pre-redesign build — this file is a visual recomposition.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState as RNAppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Orb } from '../../../components/Orb';
import type { OrbTheme } from '../../../types/app';
import { CelebrationSheet } from '../../../components/CelebrationSheet';
import { ShareCardSheet } from '../../../components/ShareCardSheet';
import { GlassButton } from '../../../components/glass/GlassButton';
import { Screen } from '../../../components/glass/Screen';
import { Sheet } from '../../../components/glass/Sheet';
import { MS_PER_DAY } from '../../../services/chronometerEngine';
import { hasPledgedToday } from '../../../services/pledge';
import { useAppState } from '../../../state/AppStateContext';
import { useMilestoneCelebration } from '../../../hooks/useMilestoneCelebration';
import { usePremium } from '../../../hooks/usePremium';
import { useTheme } from '../../../theme/useTheme';
import { spacing, type } from '../../../theme/tokens';

const REASON_ROTATE_MS = 12000;

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
  const theme = useTheme();
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
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheetInner}>
        <Text style={[styles.sheetEyebrow, { color: theme.colors.metadata }]}>
          EXACT CLEAN TIME
        </Text>
        <Text
          style={[
            styles.sheetTime,
            { color: theme.colors.text, fontVariant: ['tabular-nums'] },
          ]}
        >
          {days}d {String(hours).padStart(2, '0')}h{' '}
          {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
        </Text>
        <Text style={[styles.sheetSub, { color: theme.colors.metadata }]}>
          Clean since {started}
        </Text>
        <GlassButton
          title="Close"
          onPress={onClose}
          variant="primary"
          style={styles.sheetBtn}
        />
      </View>
    </Sheet>
  );
}

function OrbHero({
  theme,
  cleanMs,
  size,
  onPress,
}: {
  theme: OrbTheme;
  cleanMs: number;
  size: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.orbHero}>
      <Orb
        cleanDays={cleanMs / MS_PER_DAY}
        theme={theme}
        size={size}
        onPress={onPress}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { state, loading, pledgeNow } = useAppState();
  const theme = useTheme();
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

  // Rotating reasons — slow 12s crossfade between the onboarding-captured
  // reasons. Ambient, not decorative: it's the emotional hook of the screen.
  const reasons = quit?.reasons ?? [];
  const [reasonIdx, setReasonIdx] = useState(0);
  // useState (not useRef().current) holds the Animated.Value — the
  // react-hooks/refs lint rule forbids reading ref values during render.
  const [reasonFade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reasons.length < 2) return;
    const id = setInterval(() => {
      Animated.timing(reasonFade, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setReasonIdx((i) => (i + 1) % reasons.length);
        Animated.timing(reasonFade, {
          toValue: 1,
          duration: 600,
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
          <ActivityIndicator size="large" color={theme.colors.text} />
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
  const counterLine = `${totalHours.toLocaleString('en-US')} h ${String(
    minutes
  ).padStart(2, '0')} m ${String(seconds).padStart(2, '0')} s`;

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
        <OrbHero
          theme={state.settings.orbTheme}
          cleanMs={cleanMs}
          size={orbSize}
          onPress={() => setSheetVisible(true)}
        />

        <View style={styles.counter}>
          <Text style={[styles.streakEyebrow, { color: theme.colors.metadata }]}>
            CURRENT STREAK
          </Text>
          <Text
            style={[
              styles.dayNumber,
              { color: theme.colors.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            {cleanDays.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.dayCaption, { color: theme.colors.metadata }]}>
            day{cleanDays === 1 ? '' : 's'} clean
          </Text>
          <Text
            style={[
              styles.counterLine,
              { color: theme.colors.metadata, fontVariant: ['tabular-nums'] },
            ]}
          >
            {counterLine}
          </Text>
        </View>

        <View style={styles.pledgeWrap}>
          <GlassButton
            title={
              pledged
                ? `Pledged ✓${
                    pledgeStreak > 0 ? ` · ${pledgeStreak}-day streak` : ''
                  }`
                : 'Pledge today'
            }
            onPress={handlePledge}
            variant="primary"
            disabled={pledged}
          />
        </View>

        {reasons.length > 0 && (
          <Animated.Text
            style={[
              styles.reason,
              { color: theme.colors.text, opacity: reasonFade },
            ]}
          >
            “{reasons[reasonIdx % reasons.length]}”
          </Animated.Text>
        )}

        <View style={styles.links}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/urge-surf')}
            style={styles.linkHit}
          >
            <Text style={[styles.cravingText, { color: theme.colors.accent }]}>
              Craving right now?
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/relapse')}
            style={styles.linkHit}
          >
            <Text style={[styles.slipText, { color: theme.colors.metadata }]}>
              I slipped
            </Text>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  orbHero: {
    minHeight: '38%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  counter: { alignItems: 'center', marginTop: spacing.sm },
  streakEyebrow: {
    ...type.caption,
    letterSpacing: 2,
  },
  dayNumber: {
    fontSize: 76,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 84,
    marginTop: spacing.xs,
  },
  dayCaption: { ...type.callout, marginTop: 2 },
  counterLine: {
    ...type.caption,
    marginTop: spacing.xs,
  },
  pledgeWrap: { marginTop: spacing.lg },
  reason: {
    ...type.body,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  links: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  linkHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cravingText: { ...type.body, fontWeight: '600' },
  slipText: { ...type.callout },
  sheetInner: { alignItems: 'center', paddingTop: spacing.sm },
  sheetEyebrow: { ...type.caption, letterSpacing: 2, marginBottom: spacing.sm },
  sheetTime: { ...type.title1, textAlign: 'center' },
  sheetSub: { ...type.callout, marginTop: spacing.sm },
  sheetBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
