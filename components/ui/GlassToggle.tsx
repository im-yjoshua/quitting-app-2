/**
 * GlassToggle — a settings row with the NATIVE Switch.
 *
 * System components over custom ones: the hand-rolled glass knob is gone.
 * Native Switch, accent on-state, light haptic on change. 44pt row target.
 */
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface GlassToggleProps {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Small explanatory line under the label. */
  hint?: string;
}

export function GlassToggle({
  label,
  value,
  onValueChange,
  hint,
}: GlassToggleProps) {
  const theme = useTheme();

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: theme.colors.metadata }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(next);
        }}
        trackColor={{
          false: theme.colors.surface,
          true: theme.colors.accent,
        }}
        thumbColor={theme.colors.onAccent}
        ios_backgroundColor={theme.colors.surface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.8,
  },
  textWrap: {
    flex: 1,
    paddingRight: spacing.md,
  },
  label: {
    ...type.body,
  },
  hint: {
    ...type.subhead,
    marginTop: 2,
  },
});
