/**
 * Home — the soul of Sovereign v3 (Phase 4 rebuild).
 *
 * Minimal, not a dashboard. Top→bottom:
 * - Orb v2 (the one intentional color object): large, slow breathing,
 *   day count + "days clean" in its center.
 * - Live ticker: HH:MM:SS in tabular numerals, footnote label
 *   "clean time right now" (numbers just change — no animation on tick).
 * - Pledge card (glass): "Today's pledge" — unpledged: quiet outline
 *   button "I pledge today"; pledged: "Pledged ✓ · N-day streak".
 * - Next milestone: hairline progress track + ring, "N days to M days".
 * - Urge FAB (Home-only): floating violet waveform circle, routes to
 *   the urge-surf modal.
 *
 * Deliberately absent: stat chips, charts, grids (those live in Stats).
 *
 * Logic is presentation-only: the pledge/streak/milestone contracts come
 * from services/* and state/AppStateContext (untouched); the celebration
 * hook keeps firing exactly-once milestone sheets.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState as RNAppState,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FAB, GhostButton, GlassCard, ProgressRing, Screen } from '../../../components/ui';
import { Orb } from '../../../components/orb';
import { CelebrationSheet } from '../../../components/CelebrationSheet';
import { ShareCardSheet } from '../../../components/ShareCardSheet';
import {
  breakDownDuration,
  calculateCleanDurationMs,
  MS_PER_DAY,
} from '../../../services/chronometerEngine';
import { MILESTONES, nextMilestone } from '../../../services/milestones';
import { hasPledgedToday } from '../../../services/pledge';
import { useAppState } from '../../../state/AppStateContext';
import { useMilestoneCelebration } from '../../../hooks/useMilestoneCelebration';
import { usePremium } from '../../../hooks/usePremium';
import { useTheme } from '../../../theme/useTheme';
import { spacing, type as typeScale } from '../../../theme/tokens';

export default function HomeScreen() {
  const { state, loading, pledgeNow } = useAppState();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const celebration = useMilestoneCelebration();
  const { isPremium } = usePremium();

  // 1s live tick, paused while backgrounded. The counter reads from the
  // same time source as the v2 Home (quit.startDate vs Date.now()) through
  // the chronometer engine's pure helpers — numbers change, nothing animates.
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

  if (loading || !state) {
    return (
      <Screen>
        <View style={styles.loading} testID="home-loading">
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      </Screen>
    );
  }
  const quit = state.quit;
  if (!quit) return null; // redirecting to onboarding

  const cleanMs = calculateCleanDurationMs(nowMs, Date.parse(quit.startDate));
  const bd = breakDownDuration(cleanMs);
  const days = bd.days;

  const pledged = hasPledgedToday(state.pledge, nowMs);
  const pledgeStreak = state.pledge.pledgeStreak;
  const orbSize = Math.min(width * 0.62, 300);

  // Next milestone: progress measured from the previous milestone so the
  // ring fills between them ("13 days to 60 days" at day 47).
  const next = nextMilestone(days);
  const prev = [...MILESTONES].reverse().find((m) => m <= days) ?? 0;
  const milestoneProgress =
    next === null ? 1 : Math.min(1, Math.max(0, (days - prev) / (next - prev)));

  const handlePledge = async () => {
    const counted = await pledgeNow();
    if (counted) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={styles.root} testID="home-root">
      <Screen scrollable>
        <View style={styles.orbZone}>
          <Orb cleanDays={cleanMs / MS_PER_DAY} size={orbSize} testID="home-orb" />
        </View>

        <View
          style={styles.ticker}
          accessibilityRole="timer"
          accessibilityLabel={`Clean time right now: ${days} days, ${bd.hours} hours, ${bd.minutes} minutes, ${bd.seconds} seconds`}
          testID="home-ticker"
        >
          <Text
            style={[
              styles.tickerTime,
              { color: theme.colors.text, ...typeScale.tabular },
            ]}
          >
            {bd.formattedHours}:{bd.formattedMinutes}:{bd.formattedSeconds}
          </Text>
          <Text style={[styles.tickerLabel, { color: theme.colors.metadata }]}>
            clean time right now
          </Text>
        </View>

        <View style={styles.cardZone}>
          <GlassCard testID="pledge-card">
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Today&apos;s pledge
            </Text>
            {pledged ? (
              <Text
                style={[styles.pledgedLine, { color: theme.colors.text }]}
                accessibilityRole="text"
                accessibilityLabel={
                  pledgeStreak > 0
                    ? `Pledged today. ${pledgeStreak}-day pledge streak.`
                    : 'Pledged today.'
                }
                testID="pledge-status"
              >
                Pledged ✓
                {pledgeStreak > 0 ? ` · ${pledgeStreak}-day streak` : ''}
              </Text>
            ) : (
              <GhostButton
                title="I pledge today"
                onPress={handlePledge}
                style={styles.pledgeButton}
                testID="pledge-button"
              />
            )}
          </GlassCard>
        </View>

        <View style={styles.milestoneZone} testID="milestone-block">
          <Text style={[styles.eyebrow, { color: theme.colors.metadata }]}>
            NEXT MILESTONE
          </Text>
          {next !== null ? (
            <>
              <View style={styles.milestoneRow}>
                <ProgressRing
                  progress={milestoneProgress}
                  size={64}
                  stroke={6}
                  color={theme.colors.text}
                  testID="milestone-ring"
                >
                  <Text
                    style={[
                      styles.ringNumber,
                      { color: theme.colors.text, ...typeScale.tabular },
                    ]}
                  >
                    {next - days}
                  </Text>
                </ProgressRing>
                <Text
                  style={[styles.milestoneLine, { color: theme.colors.text }]}
                  accessibilityLabel={`${next - days} days to the ${next}-day milestone`}
                >
                  {next - days} days to {next} days
                </Text>
              </View>
              <View
                style={[styles.track, { backgroundColor: theme.colors.hairline }]}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  now: Math.round(milestoneProgress * 100),
                  min: 0,
                  max: 100,
                }}
              >
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: `${milestoneProgress * 100}%`,
                      backgroundColor: theme.colors.text,
                    },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text style={[styles.milestoneLine, { color: theme.colors.text }]}>
              Every milestone reached.
            </Text>
          )}
        </View>
      </Screen>

      <FAB
        iosSymbol="waveform"
        androidSymbol="graphic_eq"
        label="Urge surf — ride out a craving"
        onPress={() => router.push('/urge-surf')}
        style={[styles.fab, { bottom: insets.bottom + spacing.md }]}
        testID="urge-fab"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  ticker: { alignItems: 'center' },
  tickerTime: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tickerLabel: {
    ...typeScale.footnote,
    marginTop: spacing.xs,
  },
  cardZone: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  cardTitle: {
    ...typeScale.headline,
    marginBottom: spacing.sm,
  },
  pledgeButton: { marginTop: spacing.xs },
  pledgedLine: {
    ...typeScale.body,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  milestoneZone: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  eyebrow: {
    ...typeScale.footnote,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringNumber: {
    ...typeScale.subhead,
    fontWeight: '600',
  },
  milestoneLine: {
    ...typeScale.body,
  },
  track: {
    height: 2,
    borderRadius: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
  },
});
