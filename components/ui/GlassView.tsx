/**
 * GlassView — Liquid Glass for floating chrome ONLY.
 *
 * Fallback ladder (never glass under body text, never glass on glass):
 *   1. Reduce Transparency ON → solid surface + hairline
 *   2. expo-glass-effect available (isGlassEffectAPIAvailable() &&
 *      isLiquidGlassAvailable()) → native Liquid Glass
 *   3. expo BlurView (tint follows appearance)
 *   4. Solid surface + hairline (terminal — never nothing)
 *
 * Shape (borderRadius) comes from the style prop; content stays on top.
 */
import { BlurView } from 'expo-blur';
import {
  GlassView as ExpoGlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { resolveGlassTier } from './logic';

interface GlassViewProps {
  children?: React.ReactNode;
  /** Shape + layout. borderRadius here is the glass shape. */
  style?: StyleProp<ViewStyle>;
  variant?: 'regular' | 'clear';
  interactive?: boolean;
  testID?: string;
}

export function GlassView({
  children,
  style,
  variant = 'regular',
  interactive = false,
  testID,
}: GlassViewProps) {
  const theme = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Availability is a device constant — compute once.
  const glassEffectAvailable = useMemo(
    () => isGlassEffectAPIAvailable() && isLiquidGlassAvailable(),
    []
  );

  const tier = resolveGlassTier({
    reduceTransparency,
    glassEffectAvailable,
    blurAvailable: true, // expo-blur is installed
  });

  if (tier === 'glass') {
    return (
      <ExpoGlassView
        glassEffectStyle={variant}
        isInteractive={interactive}
        style={[styles.clip, style]}
        testID={testID}
      >
        {children}
      </ExpoGlassView>
    );
  }

  if (tier === 'blur') {
    return (
      <BlurView
        intensity={70}
        tint={theme.scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.clip, styles.edge, { borderColor: theme.colors.hairline }, style]}
        testID={testID}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        styles.clip,
        styles.edge,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  /** Edge highlight on the non-native tiers — glass reads via its rim. */
  edge: { borderWidth: StyleSheet.hairlineWidth },
});
