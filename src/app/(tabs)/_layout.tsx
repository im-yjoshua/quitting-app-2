/**
 * (tabs)/_layout — NATIVE tabs (expo-router `unstable-native-tabs`).
 *
 * System components over custom ones: the hand-rolled GlassTabBar is gone.
 * On iOS 26 this renders the floating Liquid Glass capsule with the morphing
 * pill for free; on iOS 18 it renders the classic tab bar; Android gets the
 * native bottom bar. SF Symbols on iOS (`sf`), Material Symbols on Android
 * (`md`) — both resolved through expo-symbols, no new native deps.
 * Active indicator = sovereign violet (the accent's sanctioned home).
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '../../../theme/useTheme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      tintColor={theme.colors.accent}
      iconColor={{
        default: theme.colors.metadata,
        selected: theme.colors.accent,
      }}
      labelStyle={{
        default: { color: theme.colors.metadata },
        selected: { color: theme.colors.accent },
      }}
      backgroundColor={theme.colors.background}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
