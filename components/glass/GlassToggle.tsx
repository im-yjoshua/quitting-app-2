/**
 * GlassToggle — a glass settings toggle (the motion_conquest CONTROL scene).
 *
 * Frosted pill track; the knob slides between off/on positions. Knob motion
 * animation lands with the Day-2 motion pass — the layout contract is final.
 */
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme/tokens';
import { GlassSurface } from './GlassSurface';

interface GlassToggleProps {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Small explanatory line under the label. */
  hint?: string;
}

export function GlassToggle({ label, value, onValueChange, hint }: GlassToggleProps) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <GlassSurface
        style={[styles.track, value && styles.trackOn]}
        glassEffectStyle="clear"
        fallbackIntensity={70}
      >
        <View style={styles.trackInner}>
          <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const TRACK_W = 52;
const KNOB = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
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
    color: colors.text,
  },
  hint: {
    ...type.callout,
    color: colors.textTertiary,
    marginTop: 2,
  },
  track: {
    width: TRACK_W,
    height: KNOB + 6,
    borderRadius: radii.pill,
  },
  trackOn: {
    backgroundColor: colors.accentSoft,
  },
  trackInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.text,
  },
  knobOff: {
    alignSelf: 'center',
  },
  knobOn: {
    marginLeft: 'auto',
    backgroundColor: colors.accent,
  },
});
