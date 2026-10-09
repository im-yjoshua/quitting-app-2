/**
 * InvertedButton — the full-width primary action.
 *
 * Inverted monochrome fill (white/black on dark, black/white on light) —
 * never the accent. This is the highest-contrast element on screen, which
 * is what a primary action should be. 50pt tall, radius 12, Semibold label.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { radii, spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { pressInScale, pressOutScale, usePressAnimation } from './usePressAnimation';

interface InvertedButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function InvertedButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
}: InvertedButtonProps) {
  const theme = useTheme();
  const { animatedStyle, scale, reduceMotion } = usePressAnimation();
  const inactive = disabled || loading;
  const labelColor = theme.colors.background; // content on the inverted fill

  return (
    <Animated.View style={[animatedStyle, inactive && styles.inactive]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => pressInScale(scale, reduceMotion)}
        onPressOut={() => pressOutScale(scale, reduceMotion)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={[
          styles.button,
          { backgroundColor: theme.colors.inverted },
          style,
        ]}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <Text style={[styles.label, { color: labelColor }]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typeScale.headline },
  inactive: { opacity: 0.35 },
});
