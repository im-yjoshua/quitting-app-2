/**
 * GhostButton — the quiet secondary action.
 *
 * Hairline outline, transparent fill, full-brightness label. For actions
 * that shouldn't shout ("I pledge today" before pledging, "Not now").
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

interface GhostButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function GhostButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
}: GhostButtonProps) {
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
          { borderColor: theme.colors.hairline },
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
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typeScale.headline },
  inactive: { opacity: 0.35 },
});
