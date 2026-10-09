/**
 * Skeleton — pulsing placeholder blocks for async views with known layout.
 *
 * Skeletons where the layout is known, spinners only for indeterminate
 * waits. The pulse animates opacity only; under Reduce Motion the block is
 * static.
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Skeleton({ width, height, radius = radii.md, style, testID }: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.55 : opacity.value * 0.7,
  }));

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.surface,
        },
        pulse,
        style,
      ]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  block: {},
});
