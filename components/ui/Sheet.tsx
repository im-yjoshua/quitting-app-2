/**
 * Sheet — bottom sheet for self-contained tasks (relapse flow, composers).
 *
 * Grabber visible, 1:1 drag-to-dismiss with spring settle, backdrop tap to
 * dismiss, system-spring entrance. Under Reduce Motion the sheet cross-fades
 * instead of sliding (drag release still settles, just without travel).
 *
 * Imperative drivers (dismiss animation, PanResponder) live in effects:
 * Reanimated shared values are designed-mutable and must not be written
 * from render-phase closures.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  PanResponder,
  PanResponderInstance,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Backdrop tap dismisses. Default true. */
  dismissable?: boolean;
  testID?: string;
}

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
/** Backdrop settles at 40% black — context stays visible behind the sheet. */
const BACKDROP_OPACITY = 0.4;

interface DismissArgs {
  offset: SharedValue<number>;
  backdrop: SharedValue<number>;
  /** Measured panel height; falls back to the screen height. */
  panelHeight: number;
  onClose: () => void;
  reduceMotion: boolean;
}

/** Animate the sheet out, then hand control back to the parent. */
function dismissSheet({ offset, backdrop, panelHeight, onClose, reduceMotion }: DismissArgs): void {
  const height = panelHeight || Dimensions.get('window').height;
  if (reduceMotion) {
    backdrop.value = withTiming(0, { duration: 150 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  } else {
    backdrop.value = withTiming(0, { duration: 180 });
    offset.value = withTiming(height, { duration: 220 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  }
}

export function Sheet({ visible, onClose, children, dismissable = true, testID }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const offset = useSharedValue(Dimensions.get('window').height);
  const backdropOpacity = useSharedValue(0);
  const panelHeight = useRef(0);
  const closing = useRef(false);
  const [controls, setControls] = useState<{
    dismiss: () => void;
    panHandlers: PanResponderInstance['panHandlers'];
  } | null>(null);

  // Entrance: spring up on mount; cross-fade under Reduce Motion.
  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      backdropOpacity.value = withTiming(BACKDROP_OPACITY, { duration: 150 });
    } else {
      offset.value = withSpring(0, motion.standard);
      backdropOpacity.value = withTiming(BACKDROP_OPACITY, { duration: 200 });
    }
  }, [backdropOpacity, offset, reduceMotion]);

  // Imperative controls live in an effect: PanResponder callbacks and the
  // dismiss driver write shared values, which is effect-phase, not
  // render-phase.
  useEffect(() => {
    const dismiss = () => {
      if (closing.current) return;
      closing.current = true;
      dismissSheet({
        offset,
        backdrop: backdropOpacity,
        panelHeight: panelHeight.current,
        onClose,
        reduceMotion,
      });
    };
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gesture) => gesture.dy > 4,
      onPanResponderMove: (_e, gesture) => {
        // 1:1 finger tracking — never upward past rest.
        offset.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_e, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          dismiss();
        } else if (reduceMotion) {
          offset.value = withTiming(0, { duration: 150 });
        } else {
          offset.value = withSpring(0, motion.standard);
        }
      },
    });
    setControls({ dismiss, panHandlers: responder.panHandlers });
  }, [backdropOpacity, offset, onClose, reduceMotion]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible
      onRequestClose={() => controls?.dismiss()}
      testID={testID}
    >
      <View style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => {
            if (dismissable) controls?.dismiss();
          }}
          style={styles.fill}
        >
          <Animated.View
            style={[styles.backdrop, { backgroundColor: theme.colors.shadow }, backdropStyle]}
          />
        </Pressable>
        <Animated.View
          onLayout={(e) => {
            panelHeight.current = e.nativeEvent.layout.height;
          }}
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.hairline,
              paddingBottom: insets.bottom + spacing.md,
            },
            panelStyle,
          ]}
        >
          {/* Grabber zone — 44pt tall, drags 1:1. */}
          <View {...controls?.panHandlers} style={styles.grabberZone}>
            <View
              style={[styles.grabber, { backgroundColor: theme.colors.metadata }]}
            />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
});
