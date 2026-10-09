/**
 * Urge Surf — the 3am feature (v3 rebuild, plan §3.3).
 *
 * Full-screen modal takeover, designed for half-open eyes: huge targets,
 * minimal text, dark canvas. A guided breathing ring (in 4s / hold 4s /
 * out 6s) wrapped in a 2:00 countdown ring, phase cues synced to the
 * breath math in services/urgeSurf (read-only).
 *
 * Flow: optional intensity check → breathing session → "You rode it out."
 * Dismiss (close X / "I'm okay now") logs nothing and shows no guilt copy.
 * Completion keeps the v2 contract: logUrgeSurf() + an optional journal
 * check-in carrying the end intensity.
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

import { Orb } from '../../components/orb/Orb';
import { InvertedButton } from '../../components/ui/InvertedButton';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Screen } from '../../components/ui/Screen';
import {
  intensityDeltaCopy,
  type IntensityValue,
} from '../../components/ui/logic';
import { daysCleanBefore } from '../../services/relapse';
import {
  URGE_SURF_DURATION_S,
  URGE_SURF_EARLY_EXIT_S,
  breathPhaseAt,
  breathPhaseDurationSec,
  breathPhaseLabel,
} from '../../services/urgeSurf';
import { useAppState } from '../../state/AppStateContext';
import { spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const TICK_S = 0.25;
/** Breath scale — a visible inhale/exhale without being a bounce. */
const BREATH_PEAK_SCALE = 1.16;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function IntensityDots({
  value,
  onChange,
  groupLabel,
}: {
  value: IntensityValue;
  onChange: (v: IntensityValue) => void;
  groupLabel: string;
}) {
  const theme = useTheme();
  const pick = (n: Exclude<IntensityValue, null>) => {
    void Haptics.selectionAsync();
    onChange(value === n ? null : n);
  };
  return (
    <View
      style={styles.dotsRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
    >
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const selected = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`Intensity ${n} of 5`}
            accessibilityState={{ selected }}
            onPress={() => pick(n)}
            style={styles.dotCell}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: selected
                    ? theme.colors.accent
                    : 'transparent',
                  borderColor: selected
                    ? theme.colors.accent
                    : theme.colors.hairline,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      style={styles.close}
      hitSlop={12}
    >
      <SymbolView
        name="xmark"
        size={22}
        tintColor={theme.colors.text}
        weight="semibold"
      />
    </Pressable>
  );
}

