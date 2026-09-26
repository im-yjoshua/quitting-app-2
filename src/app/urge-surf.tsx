/**
 * Urge Surf — the 3am feature (spec §2.3).
 *
 * Full-screen breathing guide: in 4s / hold 4s / out 6s, 120s session.
 * The Orb (static render path) scales with the breath phases via Reanimated
 * on the UI thread. "I’m okay now" early exit after 30s — no guilt copy.
 * Completion logs to urgeSurfs; the optional craving rating also lands in
 * the journal as a check-in.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CravingDots, type CravingValue } from '../../components/CravingDots';
import { Orb } from '../../components/Orb';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { Screen } from '../../components/glass/Screen';
import { daysCleanBefore } from '../../services/relapse';
import {
  URGE_SURF_DURATION_S,
  URGE_SURF_EARLY_EXIT_S,
  breathPhaseAt,
  breathPhaseDurationSec,
  breathPhaseLabel,
} from '../../services/urgeSurf';
import { useAppState } from '../../state/AppStateContext';
import { colors, spacing, type } from '../../theme/tokens';

const TICK_S = 0.25;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function UrgeSurfScreen() {
  const { state, logUrgeSurf, addJournal } = useAppState();
  const { width } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(0);
  const [craving, setCraving] = useState<CravingValue>(null);
  const [finishing, setFinishing] = useState(false);

  // Derived: the session is complete once the clock runs out. No state
  // write needed — the end screen is a pure function of `elapsed`.
  const done = elapsed >= URGE_SURF_DURATION_S;

  const breathScale = useSharedValue(1);

  // Session clock.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed((e) => e + TICK_S), TICK_S * 1000);
    return () => clearInterval(id);
  }, [done]);

  // Completion fanfare (side effect only — no state writes).
  useEffect(() => {
    if (done) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [done]);

  const phase = breathPhaseAt(elapsed);

  // Orb breathes with the guide — UI thread, no per-frame JS.
  useEffect(() => {
    breathScale.value = withTiming(phase === 'out' ? 1 : 1.14, {
      duration: breathPhaseDurationSec(phase) * 1000,
      easing: Easing.inOut(Easing.ease),
    });
  }, [phase, breathScale]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await logUrgeSurf();
      if (craving !== null) {
        await addJournal('Rode out an urge 🌊', craving);
      }
      router.back();
    } finally {
      setFinishing(false);
    }
  };

  // Orb radiance is a slow function of the streak — "now" at render is fine.
  // eslint-disable-next-line react-hooks/purity
  const cleanDays = state?.quit ? daysCleanBefore(state.quit.startDate, Date.now()) : 0;
  const orbSize = Math.min(width * 0.66, 280);
  const remaining = Math.max(0, Math.ceil(URGE_SURF_DURATION_S - elapsed));
  const progress = Math.min(1, elapsed / URGE_SURF_DURATION_S);

  if (done) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <Text style={styles.emoji}>🌊</Text>
          <Text style={styles.title}>You rode it out</Text>
          <Text style={styles.sub}>Urges peak and pass. This one did.</Text>
          <GlassCard style={styles.card}>
            <Text style={styles.cardLabel}>How strong was it? (optional)</Text>
            <CravingDots value={craving} onChange={setCraving} />
          </GlassCard>
          <GlassButton
            title={finishing ? 'Saving…' : 'Back home'}
            onPress={handleFinish}
            disabled={finishing}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.phaseLabel} key={phase}>
          {breathPhaseLabel(phase)}
        </Text>
        <Animated.View style={breathStyle}>
          <Orb
            cleanDays={cleanDays}
            theme={state?.settings.orbTheme ?? 'dawn'}
            size={orbSize}
            animated={false}
          />
        </Animated.View>
        <Text style={styles.copy}>
          Urges peak and pass in ~20 minutes.{'\n'}Ride this one out.
        </Text>
        <Text style={styles.timer}>{formatCountdown(remaining)}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
        {elapsed >= URGE_SURF_EARLY_EXIT_S ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.exitLink}
          >
            <Text style={styles.exitText}>I’m okay now</Text>
          </Pressable>
        ) : (
          <View style={styles.exitPlaceholder} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  phaseLabel: { ...type.title, color: colors.text, textAlign: 'center' },
  copy: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  timer: { ...type.callout, color: colors.textTertiary },
  progressTrack: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.backgroundElement,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  exitLink: { paddingVertical: spacing.md, marginTop: spacing.sm },
  exitText: { ...type.callout, color: colors.textSecondary },
  exitPlaceholder: { height: 52 },
  emoji: { fontSize: 56 },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  sub: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  card: { width: '100%', padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  cardLabel: { ...type.callout, color: colors.textSecondary },
});
