/**
 * ProgressRing — monochrome progress ring, drawn from the top clockwise.
 *
 * Two-half technique (no SVG dependency): each half-container clips a
 * full-circle border to a semicircle and rotates to reveal the arc.
 * Progress changes travel on the standard spring; under Reduce Motion the
 * ring jumps to its value. Children render centered (e.g. a day count in
 * tabular numerals).
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { clamp01, ringAngles } from './logic';

interface ProgressRingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  /** Arc color. Defaults to the accent. */
  color?: string;
  /** Track color. Defaults to the hairline. */
  trackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ProgressRing({
  progress,
  size = 64,
  stroke = 6,
  color,
  trackColor,
  children,
  style,
  testID,
}: ProgressRingProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const arcColor = color ?? theme.colors.accent;
  const railColor = trackColor ?? theme.colors.hairline;

  const prog = useSharedValue(clamp01(progress));

  useEffect(() => {
    const p = clamp01(progress);
    prog.value = reduceMotion ? p : withSpring(p, motion.standard);
  }, [progress, prog, reduceMotion]);

  const angles = useDerivedValue(() => ringAngles(prog.value));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angles.value.right}deg` }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angles.value.left}deg` }],
  }));

  const radius = size / 2;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamp01(progress) * 100), min: 0, max: 100 }}
    >
      {/* Track */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: stroke,
            borderColor: railColor,
          },
        ]}
      />
      {/* Right half: reveals 0 → 50% */}
      <View style={[styles.half, { width: radius, height: size, left: radius }]}>
        <Animated.View
          style={[
            styles.arc,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: stroke,
              borderColor: arcColor,
              left: -radius,
            },
            rightStyle,
          ]}
        />
      </View>
      {/* Left half: reveals 50% → 100% */}
      <View style={[styles.half, { width: radius, height: size, left: 0 }]}>
        <Animated.View
          style={[
            styles.arc,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: stroke,
              borderColor: arcColor,
              left: 0,
            },
            leftStyle,
          ]}
        />
      </View>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', top: 0, left: 0 },
  half: { position: 'absolute', top: 0, overflow: 'hidden' },
  arc: { position: 'absolute', top: 0 },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
