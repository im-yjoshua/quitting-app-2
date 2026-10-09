/**
 * SectionHeader — Settings-pattern section header.
 *
 * Uppercase footnote in metadata, 16pt above the group, 8pt below. Optional
 * inline text action on the trailing edge (accent — this counts as a link).
 */
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SectionHeader({ title, actionLabel, onAction, style, testID }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]} testID={testID}>
      <Text style={[styles.title, { color: theme.colors.metadata }]}>
        {title.toUpperCase()}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={12}
        >
          <Text style={[styles.action, { color: theme.colors.accent }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  title: { ...typeScale.footnote },
  action: { ...typeScale.footnote, fontWeight: '600' },
});