export default function UrgeSurfScreen() {
  const theme = useTheme();
  const { state, logUrgeSurf, addJournal } = useAppState();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [screenPhase, setScreenPhase] = useState<'check' | 'session' | 'done'>(
    'check'
  );
  const [startCraving, setStartCraving] = useState<IntensityValue>(null);
  const [endCraving, setEndCraving] = useState<IntensityValue>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const done = elapsed >= URGE_SURF_DURATION_S;

  // Session clock — runs only during the breathing session.
  useEffect(() => {
    if (screenPhase !== 'session' || done) return;
    const id = setInterval(() => setElapsed((e) => e + TICK_S), TICK_S * 1000);
    return () => clearInterval(id);
  }, [screenPhase, done]);

  // Session complete → celebration (side effect only — no state writes).
  // The end screen is a pure function of `elapsed`; nothing needs to sync.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (done && screenPhase === 'session' && !celebratedRef.current) {
      celebratedRef.current = true;
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    }
  }, [done, screenPhase]);

  const sessionComplete =
    screenPhase === 'done' || (screenPhase === 'session' && done);

  // Breath ring follows the guided phases — UI thread only.
  // Under Reduce Motion the ring stays static; the cue text still advances.
  const breathScale = useSharedValue(1);
  const phase = breathPhaseAt(elapsed);
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

  // Orb radiance is a slow function of the streak — "now" at render is fine.
  // eslint-disable-next-line react-hooks/purity
  const cleanDays = state?.quit != null ? daysCleanBefore(state.quit.startDate, Date.now()) : 0;

  const ringSize = Math.min(width * 0.78, 320);
  const orbSize = ringSize - 56;
  const remaining = Math.max(0, Math.ceil(URGE_SURF_DURATION_S - elapsed));

  const beginSession = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScreenPhase('session');
  };

  // Completion contract (v2 parity): persist the session; the optional end
  // intensity also lands in the journal as a check-in.
  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await logUrgeSurf();
      if (endCraving !== null) {
        await addJournal('Rode out an urge 🌊', endCraving);
      }
      router.back();
    } finally {
      setFinishing(false);
    }
  };

  const deltaCopy = intensityDeltaCopy(startCraving, endCraving);

  if (screenPhase === 'check') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <CloseButton onPress={() => router.back()} />
        <View style={styles.centerWrap}>
          <Text style={[styles.checkTitle, { color: theme.colors.text }]}>
            How strong is it?
          </Text>
          <Text style={[styles.meta, { color: theme.colors.metadata }]}>
            Optional — skip anytime.
          </Text>
          <IntensityDots
            value={startCraving}
            onChange={setStartCraving}
            groupLabel="Craving intensity, optional"
          />
          <View style={styles.cta}>
            <InvertedButton title="Begin breathing" onPress={beginSession} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip the check-in"
              onPress={beginSession}
              style={styles.skipLink}
            >
              <Text style={[styles.skipText, { color: theme.colors.accent }]}>
                Skip
              </Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  if (screenPhase === 'done' || sessionComplete) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.centerWrap}>
          <Text style={[styles.doneTitle, { color: theme.colors.text }]}>
            You rode it out.
          </Text>
          {deltaCopy !== null ? (
            <Text style={[styles.delta, { color: theme.colors.text }]}>
              {deltaCopy}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: theme.colors.metadata }]}>
            How does it feel now? (optional)
          </Text>
          <IntensityDots
            value={endCraving}
            onChange={setEndCraving}
            groupLabel="Craving intensity after, optional"
          />
          <View style={styles.cta}>
            <InvertedButton
              title={finishing ? 'Saving…' : 'Done'}
              onPress={handleFinish}
              loading={finishing}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <CloseButton onPress={() => router.back()} />
      <View style={styles.centerWrap}>
        <Text
          style={[styles.cue, { color: theme.colors.text }]}
          key={phase}
          accessibilityLiveRegion="polite"
        >
          {breathPhaseLabel(phase)}
        </Text>
        <ProgressRing progress={elapsed / URGE_SURF_DURATION_S} size={ringSize}>
          <Animated.View style={breathStyle}>
            <Orb cleanDays={cleanDays} size={orbSize} />
          </Animated.View>
        </ProgressRing>
        <Text
          style={[
            styles.timer,
            typeScale.tabular,
            { color: theme.colors.text },
          ]}
        >
          {formatCountdown(remaining)}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.metadata }]}>
          Urges peak and pass. Ride the wave.
        </Text>
        {elapsed >= URGE_SURF_EARLY_EXIT_S ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I'm okay now, end the session"
            onPress={() => router.back()}
            style={styles.earlyExit}
          >
            <Text style={[styles.earlyExitText, { color: theme.colors.text }]}>
              I’m okay now
            </Text>
          </Pressable>
        ) : (
          <View style={styles.earlyExitPlaceholder} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  close: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  checkTitle: { ...typeScale.title3, textAlign: 'center' },
  doneTitle: { ...typeScale.title1, textAlign: 'center' },
  delta: { ...typeScale.body, textAlign: 'center' },
  meta: { ...typeScale.footnote, textAlign: 'center' },
  cue: { ...typeScale.title1, textAlign: 'center' },
  timer: { ...typeScale.headline, textAlign: 'center' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dotCell: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  cta: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  skipLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { ...typeScale.headline },
  earlyExit: {
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlyExitText: { ...typeScale.headline },
  earlyExitPlaceholder: { height: 56 },
});
