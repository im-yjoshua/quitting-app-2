/**
 * CelebrationSheet — full-screen milestone celebration (spec §2.6).
 *
 * Fires ONCE per milestone (wired through hooks/useMilestoneCelebration):
 * the Orb bursts, "N days clean" lands, haptic fanfare plays, and the
 * user can share the moment or continue. Glass everywhere, per HIG.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Orb } from './Orb';
import { GlassButton } from './glass/GlassButton';
import { GlassSurface } from './glass/GlassSurface';
import { colors, radii, spacing, type } from '../theme/tokens';

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
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <GlassSurface
          style={styles.sheet}
          glassEffectStyle="clear"
          fallbackIntensity={90}
        >
          <View style={styles.inner}>
            <Text style={styles.kicker}>MILESTONE</Text>
            <Orb cleanDays={milestone} size={190} />
            <Text style={styles.headline}>{milestoneLabel(milestone)}</Text>
            <Text style={styles.sub}>
              You earned every one of these days.{'\n'}Nobody can take them
              from you.
            </Text>
            <GlassButton title="Share this moment" onPress={onShare} />
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={styles.dismiss}
            >
              <Text style={styles.dismissText}>Continue</Text>
            </Pressable>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,16,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  inner: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    ...type.caption,
    color: colors.accent,
    letterSpacing: 4,
  },
  headline: {
    ...type.hero,
    color: colors.text,
    textAlign: 'center',
  },
  sub: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  dismiss: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dismissText: {
    ...type.body,
    color: colors.textSecondary,
  },
});
