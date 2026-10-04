/**
 * EmptyState — the Apple-style empty state.
 *
 * Centered at ~40% height: SF Symbol (Material Symbol on Android) at 48pt
 * in metadata, a headline of what would be here, one optional body line,
 * and one inverted primary action. Plain is the target — an empty state
 * shouldn't feel like an event.
 */
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassButton } from './glass/GlassButton';
import { spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface EmptyStateProps {
  /** SF Symbol name (iOS). */
  symbol: string;
  /** Material Symbol name (Android). */
  materialSymbol: string;
  headline: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({
  symbol,
  materialSymbol,
  headline,
  body,
  actionTitle,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <SymbolView
        name={{ ios: symbol as never, android: materialSymbol as never }}
        tintColor={theme.colors.metadata}
        style={styles.symbol}
      />
      <Text style={[styles.headline, { color: theme.colors.text }]}>
        {headline}
      </Text>
      {body ? (
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {body}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <View style={styles.action}>
          <GlassButton title={actionTitle} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    minHeight: 280,
  },
  symbol: {
    width: 48,
    height: 48,
    marginBottom: spacing.md,
  },
  headline: {
    ...type.title2,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
