/**
 * InvertedButton — the full-width primary action (Stitch).
 *
 * Inverted fill (near-white #fafafa on dark, near-black on light) — the
 * reference's white pill CTA ("Continue →", "Begin Again Today →",
 * "I Made It Through"). This is the highest-contrast element on screen,
 * which is what a primary action should be. FULLY ROUNDED pill, 50pt
 * tall, Semibold label. For the violet CTA use AccentButton.
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
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typeScale.headline },
  inactive: { opacity: 0.35 },
});
