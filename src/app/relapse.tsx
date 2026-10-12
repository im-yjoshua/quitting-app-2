/**
 * Relapse flow — Stitch v4 rebuild (bottom-sheet presentation, plan §2.4).
 *
 * Two phases:
 * 1. Sheet: "This doesn't erase your progress." Calm, no red, no warnings.
 *    Lotus mark, real previous-streak days + real clean-rate-this-month,
 *    optional multi-select trigger chips, optional private note.
 *    "Begin Again Today →" applies the reset (the v2 contract:
 *    logRelapse(note) → applyRelapse + persistence). "I held strong"
 *    dismisses WITHOUT resetting — there is no close-call logging
 *    feature (plan §3.8).
 * 2. Day 0 ritual: honors the last streak, then the day-1 pledge CTA
 *    (pledgeNow() before heading home).
 *
 * Honesty adaptations: the sheet title is corrected ("Relapse Reflection" —
 * Stitch mislabeled it "New Entry", plan §3.9); the body uses real days
 * instead of Stitch's "rewired your brain" claim; the support row opens
 * mail only once SUPPORT_EMAIL is wired (constants.ts), otherwise it says
 * so plainly instead of dead-ending.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SUPPORT_EMAIL } from '../../constants';
import { GhostButton } from '../../components/ui/GhostButton';
import { InvertedButton } from '../../components/ui/InvertedButton';
import { Screen } from '../../components/ui/Screen';
import { Skeleton } from '../../components/ui/Skeleton';
import { MS_PER_DAY } from '../../services/chronometerEngine';
import { daysCleanBefore } from '../../services/relapse';
import { useAppState } from '../../state/AppStateContext';
import type { RelapseEntry } from '../../types/app';
import { radii, spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const TRIGGERS = [
  'Stress',
  'Social gathering',
  'Boredom',
  'Late night',
  'Alcohol',
  'Habit loop',
  'Other',
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

/**
 * Clean rate for the current calendar month, over days actually tracked.
 * Presentation math over real state (no service changes): days tracked =
 * from the later of (month start, quit start) to now; a day counts as
 * unclean when a relapse entry landed on it. Returns 0–100.
 */
