/**
 * GlassSurface — the single shared wrapper for every glass element.
 *
 * - iOS 26+: native Liquid Glass via `GlassView` (expo-glass-effect).
 * - Anything else (older iOS, Android): `expo-blur` BlurView fallback so
 *   free-floating elements (tab bar, pills, overlays) never visually disappear.
 *
 * Never hand-roll glass with opacity overlays — per the v57 docs, GlassView
 * renders as a plain transparent View on unsupported platforms, which is why
 * the BlurView fallback exists. Never set opacity 0 on GlassView or parents
 * (kills the effect); use `glassEffectStyle="none"` to hide instead.
 */
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';

export type GlassStyle = 'regular' | 'clear';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'regular' = medium opacity, adapts to surroundings. 'clear' = higher transparency. */
  glassEffectStyle?: GlassStyle;
  /** True for tappable surfaces — gives the native interactive glass feel. */
  interactive?: boolean;
  /** Optional tint over the glass (e.g. accent washes). */
  tintColor?: string;
  /** Blur intensity for the pre-iOS-26 / Android fallback. */
  fallbackIntensity?: number;
}

function canUseNativeGlass(): boolean {
  return (
    Platform.OS === 'ios' &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable()
  );
}

export function GlassSurface({
  children,
  style,
  glassEffectStyle = 'regular',
  interactive = false,
  tintColor,
  fallbackIntensity = 70,
}: GlassSurfaceProps) {
  // borderRadius + overflow hidden are required for the glass to clip correctly.
  const clippedStyle: ViewStyle = { overflow: 'hidden' };

  if (canUseNativeGlass()) {
    return (
      <GlassView
        style={[clippedStyle, style]}
        glassEffectStyle={glassEffectStyle}
        isInteractive={interactive}
        tintColor={tintColor}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      style={[clippedStyle, style]}
      tint="dark"
      intensity={fallbackIntensity}
    >
      {children}
    </BlurView>
  );
}

/** Convenience: is the device rendering true Liquid Glass right now? */
export function isNativeGlassActive(): boolean {
  return canUseNativeGlass();
}
