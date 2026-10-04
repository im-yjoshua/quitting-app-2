/**
 * Skeleton — pulsing placeholder blocks for async views with known layout.
 *
 * Skeletons where the layout is known, spinners only for indeterminate
 * waits. Pure theme colors; the pulse animates opacity only.
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface SkeletonProps {
  /** Block size. */
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value * 0.6 }));

  return (
    <Animated.View
      style={[
        styles.block,
        pulse,
        {
          width,
          height,
          borderRadius: radius ?? radii.md,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {},
});
