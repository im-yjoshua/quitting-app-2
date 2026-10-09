/**
 * GlassSurface — the single shared wrapper for every glass element.
 *
 * - iOS 26+: native Liquid Glass via `GlassView` (expo-glass-effect).
 * - Anything else (older iOS, Android): 5-layer fallback —
 *     1. translucent fill
 *     2. BlurView (24px-class blur) + saturation-boosting tint
 *     3. MANDATORY inset top highlight: 1px line, rgba(255,255,255,.5)
 *     4. bottom inset shade: 1px line, rgba(255,255,255,.18)
 *     5. soft drop shadow
 *   Without the insets, glass reads as milk — they are what sell the edge.
 *
 * Glass is reserved for: the native tab bar, sheets, the Orb, and floating
 * overlays. NEVER behind body text. Never stacked more than 2 deep.
 */
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../theme/useTheme';

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

/**
 * The fallback stack. BlurView blurs what's behind it; the highlight/shade
 * lines sit on top as absolute 1px edges, and content renders above all.
 */
function GlassFallback({
  children,
  style,
  fallbackIntensity = 70,
}: Pick<GlassSurfaceProps, 'children' | 'style' | 'fallbackIntensity'>) {
  const theme = useTheme();
  const dark = theme.scheme === 'dark';

  return (
    <View
      style={[
        styles.fallbackHost,
        { boxShadow: '0px 8px 18px rgba(0,0,0,0.18)' },
        style,
      ]}
    >
      <BlurView
        style={StyleSheet.absoluteFill}
        tint={dark ? 'dark' : 'light'}
        intensity={fallbackIntensity}
      />
      {/* Layer 1 — translucent fill (saturation-boost stand-in). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)' },
        ]}
      />
      {/* Layer 3 — mandatory inset top highlight. */}
      <View pointerEvents="none" style={styles.topHighlight} />
      {/* Layer 4 — bottom inset shade. */}
      <View pointerEvents="none" style={styles.bottomShade} />
      <View style={styles.fallbackContent}>{children}</View>
    </View>
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
  const theme = useTheme();
  // borderRadius + overflow hidden are required for the glass to clip correctly.
  const clippedStyle: ViewStyle = { overflow: 'hidden' };

  // Reduce Transparency → solid surface + hairline. Terminal tier, same
  // promise as the v3 ui/GlassView ladder: transparency never renders.
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

  if (reduceTransparency) {
    return (
      <View
        style={[
          clippedStyle,
          style,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.hairline,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {children}
      </View>
    );
  }

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
    <GlassFallback style={style} fallbackIntensity={fallbackIntensity}>
      {children}
    </GlassFallback>
  );
}

/** Convenience: is the device rendering true Liquid Glass right now? */
export function isNativeGlassActive(): boolean {
  return canUseNativeGlass();
}

const styles = StyleSheet.create({
  fallbackHost: {
    overflow: 'hidden',
  },
  fallbackContent: {
    flex: 1,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
