/**
 * FAB — the floating action button, the one intentional spot of color.
 *
 * Solid accent fill (never monochrome, never glass), white SF Symbol,
 * 56pt circle. Parent positions it (absolute, above the tab bar insets).
 */
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '../../theme/useTheme';
import { pressInScale, pressOutScale, usePressAnimation } from './usePressAnimation';

interface FABProps {
  /** SF Symbol name (iOS). */
  iosSymbol: string;
  /** Material Symbol name (Android). */
  androidSymbol: string;
  onPress: () => void;
  /** VoiceOver label — required, the button is icon-only. */
  label: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FAB({
  iosSymbol,
  androidSymbol,
  onPress,
  label,
  size = 56,
  style,
  testID,
}: FABProps) {
  const theme = useTheme();
  const { animatedStyle, scale, reduceMotion } = usePressAnimation();

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => pressInScale(scale, reduceMotion)}
        onPressOut={() => pressOutScale(scale, reduceMotion)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.accent,
            shadowColor: theme.colors.shadow,
          },
          style,
        ]}
        testID={testID}
      >
        <SymbolView
          name={{ ios: iosSymbol as never, android: androidSymbol as never }}
          tintColor={theme.colors.onAccent}
          style={styles.symbol}
          weight="semibold"
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  symbol: { width: 24, height: 24 },
});
