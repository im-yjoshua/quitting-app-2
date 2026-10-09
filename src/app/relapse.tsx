/**
 * Relapse flow (v3 rebuild, plan §3.4) — the compassionate sheet → ritual.
 *
 * Two phases:
 * 1. Sheet: "This doesn't erase your progress." Calm, no red, no warnings,
 *    optional multi-select "What happened?" trigger chips (skippable).
 *    "Begin again" (inverted) applies the reset.
 * 2. Day 0 ritual: honors the last streak, then the day-1 pledge CTA.
 *
 * Keeps the v2 reset contract exactly: logRelapse(note) → applyRelapse
 * state math + persistence, then pledgeNow() before heading home.
 * Copy contract: calm, compassionate, identity-respecting language
 * throughout (phase-gate language audit in the commit report).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton } from '../../components/ui/GhostButton';
import { InvertedButton } from '../../components/ui/InvertedButton';
import { Screen } from '../../components/ui/Screen';
import { Skeleton } from '../../components/ui/Skeleton';
import { daysCleanBefore } from '../../services/relapse';
import { useAppState } from '../../state/AppStateContext';
import { radii, spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const TRIGGERS = [
  'tired',
  'stress',
  'bored',
  'loneliness',
  'alcohol',
  'argument',
  'habit',
  'celebration',
  'social',
  'other',
] as const;

type Trigger = (typeof TRIGGERS)[number];

function daysLine(days: number): string {
  if (days <= 0) {
    return 'Today still counts — your body started healing today.';
  }
  if (days === 1) {
    return 'Your 1 day still counts — your body healed for 1 day.';
  }
  return `Your ${days} days still count — your body healed for ${days} days.`;
}

function TriggerChips({
  selected,
  onToggle,
}: {
  selected: Trigger[];
  onToggle: (t: Trigger) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {TRIGGERS.map((t) => {
        const isSelected = selected.includes(t);
        return (
          <Pressable
            key={t}
            accessibilityRole="checkbox"
            accessibilityLabel={t}
            accessibilityState={{ checked: isSelected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onToggle(t);
            }}
            style={[
              styles.chip,
              {
                borderColor: isSelected
                  ? theme.colors.accent
                  : theme.colors.hairline,
                backgroundColor: isSelected
                  ? theme.colors.accentSoft
                  : 'transparent',
              },
            ]}
          >
            {isSelected ? (
              <SymbolView
                name="checkmark"
                size={14}
                weight="bold"
                tintColor={theme.colors.accent}
              />
            ) : null}
            <Text style={[styles.chipText, { color: theme.colors.text }]}>
              {t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RelapseScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state, loading, logRelapse, pledgeNow, pledgedToday } = useAppState();
  const [phase, setPhase] = useState<'sheet' | 'day0'>('sheet');
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [loggedDays, setLoggedDays] = useState(0);
  const [longestAfter, setLongestAfter] = useState(0);
  const [pledging, setPledging] = useState(false);

  if (loading || !state) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.backdrop} testID="relapse-loading">
          <View
            style={[
              styles.panel,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.hairline,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <View style={styles.grabberZone}>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: theme.colors.metadata },
                ]}
              />
            </View>
            <View style={styles.skelBody}>
              <Skeleton width="70%" height={24} style={styles.skelCenter} />
              <Skeleton width="88%" height={18} style={styles.skelCenter} />
              <Skeleton width="100%" height={96} radius={radii.lg} />
              <Skeleton width="100%" height={50} radius={radii.md} />
              <Skeleton width="100%" height={50} radius={radii.md} />
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  const quit = state.quit;
  if (!quit) {
    // Route guard parity with Home: no quit, no relapse screen.
    router.replace('/onboarding');
    return null;
  }

  // "Now" at render time — idempotent within a render, safe here.
  // eslint-disable-next-line react-hooks/purity
  const days = daysCleanBefore(quit.startDate, Date.now());
  // eslint-disable-next-line react-hooks/purity
  const pledged = pledgedToday(Date.now());

  const toggleTrigger = (t: Trigger) => {
    setTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleBeginAgain = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const note = triggers.join(', ');
      const entry = await logRelapse(note.length > 0 ? note : undefined);
      setLoggedDays(entry.daysCleanBefore);
      setLongestAfter(Math.max(quit.longestStreakDays, entry.daysCleanBefore));
      setPhase('day0');
    } finally {
      setConfirming(false);
    }
  };

  const handlePledgeAndHome = async () => {
    if (pledging) return;
    setPledging(true);
    try {
      if (!pledged) {
        const counted = await pledgeNow();
        if (counted) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        }
      }
      router.back();
    } finally {
      setPledging(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.hairline,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View
            style={styles.grabberZone}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[
                styles.grabber,
                { backgroundColor: theme.colors.metadata },
              ]}
            />
          </View>
          {phase === 'sheet' ? (
            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                This doesn’t erase your progress.
              </Text>
              <Text style={[styles.body, { color: theme.colors.text }]}>
                {daysLine(days)}
              </Text>
              <Text style={[styles.label, { color: theme.colors.metadata }]}>
                What happened? (optional — skip if you’d rather not)
              </Text>
              <TriggerChips selected={triggers} onToggle={toggleTrigger} />
              <View style={styles.cta}>
                <InvertedButton
                  title={confirming ? 'Logging…' : 'Begin again'}
                  onPress={handleBeginAgain}
                  loading={confirming}
                />
                <GhostButton title="Not yet" onPress={() => router.back()} />
              </View>
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Day 1 starts now.
              </Text>
              <Text style={[styles.body, { color: theme.colors.text }]}>
                {loggedDays > 0
                  ? `${loggedDays} days proved you can do this.`
                  : 'Every beginning counts. This is yours.'}
              </Text>
              <View
                style={[
                  styles.longestRow,
                  { borderTopColor: theme.colors.hairline },
                ]}
              >
                <Text
                  style={[styles.label, { color: theme.colors.metadata }]}
                >
                  LONGEST STREAK
                </Text>
                <Text
                  style={[styles.longestValue, { color: theme.colors.text }]}
                >
                  {longestAfter} day{longestAfter === 1 ? '' : 's'} — you’ll
                  beat it.
                </Text>
              </View>
              <View style={styles.cta}>
                <InvertedButton
                  title={
                    pledging ? 'Pledging…' : pledged ? 'Back home' : 'Pledge today'
                  }
                  onPress={handlePledgeAndHome}
                  loading={pledging}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skelBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  skelCenter: { alignSelf: 'center' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  grabberZone: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typeScale.title3, textAlign: 'center' },
  body: { ...typeScale.body, textAlign: 'center' },
  label: { ...typeScale.footnote, textAlign: 'center' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { ...typeScale.subhead },
  cta: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  longestRow: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  longestValue: { ...typeScale.headline, textAlign: 'center' },
});