function cleanRateThisMonth(
  nowMs: number,
  quitStartIso: string,
  relapseLog: RelapseEntry[]
): number {
  const now = new Date(nowMs);
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getTime();
  const quitStart = Date.parse(quitStartIso);
  const trackedStart = Math.max(monthStart, quitStart);
  if (!Number.isFinite(trackedStart) || trackedStart > nowMs) return 100;
  const daysTracked = Math.max(
    1,
    Math.floor((nowMs - trackedStart) / MS_PER_DAY) + 1
  );
  const relapseDays = new Set<number>();
  for (const entry of relapseLog) {
    const t = Date.parse(entry.date);
    if (!Number.isFinite(t) || t < trackedStart || t > nowMs) continue;
    const d = new Date(t);
    relapseDays.add(d.getFullYear() * 100000 + d.getMonth() * 100 + d.getDate());
  }
  const clean = Math.max(0, daysTracked - relapseDays.size);
  return Math.round((clean / daysTracked) * 100);
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

function TriggerChips({
  selected,
  onToggle,
}: {
  selected: Trigger[];
  onToggle: (t: Trigger) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
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
                borderColor: isSelected ? c.accentDeep : c.hairline,
                backgroundColor: isSelected ? c.accentDeep : 'transparent',
              },
            ]}
          >
            {isSelected ? (
              <Icon
                ios="checkmark"
                android="check"
                size={14}
                color={c.onAccent}
                weight="bold"
              />
            ) : null}
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? c.onAccent : c.metadata },
              ]}
            >
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
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { state, loading, logRelapse, pledgeNow, pledgedToday } = useAppState();
  const [phase, setPhase] = useState<'sheet' | 'day0'>('sheet');
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [noteText, setNoteText] = useState('');
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
                backgroundColor: c.surface,
                borderColor: c.hairline,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <View style={styles.grabberZone}>
              <View
                style={[styles.grabber, { backgroundColor: c.metadata }]}
              />
            </View>
            <View style={styles.skelBody}>
              <Skeleton width={64} height={64} radius={32} style={styles.skelCenter} />
              <Skeleton width="70%" height={24} style={styles.skelCenter} />
              <Skeleton width="88%" height={18} style={styles.skelCenter} />
              <Skeleton width="100%" height={72} radius={radii.lg} />
              <Skeleton width="100%" height={50} radius={radii.pill} />
              <Skeleton width="100%" height={50} radius={radii.pill} />
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
  // eslint-disable-next-line react-hooks/purity
  const cleanRate = cleanRateThisMonth(Date.now(), quit.startDate, state.relapseLog);

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
      const parts: string[] = [];
      if (triggers.length > 0) parts.push(triggers.join(', '));
      const trimmed = noteText.trim();
      if (trimmed.length > 0) parts.push(trimmed);
      const note = parts.length > 0 ? parts.join(' — ') : undefined;
      const entry = await logRelapse(note);
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

  const handleSupport = () => {
    if (SUPPORT_EMAIL.length > 0) {
      void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
      return;
    }
    Alert.alert(
      'Support',
      'Talk to support is wired up at launch. Your progress stays on this device.'
    );
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header — corrected title (Stitch mislabeled it "New Entry") */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.headerHit}
            hitSlop={8}
          >
            <Icon
              ios="chevron.left"
              android="arrow_back"
              size={22}
              color={c.text}
              weight="semibold"
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
            Relapse Reflection
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            onPress={() => router.push('/you')}
            style={styles.headerHit}
          >
            <View style={[styles.avatar, { backgroundColor: c.accent }]}>
              <Icon
                ios="person.fill"
                android="person"
                size={18}
                color={c.onAccent}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.backdrop}>
          <View
            style={[
              styles.panel,
              {
                backgroundColor: c.surface,
                borderColor: c.hairline,
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
                style={[styles.grabber, { backgroundColor: c.metadata }]}
              />
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {phase === 'sheet' ? (
                <>
                  {/* Lotus mark */}
                  <View
                    style={[
                      styles.lotus,
                      {
                        backgroundColor: c.surfaceDeep,
                        borderColor: c.hairline,
                      },
                    ]}
                    accessibilityRole="image"
                    accessibilityLabel="Lotus, a symbol of starting again"
                  >
                    <Icon
                      ios="leaf.fill"
                      android="spa"
                      size={28}
                      color={c.accent}
                    />
                  </View>
                  <Text style={[styles.title, { color: c.text }]}>
                    This doesn’t erase your progress.
                  </Text>
                  <Text style={[styles.body, { color: c.metadata }]}>
                    Recovery is not a straight line. {daysLine(days)}
                  </Text>

                  {/* Previous streak card — real days + real clean rate */}
                  <View
                    style={[
                      styles.streakCard,
                      {
                        backgroundColor: c.surfaceDeep,
                        borderColor: c.hairline,
                      },
                    ]}
                    accessibilityRole="text"
                    accessibilityLabel={`Previous streak ${days} days, ${cleanRate} percent clean rate this month, retained`}
                  >
                    <View style={styles.streakLeft}>
                      <View
                        style={[
                          styles.streakIcon,
                          { backgroundColor: c.surface },
                        ]}
                      >
                        <Icon
                          ios="checkmark.circle.fill"
                          android="check_circle"
                          size={16}
                          color={c.success}
                        />
                      </View>
                      <View style={styles.streakText}>
                        <Text style={[styles.streakTitle, { color: c.text }]}>
                          Previous Streak: {days} Day{days === 1 ? '' : 's'}
                        </Text>
                        <Text style={[styles.streakSub, { color: c.metadata }]}>
                          {cleanRate}% clean rate this month
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.retainedPill,
                        { backgroundColor: c.success },
                      ]}
                    >
                      <Text
                        style={[
                          styles.retainedText,
                          { color: c.background },
                        ]}
                      >
                        Retained
                      </Text>
                    </View>
                  </View>

                  <View style={styles.triggerHead}>
                    <Text
                      style={[styles.triggerLabel, { color: c.metadata }]}
                    >
                      WHAT TRIGGERED IT?
                    </Text>
                    <Text
                      style={[styles.triggerHint, { color: c.metadata }]}
                    >
                      Select all that apply
                    </Text>
                  </View>
                  <TriggerChips selected={triggers} onToggle={toggleTrigger} />

                  <TextInput
                    style={[
                      styles.note,
                      {
                        backgroundColor: c.surfaceDeep,
                        borderColor: c.hairline,
                        color: c.text,
                      },
                    ]}
                    placeholder="Note what happened (optional, for your eyes only)"
                    placeholderTextColor={c.muted}
                    multiline
                    value={noteText}
                    onChangeText={setNoteText}
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                    accessibilityLabel="Optional note, private to this device"
                  />

                  <View style={styles.cta}>
                    <InvertedButton
                      title={
                        confirming ? 'Logging…' : 'Begin Again Today →'
                      }
                      onPress={handleBeginAgain}
                      loading={confirming}
                      accessibilityLabel="Begin again today. Resets the streak"
                    />
                    <GhostButton
                      title="I held strong"
                      onPress={() => router.back()}
                      accessibilityLabel="I held strong. Dismiss without resetting"
                    />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Talk to support"
                    onPress={handleSupport}
                    style={styles.support}
                  >
                    <Icon
                      ios="book"
                      android="menu_book"
                      size={16}
                      color={c.metadata}
                    />
                    <Text style={[styles.supportText, { color: c.metadata }]}>
                      Talk to support / Read recovery guide
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    Day 1 starts now.
                  </Text>
                  <Text style={[styles.body, { color: c.metadata }]}>
                    {loggedDays > 0
                      ? `${loggedDays} days proved you can do this.`
                      : 'Every beginning counts. This is yours.'}
                  </Text>
                  <View
                    style={[
                      styles.longestRow,
                      { borderTopColor: c.hairline },
                    ]}
                  >
                    <Text
                      style={[styles.triggerLabel, { color: c.metadata }]}
                    >
                      LONGEST STREAK
                    </Text>
                    <Text
                      style={[styles.longestValue, { color: c.text }]}
                    >
                      {longestAfter} day{longestAfter === 1 ? '' : 's'} —
                      you’ll beat it.
                    </Text>
                  </View>
                  <View style={styles.cta}>
                    <InvertedButton
                      title={
                        pledging
                          ? 'Pledging…'
                          : pledged
                            ? 'Back home'
                            : 'Pledge today'
                      }
                      onPress={handlePledgeAndHome}
                      loading={pledging}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skelBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  skelCenter: { alignSelf: 'center' },
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    maxHeight: '92%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
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
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  lotus: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  title: { ...typeScale.title2, textAlign: 'center' },
  body: { ...typeScale.body, textAlign: 'center' },
  streakCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: {
    flex: 1,
    gap: 2,
  },
  streakTitle: {
    ...typeScale.subhead,
    fontWeight: '600',
  },
  streakSub: { ...typeScale.footnote },
  retainedPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retainedText: {
    ...typeScale.caption,
    fontWeight: '600',
  },
  triggerHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  triggerLabel: {
    ...typeScale.footnote,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  triggerHint: { ...typeScale.footnote },
  chips: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  chipText: {
    ...typeScale.subhead,
    fontWeight: '500',
  },
  note: {
    width: '100%',
    minHeight: 76,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.subhead,
  },
  cta: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  support: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  supportText: {
    ...typeScale.footnote,
    fontWeight: '500',
  },
  longestRow: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  longestValue: { ...typeScale.headline, textAlign: 'center' },
});
