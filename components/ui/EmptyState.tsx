/**
 * EmptyState — the Apple-style empty state.
 *
 * Centered slightly above middle: SF Symbol (Material Symbol on Android)
 * at 48pt in metadata, a headline of what would be here, one optional
 * explainer line, and one inverted action. Plain is the target.
 */
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { InvertedButton } from './InvertedButton';

interface EmptyStateProps {
  /** SF Symbol name (iOS). */
  iosSymbol: string;
  /** Material Symbol name (Android). */
  androidSymbol: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  iosSymbol,
  androidSymbol,
  title,
  message,
  actionLabel,
  onAction,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <SymbolView
        name={{ ios: iosSymbol as never, android: androidSymbol as never }}
        tintColor={theme.colors.metadata}
        style={styles.symbol}
      />
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: theme.colors.metadata }]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <InvertedButton title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    // Bias above dead-center: the visual anchor sits ~40% down the screen.
    paddingBottom: spacing.xxl,
  },
  symbol: { width: 48, height: 48 },
  title: { ...typeScale.headline, marginTop: spacing.md, textAlign: 'center' },
  message: {
    ...typeScale.subhead,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
