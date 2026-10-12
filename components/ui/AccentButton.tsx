/**
 * AccentButton — the violet primary action (Stitch).
 *
 * Solid accentDeep fill, full-brightness label, FULLY ROUNDED pill — the
 * reference's violet CTA ("Continue →" on habit select, "Save Commitment
 * Window"). For the white pill CTA use InvertedButton. 50pt tall,
 * Semibold label, 44pt minimum touch target.
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

interface AccentButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function AccentButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
}: AccentButtonProps) {
  const theme = useTheme();
  const { animatedStyle, scale, reduceMotion } = usePressAnimation();
  const inactive = disabled || loading;

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
          { backgroundColor: theme.colors.accentDeep },
          style,
        ]}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {title}
          </Text>
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
