/**
 * Screen — v3 screen wrapper: pure monochrome canvas, safe areas respected.
 *
 * The background extends under the notch/home indicator; content is inset.
 * `scrollable` renders a ScrollView with interactive keyboard dismissal.
 */
import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  /** Content wrapper style. */
  style?: StyleProp<ViewStyle>;
  /** ScrollView content container style (scrollable only). */
  scrollContentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  scrollable?: boolean;
  testID?: string;
}

export function Screen({
  children,
  style,
  scrollContentStyle,
  edges = ['top', 'left', 'right'],
  scrollable = false,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      testID={testID}
    >
      <SafeAreaView style={styles.fill} edges={edges}>
        {scrollable ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[styles.grow, style, scrollContentStyle]}
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, style]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
});
