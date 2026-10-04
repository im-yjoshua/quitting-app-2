/**
 * CravingDots — 1–5 craving intensity selector, shared by the journal
 * composer and the urge-surf end screen. Tapping the selected dot clears it.
 *
 * Monochrome: unselected dots are quiet (metadata numerals), the selected
 * dot is an accent ring with full-brightness text. 44pt targets.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export type CravingValue = 1 | 2 | 3 | 4 | 5 | null;

export function CravingDots({
  value,
  onChange,
}: {
  value: CravingValue;
  onChange: (v: CravingValue) => void;
}) {
  const theme = useTheme();
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
            style={({ pressed }) => [
              styles.dot,
              {
                borderColor: active
                  ? theme.colors.accent
                  : theme.colors.hairline,
                backgroundColor: active
                  ? theme.colors.accentSoft
                  : 'transparent',
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dotText,
                {
                  color: active
                    ? theme.colors.text
                    : theme.colors.metadata,
                  fontWeight: active ? '700' : '400',
                },
              ]}
            >
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
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
  dotText: { ...type.headline },
});
