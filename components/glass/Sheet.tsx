/**
 * Sheet — system-style bottom sheet.
 *
 * Springs up from the bottom (Reanimated, interruptible); backdrop fades in
 * and dismisses on tap. The sheet body is a glass surface (one of the four
 * sanctioned glass homes: tab bar, sheets, the Orb, floating overlays).
 * Honors Reduce Motion: cross-fade instead of slide.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { GlassSurface } from './GlassSurface';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessibility label for the dismiss backdrop. */
  dismissLabel?: string;
}

export function Sheet({
  visible,
  onClose,
  children,
  dismissLabel = 'Dismiss',
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [rendered, setRendered] = useState(visible);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);
  // Reduce Motion: the panel cross-fades (opacity) instead of sliding.
  const panelOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Keep the modal mounted until the exit animation finishes: this is
      // React state synced with the (external) animation system, which is
      // what effects are for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      backdrop.value = withTiming(1, { duration: 200 });
      if (reduceMotion) {
        translateY.value = 0; // no travel — cross-fade only
        panelOpacity.value = withTiming(1, { duration: 200 });
      } else {
        panelOpacity.value = 1;
        translateY.value = withSpring(0, motion.standard);
      }
    } else if (rendered) {
      backdrop.value = withTiming(0, { duration: 180 });
      const done = (finished?: boolean) => {
        if (finished) setRendered(false);
      };
      if (reduceMotion) {
        panelOpacity.value = withTiming(0, { duration: 180 }, done);
      } else {
        translateY.value = withTiming(height, { duration: 220 }, done);
      }
    }
    // `rendered` is read intentionally to avoid re-animating on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: panelOpacity.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  if (!rendered) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[styles.sheetHost, sheetStyle, { paddingBottom: insets.bottom }]}
        >
          <GlassSurface
            style={[
              styles.sheet,
              {
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
              },
            ]}
            fallbackIntensity={85}
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.colors.metadata },
              ]}
            />
            <View style={styles.content}>{children}</View>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetHost: {
    // The sheet itself; safe-area padding applied inline.
  },
  sheet: {
    overflow: 'hidden',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  content: {
    // Screen content goes here; bottom safe-area handled by sheetHost.
  },
});
