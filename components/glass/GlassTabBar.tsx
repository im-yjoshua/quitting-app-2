/**
 * GlassTabBar — custom floating pill tab bar for Expo Router `Tabs`.
 *
 * The motion_conquest NAVIGATE scene: a centered, floating frosted-glass pill
 * with four destinations. Native Liquid Glass on iOS 26+, BlurView below.
 * Passed as the `tabBar` prop of the `(tabs)` navigator.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '../../theme/tokens';
import { GlassSurface } from './GlassSurface';

/**
 * Minimal structural type for the props Expo Router's `Tabs` passes to a
 * custom `tabBar`. Deliberately narrow — importing BottomTabBarProps from
 * @react-navigation/bottom-tabs collides with expo-router's bundled fork
 * of those types, so we stay decoupled and structural.
 */
interface GlassTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: object }>;
  };
  descriptors: Record<string, { options: { tabBarLabel?: unknown } }>;
  navigation: {
    // Loose on purpose: react-navigation's generic emit can't be expressed
    // structurally without importing its exact types (which collide with
    // expo-router's bundled fork). We only ever emit 'tabPress' and read
    // `defaultPrevented` off the result.
    emit: (...args: any[]) => any;
    navigate: (name: string, params?: object) => void;
  };
}

interface TabDef {
  label: string;
  /** SF Symbol name (expo-symbols renders cross-platform). */
  symbol: string;
}

const TABS: Record<string, TabDef> = {
  index: { label: 'Home', symbol: 'house.fill' },
  stats: { label: 'Stats', symbol: 'chart.bar.fill' },
  journal: { label: 'Journal', symbol: 'book.fill' },
  you: { label: 'You', symbol: 'person.fill' },
};

export function GlassTabBar({ state, descriptors, navigation }: GlassTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: Math.max(insets.bottom, 12) }]}
    >
      <GlassSurface
        style={styles.pill}
        glassEffectStyle="regular"
        fallbackIntensity={80}
      >
        <View style={styles.row}>
          {state.routes.map((route, idx) => {
            const def = TABS[route.name] ?? { label: route.name, symbol: 'circle' };
            const isFocused = state.index === idx;
            // Respect screenOptions label overrides when present.
            const rawLabel = descriptors[route.key]?.options.tabBarLabel;
            const label = typeof rawLabel === 'string' ? rawLabel : def.label;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name, route.params);
              }
            };

            // Unfocused tabs stay legible: textSecondary (~9:1 on the dark
            // canvas) rather than textTertiary, which washed out at 11px
            // on the blur glass.
            const tint = isFocused ? colors.accent : colors.textSecondary;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.tab,
                  isFocused && styles.tabFocused,
                  pressed && styles.tabPressed,
                ]}
              >
                <SymbolView
                  name={def.symbol as never}
                  size={22}
                  tintColor={tint}
                  weight={isFocused ? 'semibold' : 'regular'}
                />
                <Text style={[styles.label, { color: tint }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    // Subtle edge definition so the pill reads on busy backdrops.
    borderWidth: Platform.OS === 'ios' ? 0 : StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 68,
  },
  tabFocused: {
    backgroundColor: colors.accentSoft,
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    ...type.micro,
    marginTop: 2,
  },
});
