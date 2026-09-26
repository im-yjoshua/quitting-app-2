/**
 * GlassToggle — a glass settings toggle.
 *
 * Frosted pill track; the knob slides between off/on positions on a
 * Reanimated shared value with `withSpring` — the whole animation runs on
 * the UI thread with no per-frame JS. The shared value is seeded from the
 * initial `value` prop so the knob never jumps on mount.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, radii, spacing, type } from '../../theme/tokens';
import { GlassSurface } from './GlassSurface';

interface GlassToggleProps {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Small explanatory line under the label. */
  hint?: string;
}

const TRACK_W = 52;
const TRACK_PAD = 3;
const KNOB = 26;
/** Knob travel: inner width minus knob diameter. */
const ON_X = TRACK_W - KNOB - TRACK_PAD * 2;

export function GlassToggle({ label, value, onValueChange, hint }: GlassToggleProps) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  // Seeded from the prop — no layout jump on mount. Later changes spring.
  const knobX = useSharedValue(value ? ON_X : 0);
  useEffect(() => {
    knobX.value = withSpring(value ? ON_X : 0, {
      damping: 20,
      stiffness: 320,
      mass: 0.8,
    });
  }, [value, knobX]);

  const knobAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }));

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
          <Animated.View
            style={[
              styles.knob,
              value ? styles.knobOn : styles.knobOff,
              knobAnimatedStyle,
            ]}
          />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

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
    paddingHorizontal: TRACK_PAD,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
  knobOff: {
    backgroundColor: colors.text,
  },
  knobOn: {
    backgroundColor: colors.accent,
  },
});
