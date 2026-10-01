/**
 * GlassButton — primary call-to-action rendered as interactive glass.
 *
 * Uses `isInteractive` GlassView on iOS 26+ for the native pressable-glass
 * feel; BlurView + Pressable elsewhere. Haptic tick on press.
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

import { colors, radii, spacing, type } from '../../theme/tokens';
import { GlassSurface } from './GlassSurface';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Accent-tinted glass for the primary action, neutral for secondary. */
  tone?: 'accent' | 'neutral';
}

export function GlassButton({
  title,
  onPress,
  style,
  disabled = false,
  tone = 'accent',
}: GlassButtonProps) {
  // Tasteful press micro-interaction: a quick spring scale on top of the
  // existing haptic + opacity feedback. Skipped when disabled. Uses the
  // built-in Animated API (method calls only — the shared-value assignment
  // form trips the react-hooks/immutability lint rule).
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePress = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const springTo = (toValue: number) => {
    Animated.spring(scaleAnim, {
      toValue,
      useNativeDriver: true,
      stiffness: 380,
      damping: 16,
    }).start();
  };
  const pressIn = () => {
    if (!disabled) springTo(0.96);
  };
  const pressOut = () => {
    springTo(1);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <GlassSurface
        style={[styles.pill, tone === 'accent' && styles.pillAccent, style]}
        glassEffectStyle="clear"
        interactive
        tintColor={tone === 'accent' ? colors.accent : undefined}
        fallbackIntensity={80}
      >
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={handlePress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={({ pressed }) => [
            styles.pressable,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.title}>{title}</Text>
        </Pressable>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  pillAccent: {
    // The tintColor on GlassView handles iOS 26+; the fallback gets a wash.
    backgroundColor: colors.accentSoft,
  },
  pressable: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  title: {
    ...type.body,
    fontWeight: '600',
    color: colors.text,
  },
});
