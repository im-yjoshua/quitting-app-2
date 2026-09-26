/**
 * Orb — the living streak visualization (spec §3).
 *
 * ONE component used on Home (large), Urge Surf (breathing), celebration
 * (burst — Day 4), and share cards (static render via `animated={false}`).
 *
 * - Base: layered radial-feel gradients inside a glass sphere
 *   (GlassView on iOS 26+, gradient + blur fallback below — never empty).
 * - Radiance is a CONTINUOUS function of cleanDays: dim at day 0, luminous
 *   at 90d+. No hard steps — it's always growing.
 * - Idle: slow breathe (scale 1.0↔1.04, 6s loop) on the UI thread via Reanimated.
 * - Tap: gentle expand + haptic; the parent opens the exact-time sheet.
 * - Themes: dawn (free), ember/tide (premium — wired, gated on Day 5).
 *
 * Burst/relapse-dim/milestone animations land with Day 3–4.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { OrbTheme } from '../types/app';
import { GlassSurface } from './glass/GlassSurface';

const THEME_STOPS: Record<
  OrbTheme,
  { inner: string; mid: string; outer: string; glow: string }
> = {
  dawn: {
    inner: '#C9B8FF',
    mid: '#7C6CF0',
    outer: '#2E2A66',
    glow: '#7C6CF0',
  },
  ember: {
    inner: '#FFD9A8',
    mid: '#E8786A',
    outer: '#5E2A2A',
    glow: '#E8786A',
  },
  tide: {
    inner: '#B8F4E4',
    mid: '#35B3A3',
    outer: '#1B4A4A',
    glow: '#35B3A3',
  },
};

interface OrbProps {
  /** Days clean — drives radiance continuously. */
  cleanDays: number;
  theme?: OrbTheme;
  /** Diameter of the sphere in points. */
  size?: number;
  /** false = static render for share cards (no Reanimated loops). */
  animated?: boolean;
  onPress?: () => void;
}

/**
 * Radiance t ∈ [0, 1): 0 at day 0 (dim, desaturated), ~0.63 at 30d,
 * ~0.95 at 90d. Asymptotic — always growing, never capped at a step.
 */
export function orbRadiance(cleanDays: number): number {
  const d = Math.max(0, cleanDays);
  return 1 - Math.exp(-d / 30);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const v = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${v(r)}${v(g)}${v(b)}`;
}

/** Mix a color toward `other` by `amount` (0 = color, 1 = other). */
function mixHex(hex: string, other: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(other);
  return rgbToHex(
    r1 + (r2 - r1) * amount,
    g1 + (g2 - g1) * amount,
    b1 + (b2 - b1) * amount
  );
}

/**
 * Luminance-matched grayscale of a color — used to desaturate the orb at
 * low radiance so day 0 reads dim AND gray (spec §3), while keeping the
 * gradient's 3D depth.
 */
function toGray(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return rgbToHex(lum, lum, lum);
}

/**
 * Desaturation factor ∈ [0, 1]: 1 at day 0, ~0.56 at 7d ("warm glow"),
 * ~0.08 at 30d ("rich color"), ~0 by 90d. Decays faster than the radiance
 * curve so color arrives earlier than full luminosity.
 */
export function orbDesaturation(cleanDays: number): number {
  const d = Math.max(0, cleanDays);
  return Math.exp(-d / 12);
}

/** Smoothstep 0→1 across [edge0, edge1] for the shimmer gate. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const s = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return s * s * (3 - 2 * s);
}

export function Orb({
  cleanDays,
  theme = 'dawn',
  size = 220,
  animated = true,
  onPress,
}: OrbProps) {
  const stops = THEME_STOPS[theme];
  const t = orbRadiance(cleanDays);

  // Day 0 renders a dim gray sphere; color blooms in as the streak grows.
  const desat = orbDesaturation(cleanDays);
  const inner = mixHex(stops.inner, toGray(stops.inner), desat);
  const mid = mixHex(stops.mid, toGray(stops.mid), desat);
  const outer = mixHex(stops.outer, toGray(stops.outer), desat);
  const glow = mixHex(stops.glow, toGray(stops.glow), desat);

  const breathe = useSharedValue(1);
  const press = useSharedValue(1);
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    if (!animated) return;
    breathe.value = withRepeat(
      withTiming(1.04, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(breathe);
  }, [animated, breathe]);

  // Shimmer sweep — only for luminous streaks (t ≥ ~0.85, i.e. 60d+,
  // full by 90d). Slow, calm, UI-thread.
  const shimmerT = smoothstep(0.85, 0.97, t);
  const shimmerActive = animated && shimmerT > 0;
  useEffect(() => {
    if (!shimmerActive) return;
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(shimmerX);
  }, [shimmerActive, shimmerX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * press.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '18deg' }, { translateX: shimmerX.value * size * 0.6 }],
    opacity: 0.16 * shimmerT,
  }));

  const handlePressIn = () => {
    press.value = withSpring(1.06, { damping: 12, stiffness: 200 });
  };
  const handlePressOut = () => {
    press.value = withSpring(1, { damping: 12, stiffness: 200 });
  };
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  const glowOpacity = 0.08 + 0.3 * t;
  const sphereStyle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.stage, { width: size * 1.7, height: size * 1.7 }]}>
      {/* Glow rings — opacity grows with radiance */}
      <View
        style={[
          styles.ring,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size * 0.775,
            backgroundColor: glow,
            opacity: glowOpacity * 0.35,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: size * 1.28,
            height: size * 1.28,
            borderRadius: size * 0.64,
            backgroundColor: glow,
            opacity: glowOpacity * 0.6,
          },
        ]}
      />
      <Animated.View style={[styles.center, animatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your streak orb. Tap for exact clean time."
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <GlassSurface
            style={sphereStyle}
            glassEffectStyle="clear"
            fallbackIntensity={55}
          >
            <View style={StyleSheet.absoluteFill}>
              <LinearGradient
                colors={[inner, mid, outer]}
                start={{ x: 0.25, y: 0.15 }}
                end={{ x: 0.8, y: 0.95 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Inner light — brightens as the streak grows */}
              <View
                style={[
                  styles.innerLight,
                  {
                    width: size * 0.52,
                    height: size * 0.52,
                    borderRadius: size * 0.26,
                    backgroundColor: inner,
                    opacity: 0.25 + 0.45 * t,
                  },
                ]}
              />
              {/* Glass highlight — the "liquid" sheen */}
              <View
                style={[
                  styles.highlight,
                  {
                    width: size * 0.34,
                    height: size * 0.22,
                    borderRadius: size * 0.17,
                    top: size * 0.1,
                    left: size * 0.16,
                    opacity: 0.35,
                  },
                ]}
              />
              {/* Shimmer sweep — luminous streaks only, clipped to the sphere */}
              {shimmerActive && (
                <Animated.View
                  style={[
                    styles.shimmerBand,
                    {
                      width: size * 0.28,
                      height: size * 1.4,
                      top: -size * 0.2,
                      borderRadius: size * 0.14,
                    },
                    shimmerStyle,
                  ]}
                />
              )}
            </View>
          </GlassSurface>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerLight: {
    position: 'absolute',
    alignSelf: 'center',
    top: '24%',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-24deg' }],
  },
  shimmerBand: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
  },
});
