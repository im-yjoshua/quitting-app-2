/**
 * Urge Surf — Stitch v4 rebuild ("Emergency Panic Sos", plan §2.3).
 *
 * Single-screen emergency surface: header (back chevron / avatar), a violet
 * arc ring counting the session down, breath-phase cues synced to the breath
 * math in services/urgeSurf (read-only), a timer pill, the "Surfing the
 * Wave" education card (honest copy — no invented claims), and the white
 * pill "I Made It Through (Log Craving)" + "+2 min" text button.
 *
 * Contracts preserved from v3:
 * - Dismiss (back chevron) logs nothing — no guilt copy.
 * - The pill calls logUrgeSurf() then goes back (the v2 completion contract).
 * - The "Ambient: Deep Drone 528Hz" card is dropped — we have no audio
 *   (plan §3.5). The optional intensity check-in was simplified away to
 *   match the single-screen reference.
 * - Reduce Motion: the ring stays static; phase cues and the timer still
 *   advance. No translucent fills (Reduce Transparency).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
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
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { InvertedButton } from '../../components/ui/InvertedButton';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Screen } from '../../components/ui/Screen';
import {
  URGE_SURF_DURATION_S,
  breathPhaseAt,
  breathPhaseDurationSec,
  type BreathPhase,
} from '../../services/urgeSurf';
import { radii, spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { useAppState } from '../../state/AppStateContext';

const TICK_S = 0.25;
/** Extra session time granted per tap of "I need more time". */
const EXTEND_S = 120;
/** Gentle breath swell on the ring — calmer than v3's orb bounce. */
const BREATH_PEAK_SCALE = 1.06;

/**
 * Phase cues from the reference. `services/urgeSurf` owns the timing;
 * presentation owns the words (the plan's cues: Breathe in… / Hold… /
 * Release…). The sub-lines are neutral instructions, not claims.
 */
const PHASE_COPY: Record<BreathPhase, { cue: string; sub: string }> = {
  in: { cue: 'Breathe in…', sub: 'Inhale through nose' },
  hold: { cue: 'Hold…', sub: 'Float at the peak' },
  out: { cue: 'Release', sub: 'Slow exhale through mouth' },
};

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Icon({
  ios,
  android,
  size,
  color,
  weight,
}: {
  ios: string;
  android: string;
  size?: number;
  color: string;
  weight?: 'regular' | 'semibold' | 'bold';
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never }}
      tintColor={color}
      weight={weight}
      style={{ width: size, height: size }}
    />
  );
}

export default function UrgeSurfScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { logUrgeSurf } = useAppState();

  const [elapsed, setElapsed] = useState(0);
  const [extraSeconds, setExtraSeconds] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const total = URGE_SURF_DURATION_S + extraSeconds;
  const done = elapsed >= total;
  const remaining = Math.max(0, Math.ceil(total - elapsed));

  // Session clock.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed((e) => e + TICK_S), TICK_S * 1000);
    return () => clearInterval(id);
  }, [done]);

  // Session complete → haptic only; the pill still does the logging.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (done && !celebratedRef.current) {
      celebratedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [done]);

  // Breath swell follows the guided phases — UI thread only.
  // Under Reduce Motion the ring stays static; cues and timer advance.
  const breathScale = useSharedValue(1);
  const phase = breathPhaseAt(elapsed);
  const copy = PHASE_COPY[phase];
  useEffect(() => {
    if (reduceMotion) {
      breathScale.value = 1;
      return;
    }
    breathScale.value = withTiming(phase === 'out' ? 1 : BREATH_PEAK_SCALE, {
      duration: breathPhaseDurationSec(phase) * 1000,
      easing: Easing.inOut(Easing.ease),
    });
  }, [phase, reduceMotion, breathScale]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const ringSize = Math.min(width * 0.82, 340);
  const dotIndex = phase === 'in' ? 0 : phase === 'hold' ? 1 : 2;

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await logUrgeSurf();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setFinishing(false);
    }
  };

  const handleExtend = () => {
    void Haptics.selectionAsync();
    setExtraSeconds((e) => e + EXTEND_S);
  };

  return (
    <Screen scrollable edges={['top', 'left', 'right', 'bottom']}>
      {/* Header: back chevron, title, avatar */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.headerHit}
          hitSlop={8}
        >
          <Icon ios="chevron.left" android="arrow_back" size={22} color={c.text} weight="semibold" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
          Emergency Panic Sos
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={() => router.push('/you')}
          style={styles.headerHit}
        >
          <View style={[styles.avatar, { backgroundColor: c.accent }]}>
            <Icon ios="person.fill" android="person" size={18} color={c.onAccent} />
          </View>
        </Pressable>
      </View>

      {/* Breathing ring */}
      <View style={styles.hero}>
        <Animated.View style={breathStyle}>
          <ProgressRing
            progress={total > 0 ? remaining / total : 0}
            size={ringSize}
            stroke={4}
          >
            <View style={styles.ringInner}>
              <Text
                style={[styles.cue, { color: c.text }]}
                accessibilityLiveRegion="polite"
              >
                {copy.cue}
              </Text>
              <View
                style={[styles.timerPill, { backgroundColor: c.surfaceDeep }]}
                accessibilityRole="text"
                accessibilityLabel={`${remaining} seconds remaining`}
              >
                <Icon ios="clock" android="schedule" size={13} color={c.accent} />
                <Text
                  style={[
                    styles.timerText,
                    typeScale.tabular,
                    { color: c.metadata },
                  ]}
                >
                  {formatCountdown(remaining)}
                </Text>
              </View>
              <Text style={[styles.sub, { color: c.muted }]}>
                {copy.sub.toUpperCase()}
              </Text>
            </View>
          </ProgressRing>
        </Animated.View>

        {/* Phase dots — decorative, the cue text carries the meaning */}
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === dotIndex
                  ? [styles.dotActive, { backgroundColor: c.accent }]
                  : { backgroundColor: c.hairline },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Education card — honest copy, no invented stats */}
      <View
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
      >
        <View style={[styles.cardIcon, { backgroundColor: c.surfaceDeep }]}>
          <Icon ios="water.waves" android="waves" size={18} color={c.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Surfing the Wave</Text>
          <Text style={[styles.cardBody, { color: c.metadata }]}>
            Urges peak and pass. Ride the wave.
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cta}>
        <InvertedButton
          title={finishing ? 'Saving…' : 'I Made It Through (Log Craving)'}
          onPress={handleFinish}
          loading={finishing}
          accessibilityLabel="I made it through. Log craving"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I need more time, add 2 minutes"
          onPress={handleExtend}
          style={styles.extend}
        >
          <Text style={[styles.extendText, { color: c.metadata }]}>
            I need more time (+2 min)
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  headerHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typeScale.title3,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cue: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timerText: {
    ...typeScale.caption,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...typeScale.subhead,
    fontWeight: '600',
  },
  cardBody: {
    ...typeScale.subhead,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  extend: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendText: {
    ...typeScale.footnote,
    fontWeight: '500',
  },
});
