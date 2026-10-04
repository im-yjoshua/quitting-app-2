/**
 * GlassButton — the app's call-to-action.
 *
 * Monochrome law: full-width primaries are INVERTED fills (white fill/black
 * text on dark, black fill/white text on light) — never violet, never glass.
 * Secondary actions get a subtle glass surface. Press = 0.97 spring scale +
 * haptic at animation start. 44pt+ target, 4/8 grid, standard radius.
 */
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { motion, radii, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { GlassSurface } from './GlassSurface';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** primary = inverted fill · secondary = subtle glass. */
  variant?: 'primary' | 'secondary';
  /**
   * @deprecated use `variant` instead. tone="neutral" maps to
   * secondary, tone="accent" maps to primary.
   */
  tone?: 'accent' | 'neutral';
}

export function GlassButton({
  title,
  onPress,
  style,
  disabled = false,
  variant,
  tone,
}: GlassButtonProps) {
  const theme = useTheme();
  const resolved: 'primary' | 'secondary' =
    variant ?? (tone === 'neutral' ? 'secondary' : 'primary');

  // Press micro-interaction: quick spring scale + haptic at animation start.
  // Uses the built-in Animated API (the shared-value assignment form trips
  // the react-hooks/immutability lint rule).
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePress = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const pressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: motion.pressScale,
        useNativeDriver: true,
        ...motion.press,
      }).start();
    }
  };
  const pressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...motion.press,
    }).start();
  };

  const label = (
    <Text
      style={[
        styles.title,
        {
          color:
            resolved === 'primary' ? theme.colors.background : theme.colors.text,
        },
      ]}
    >
      {title}
    </Text>
  );

  const pressable = (inner: React.ReactNode) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={({ pressed }) => [
        styles.pressable,
        resolved === 'primary' && {
          backgroundColor: theme.colors.inverted,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {inner}
    </Pressable>
  );

  // Inverted fill is the highest-contrast element on screen — exactly what a
  // primary action should be. No violet, no glass.
  if (resolved === 'primary') {
    return (
      <Animated.View style={[styles.host, { transform: [{ scale: scaleAnim }] }, style]}>
        {pressable(label)}
      </Animated.View>
    );
  }

  // Secondary: subtle glass, full-brightness text.
  return (
    <Animated.View style={[styles.host, { transform: [{ scale: scaleAnim }] }, style]}>
      <GlassSurface style={styles.secondary} fallbackIntensity={60}>
        {pressable(label)}
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  pressable: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  secondary: {
    borderRadius: radii.md,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  title: {
    ...type.headline,
  },
});
