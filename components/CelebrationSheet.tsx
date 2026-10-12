/**
 * CelebrationSheet — Stitch milestone celebration (Phase 7).
 *
 * Fires ONCE per milestone (wired through hooks/useMilestoneCelebration).
 * The reference: violet ring + big number, tier pill, headline + honest
 * milestone copy, three stat chips (all real data), white
 * "Share Milestone Proof →" pill, "Keep Building in Silence" dismiss.
 *
 * Honesty: the reference's tier pill ("TIER 1 · NEURAL AWAKENING") and
 * medical copy ("prefrontal cortex density +14%", "dopamine baseline
 * normalizing") are Stitch hallucinations (plan §3.3). The pill is the
 * milestone's real position in the timeline ("Milestone 5 of 9"); the
 * copy comes from the real per-category health timeline
 * (services/healthTimeline.ts) — the same source as Stats.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InvertedButton } from './ui/InvertedButton';
import { ProgressRing } from './ui/ProgressRing';
import { Sheet } from './ui/Sheet';
import { MS_PER_DAY } from '../services/chronometerEngine';
import { healthTimelineFor } from '../services/healthTimeline';
import { MILESTONES } from '../services/milestones';
import { formatMoney } from '../services/savings';
import type { QuitCategory } from '../types/app';
import { radii, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface CelebrationSheetProps {
  visible: boolean;
  /** Milestone day-count being celebrated. */
  milestone: number;
  /** Focus habit — picks the honest milestone copy. */
  category: QuitCategory;
  /** Completed urge-surf sessions (real). */
  urgesTotal: number;
  /** Dollars saved (real, via services/savings). */
  capitalSaved: number;
  /** Time reclaimed (real, via services/savings). */
  timeReclaimed: { hours: number; minutes: number };
  onShare: () => void;
  onDismiss: () => void;
}

/** Honest headline/body: the latest health-timeline entry at/before the milestone. */
function milestoneStory(
  category: QuitCategory,
  milestoneDays: number
): { label: string; detail: string } {
  const hits = healthTimelineFor(category).filter(
    (h) => h.atMs <= milestoneDays * MS_PER_DAY
  );
  const hit = hits[hits.length - 1];
  if (hit) return { label: hit.label, detail: hit.detail };
  return {
    label: `${milestoneDays} days clean`,
    detail: 'Every day counts. This one is yours.',
  };
}

function milestoneIndex(milestone: number): number {
  const idx = MILESTONES.indexOf(milestone);
  return idx === -1 ? 0 : idx;
}

export function CelebrationSheet({
  visible,
  milestone,
  category,
  urgesTotal,
  capitalSaved,
  timeReclaimed,
  onShare,
  onDismiss,
}: CelebrationSheetProps) {
  const theme = useTheme();
  const c = theme.colors;

  useEffect(() => {
    if (!visible) return;
    // Haptic fanfare: success chord, then two rising ticks.
    let cancelled = false;
    (async () => {
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        await new Promise((r) => setTimeout(r, 220));
        if (cancelled) return;
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise((r) => setTimeout(r, 220));
        if (cancelled) return;
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Haptics are best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, milestone]);

  const story = milestoneStory(category, milestone);
  const position = milestoneIndex(milestone) + 1;

  return (
    <Sheet visible={visible} onClose={onDismiss} testID="celebration-sheet">
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss milestone"
            onPress={onDismiss}
            style={[styles.close, { backgroundColor: c.surfaceDeep }]}
          >
            <SymbolView
              name="xmark"
              tintColor={c.metadata}
              style={styles.closeIcon}
            />
          </Pressable>
        </View>

        <View style={styles.ringWrap}>
          <ProgressRing
            progress={1}
            size={192}
            stroke={10}
            color={c.accent}
            testID="celebration-ring"
          >
            <View style={styles.ringInner}>
              <View
                style={[
                  styles.tierPill,
                  { backgroundColor: c.surfaceDeep },
                ]}
                accessibilityRole="text"
                accessibilityLabel={`Milestone ${position} of ${MILESTONES.length}`}
              >
                <SymbolView
                  name="medal.fill"
                  tintColor={c.success}
                  style={styles.tierIcon}
                />
                <Text style={[styles.tierText, { color: c.accent }]}>
                  Milestone {position} of {MILESTONES.length}
                </Text>
              </View>
              <Text
                style={[styles.number, { color: c.text }, styles.tabular]}
              >
                {milestone}
              </Text>
              <Text style={[styles.unit, { color: c.metadata }]}>
                Days Clean
              </Text>
            </View>
          </ProgressRing>
        </View>

        <View style={styles.story}>
          <Text style={[styles.headline, { color: c.text }]}>
            {story.label}.
          </Text>
          <Text style={[styles.body, { color: c.metadata }]}>
            {story.detail} You are the master of your attention.
          </Text>
        </View>

        <View style={styles.chips}>
          <View
            style={[styles.chip, { backgroundColor: c.surface }]}
            accessibilityRole="text"
            accessibilityLabel={`Urges defeated: ${urgesTotal}`}
          >
            <Text style={[styles.chipLabel, { color: c.metadata }]}>
              Urges Defeated
            </Text>
            <Text style={[styles.chipValue, { color: c.text }]}>
              {urgesTotal}
            </Text>
          </View>
          <View
            style={[styles.chip, { backgroundColor: c.surface }]}
            accessibilityRole="text"
            accessibilityLabel={`Capital saved: ${formatMoney(capitalSaved)}`}
          >
            <Text style={[styles.chipLabel, { color: c.metadata }]}>
              Capital Saved
            </Text>
            <Text style={[styles.chipValue, { color: c.success }]}>
              {formatMoney(capitalSaved).replace(/\.00$/, '')}
            </Text>
          </View>
          <View
            style={[styles.chip, { backgroundColor: c.surface }]}
            accessibilityRole="text"
            accessibilityLabel={`Time restored: ${timeReclaimed.hours} hours`}
          >
            <Text style={[styles.chipLabel, { color: c.metadata }]}>
              Time Restored
            </Text>
            <Text style={[styles.chipValue, { color: c.text }]}>
              {timeReclaimed.hours} hrs
            </Text>
          </View>
        </View>

        <InvertedButton
          title="Share Milestone Proof →"
          onPress={onShare}
          testID="celebration-share"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep building in silence"
          onPress={onDismiss}
          style={styles.quiet}
        >
          <Text style={[styles.quietText, { color: c.metadata }]}>
            Keep Building in Silence
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topSpacer: { width: 44 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 18, height: 18 },
  ringWrap: { marginVertical: spacing.xs },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
  },
  tierIcon: { width: 12, height: 12 },
  tierText: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  number: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 60,
  },
  unit: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  story: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  headline: { ...type.title2, textAlign: 'center' },
  body: { ...type.subhead, textAlign: 'center', lineHeight: 22 },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 2,
    minHeight: 64,
    justifyContent: 'center',
  },
  chipLabel: { ...type.caption },
  chipValue: { ...type.headline, fontWeight: '700' },
  quiet: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  quietText: { ...type.headline },
  tabular: { ...type.tabular },
});
