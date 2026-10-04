/**
 * Relapse flow — the churn firewall (spec §2.4).
 *
 * Two phases:
 * 1. Confirmation: "Log a slip? Your N days still count — your body healed
 *    for N days." + optional trigger note. Quiet styling — NEVER red/error,
 *    NEVER "failed" or identity-shaming copy.
 * 2. Compassion: longest streak preserved, "Day 1 again — and that's okay",
 *    immediate "Pledge today" CTA.
 *
 * The Orb dims honestly on return home via the existing radiance path —
 * startDate resets to now, so Home's orbRadiance(cleanDays) naturally
 * renders day 0 dim. No special-casing needed.
 *
 * Monochrome reskin: calm surface panel, full-brightness honest copy,
 * inverted primary CTA. No red anywhere.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { Screen } from '../../components/glass/Screen';
import { TextField } from '../../components/glass/TextField';
import { daysCleanBefore } from '../../services/relapse';
import { useAppState } from '../../state/AppStateContext';
import { radii, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

function daysLine(days: number): string {
  if (days <= 0) {
    return 'Today still counts — your body started healing today.';
  }
  if (days === 1) {
    return 'Your 1 day still counts — your body healed for 1 day.';
  }
  return `Your ${days} days still count — your body healed for ${days} days.`;
}

export default function RelapseScreen() {
  const theme = useTheme();
  const { state, loading, logRelapse, pledgeNow, pledgedToday } = useAppState();
  const [phase, setPhase] = useState<'confirm' | 'compassion'>('confirm');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loggedDays, setLoggedDays] = useState(0);
  const [longestAfter, setLongestAfter] = useState(0);
  const [pledging, setPledging] = useState(false);

  if (loading || !state) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
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

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const entry = await logRelapse(note);
      setLoggedDays(entry.daysCleanBefore);
      setLongestAfter(Math.max(quit.longestStreakDays, entry.daysCleanBefore));
      setPhase('compassion');
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
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      router.back();
    } finally {
      setPledging(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.wrap}>
          {phase === 'confirm' ? (
            <>
              <View
                style={[
                  styles.panel,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Log a slip?
                </Text>
                <Text style={[styles.sub, { color: theme.colors.text }]}>
                  {daysLine(days)}
                </Text>
                <TextField
                  label="What triggered it? (optional)"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Noticing the pattern helps future you. No judgment."
                  multiline
                  maxLength={280}
                  inputStyle={styles.noteInput}
                  style={styles.noteField}
                />
                <Text
                  style={[styles.privacy, { color: theme.colors.metadata }]}
                >
                  Only you ever see this.
                </Text>
              </View>
              <GlassButton
                title={confirming ? 'Logging…' : 'Log it — gently'}
                onPress={handleConfirm}
                disabled={confirming}
              />
              <GlassButton
                title="Not yet"
                onPress={() => router.back()}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <View
                style={[
                  styles.panel,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Day 1 again — and that’s okay.
                </Text>
                <Text style={[styles.sub, { color: theme.colors.text }]}>
                  {loggedDays > 0
                    ? `Those ${loggedDays} day${loggedDays === 1 ? '' : 's'} happened. Nobody can take them from you.`
                    : 'Every streak starts with a single day. This is yours.'}
                </Text>
                <View
                  style={[
                    styles.longestRow,
                    { borderTopColor: theme.colors.hairline },
                  ]}
                >
                  <Text
                    style={[
                      styles.longestLabel,
                      { color: theme.colors.metadata },
                    ]}
                  >
                    LONGEST STREAK
                  </Text>
                  <Text
                    style={[
                      styles.longestValue,
                      { color: theme.colors.text },
                    ]}
                  >
                    {longestAfter} day{longestAfter === 1 ? '' : 's'} — you’ll beat it.
                  </Text>
                </View>
              </View>
              <GlassButton
                title={pledging ? 'Pledging…' : pledged ? 'Back home' : 'Pledge today'}
                onPress={handlePledgeAndHome}
                disabled={pledging}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  title: { ...type.title1, marginBottom: spacing.sm },
  sub: { ...type.body, lineHeight: 24 },
  noteField: { marginTop: spacing.lg },
  noteInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  privacy: {
    ...type.caption,
    marginTop: spacing.sm,
  },
  longestRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  longestLabel: { ...type.caption, letterSpacing: 1.5 },
  longestValue: { ...type.headline, marginTop: spacing.xs },
});
