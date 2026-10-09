/**
 * GlassCard — floating-chrome card for short content over scrolling content
 * (pledge card, segmented control container, sheet handles).
 *
 * Never under body text — long-form content stays on the solid canvas.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import { GlassView } from './GlassView';

interface GlassCardProps {
  children: React.ReactNode;
  /** Inner content wrapper style (padding is baked in). */
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GlassCard({ children, contentStyle, style, testID }: GlassCardProps) {
  return (
    <GlassView style={[styles.card, style]} testID={testID}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg },
  content: { padding: spacing.md },
});
