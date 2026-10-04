/**
 * CelebrationSheet — full-screen milestone celebration (spec §2.6).
 *
 * Fires ONCE per milestone (wired through hooks/useMilestoneCelebration):
 * the Orb bursts, "N days clean" lands, haptic fanfare plays, and the
 * user can share the moment or continue.
 *
 * Monochrome reskin: the Sheet primitive (glass, spring, grabber), the Orb
 * carrying the color, full-brightness type, inverted Share primary.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Orb } from './Orb';
import { GlassButton } from './glass/GlassButton';
import { Sheet } from './glass/Sheet';
import { spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface CelebrationSheetProps {
  visible: boolean;
  /** Milestone day-count being celebrated. */
  milestone: number;
  onShare: () => void;
  onDismiss: () => void;
}

function milestoneLabel(days: number): string {
  if (days === 365) return 'One full year clean';
  if (days === 1) return '1 day clean';
  return `${days} days clean`;
}

export function CelebrationSheet({
  visible,
  milestone,
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

  return (
    <Sheet visible={visible} onClose={onDismiss} dismissLabel="Continue">
      <View style={styles.inner}>
        <Text style={[styles.kicker, { color: c.metadata }]}>MILESTONE</Text>
        <Orb cleanDays={milestone} size={190} />
        <Text style={[styles.headline, { color: c.text }]}>
          {milestoneLabel(milestone)}
        </Text>
        <Text style={[styles.sub, { color: c.text }]}>
          You earned every one of these days.{'\n'}Nobody can take them
          from you.
        </Text>
        <View style={styles.actions}>
          <GlassButton title="Share this moment" onPress={onShare} />
          <GlassButton title="Continue" onPress={onDismiss} variant="secondary" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    ...type.caption,
    letterSpacing: 4,
  },
  headline: {
    ...type.largeTitle,
    textAlign: 'center',
  },
  sub: {
    ...type.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
});
