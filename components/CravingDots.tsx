/**
 * CravingDots — 1–5 craving intensity selector, shared by the journal
 * composer and the urge-surf end screen. Tapping the selected dot clears it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '../theme/tokens';

export type CravingValue = 1 | 2 | 3 | 4 | 5 | null;

export function CravingDots({
  value,
  onChange,
}: {
  value: CravingValue;
  onChange: (v: CravingValue) => void;
}) {
  return (
    <View style={styles.row}>
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Craving level ${n} of 5`}
            onPress={() => onChange(active ? null : n)}
            style={[styles.dot, active && styles.dotActive]}
          >
            <Text style={[styles.dotText, active && styles.dotTextActive]}>
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dotActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  dotText: { ...type.callout, color: colors.textSecondary },
  dotTextActive: { color: colors.text, fontWeight: '700' },
});
