/**
 * PledgeConfirmationSheet — the Stitch pledge confirmation sheet (Phase 7).
 *
 * Shown right after a successful daily pledge: violet check mark, streak
 * pill, covenant quote card, white "Done →" pill. The reference's sheet
 * header was mislabeled "RELAPSE REFLECTION SHEET" (plan §3.9) — corrected
 * to "Pledge Confirmation". The "Signature Hash / Signed with FaceID" row
 * is dropped (plan §3.4 — we don't sign pledges); the honest footer is
 * "Recorded on this device."
 *
 * All values are real: streak count, the moment the pledge was recorded,
 * and the user's actual next-reminder time.
 */
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { InvertedButton } from './ui/InvertedButton';
import { Sheet } from './ui/Sheet';
import { formatPledgeTime12h } from '../services/pledgeTime';
import { radii, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface PledgeConfirmationSheetProps {
  visible: boolean;
  /** Consecutive pledge streak, after this pledge counted. */
  pledgeStreak: number;
  /** "HH:MM" 24h — the user's daily reminder time. */
  pledgeTime: string;
  /** Epoch ms when the pledge was recorded (for the validity row). */
  recordedAtMs: number;
  onClose: () => void;
}

function formatRecordedAt(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function streakLabel(streak: number): string {
  return streak === 1
    ? '1-day consecutive pledge streak'
    : `${streak}-day consecutive pledge streak`;
}

export function PledgeConfirmationSheet({
  visible,
  pledgeStreak,
  pledgeTime,
  recordedAtMs,
  onClose,
}: PledgeConfirmationSheetProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Sheet visible={visible} onClose={onClose} testID="pledge-confirmation-sheet">
      <View style={styles.inner}>
        {/* Corrected header (plan §3.9): the reference mislabeled this sheet. */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            Pledge Confirmation
          </Text>
        </View>

        {/* Hero: violet check. */}
        <View style={styles.hero}>
          <View
            style={[styles.checkBadge, { backgroundColor: c.accent }]}
            accessibilityRole="image"
            accessibilityLabel="Pledge recorded"
          >
            <SymbolView
              name="checkmark"
              tintColor={c.onAccent}
              style={styles.checkGlyph}
            />
          </View>
          <Text style={[styles.title, { color: c.text }]}>
            Pledge Recorded for Today
          </Text>
          <Text style={[styles.subtitle, { color: c.metadata }]}>
            Your 24-hour commitment is now active.
          </Text>
          <View
            style={[styles.streakPill, { backgroundColor: c.surfaceDeep }]}
            accessibilityRole="text"
            accessibilityLabel={streakLabel(pledgeStreak)}
          >
            <SymbolView
              name="flame.fill"
              tintColor={c.success}
              style={styles.pillIcon}
            />
            <Text style={[styles.streakText, { color: c.text }]}>
              {streakLabel(pledgeStreak)}
            </Text>
          </View>
        </View>

        {/* Summary card. */}
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.hairline },
          ]}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <View
                style={[styles.iconTile, { backgroundColor: c.surfaceDeep }]}
              >
                <SymbolView
                  name="clock.fill"
                  tintColor={c.metadata}
                  style={styles.tileIcon}
                />
              </View>
              <Text style={[styles.cardLabel, { color: c.metadata }]}>
                Validity Window
              </Text>
            </View>
            <Text style={[styles.cardValue, { color: c.success }]}>
              Recorded {formatRecordedAt(recordedAtMs)} · 24h
            </Text>
          </View>

          {/* Active covenant quote. */}
          <View
            style={[styles.quoteCard, { backgroundColor: c.surfaceDeep }]}
            accessibilityRole="text"
            accessibilityLabel="Active covenant: Today, I choose clarity over impulse. I do not negotiate with cravings."
          >
            <View style={styles.quoteHead}>
              <SymbolView
                name="quote.opening"
                tintColor={c.accent}
                style={styles.quoteIcon}
              />
              <Text style={[styles.quoteEyebrow, { color: c.accent }]}>
                Active Covenant
              </Text>
            </View>
            <Text style={[styles.quoteText, { color: c.text }]}>
              &ldquo;Today, I choose clarity over impulse. I do not negotiate
              with cravings.&rdquo;
            </Text>
          </View>

          {/* Honest footer (plan §3.4): no signature theater. */}
          <View style={styles.recordedRow}>
            <View
              style={[styles.recordedDot, { backgroundColor: c.success }]}
            />
            <Text style={[styles.recordedText, { color: c.metadata }]}>
              Recorded on this device.
            </Text>
          </View>
        </View>

        {/* Next reminder. */}
        <View
          style={[
            styles.reminderRow,
            { backgroundColor: c.surfaceDeep, borderColor: c.hairline },
          ]}
          accessibilityRole="text"
          accessibilityLabel={`Next pledge reminder tomorrow at ${formatPledgeTime12h(pledgeTime)}`}
        >
          <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
            <SymbolView
              name="bell.fill"
              tintColor={c.accent}
              style={styles.tileIcon}
            />
          </View>
          <View style={styles.reminderText}>
            <Text style={[styles.reminderTitle, { color: c.text }]}>
              Daily Reminder
            </Text>
            <Text style={[styles.reminderSub, { color: c.metadata }]}>
              Next prompt tomorrow at {formatPledgeTime12h(pledgeTime)}
            </Text>
          </View>
        </View>

        <InvertedButton
          title="Done →"
          onPress={onClose}
          style={styles.done}
          testID="pledge-confirmation-done"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  header: { alignItems: 'center', marginBottom: spacing.xs },
  headerTitle: {
    ...type.subhead,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hero: { alignItems: 'center', gap: spacing.sm },
  checkBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { width: 34, height: 34 },
  title: { ...type.title2, textAlign: 'center' },
  subtitle: { ...type.subhead, textAlign: 'center' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: 44,
  },
  pillIcon: { width: 16, height: 16 },
  streakText: { ...type.footnote, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIcon: { width: 16, height: 16 },
  cardLabel: { ...type.subhead },
  cardValue: { ...type.subhead, fontWeight: '600', flexShrink: 0 },
  quoteCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteIcon: { width: 14, height: 14 },
  quoteEyebrow: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  quoteText: { ...type.subhead, fontStyle: 'italic', lineHeight: 22 },
  recordedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recordedDot: { width: 8, height: 8, borderRadius: 4 },
  recordedText: { ...type.footnote },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { ...type.headline },
  reminderSub: { ...type.footnote },
  done: { marginTop: spacing.xs },
});
