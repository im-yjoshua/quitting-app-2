/**
 * Orb — the living streak visualization.
 *
 * The product's single intentional color object on a monochrome canvas
 * (the stated deviation from the monochrome law). Rendered with the
 * 5-layer glass recipe:
 *
 * - Layered gradients for spherical depth (base diagonal + top-left
 *   transparent → bottom-right shade for volume).
 * - Crisp specular highlight, top-left (non-negotiable) with soft-fading
 *   edges; rim light along the bottom-right edge.
 * - Top inset highlight + bottom inset shade — the two insets that keep
 *   glass from reading as milk, adapted to React Native.
 * - Inner glow whose intensity follows the continuous radiance curve:
 *   dim + desaturated at day 0, luminous by 90d+. No hard steps.
 *
 * Idle: slow calm breathe on a Reanimated spring (the product, not
 * decoration). Tap: spring press to 0.97 + haptic; the parent opens the
 * exact-time sheet. Shimmer sweep gates in for luminous streaks (60d+).
 * `animated={false}` renders fully static (share cards, urge-surf breath).
 *
 * Themes: dawn (free), ember / tide (premium) — same names as before.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import type { OrbTheme } from '../types/app';
import { GlassSurface } from './glass/GlassSurface';
import { motion, orbThemes } from '../theme/tokens';

interface OrbProps {
  /** Days clean — drives radiance continuously. */
  cleanDays: number;
  theme?: OrbTheme;
  /** Diameter of the sphere in points. */
  size?: number;
  /** false = static render (no Reanimated loops). */
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
 * low radiance so day 0 reads dim AND gray, while keeping the gradient's
 * 3D depth.
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
  const stops = orbThemes[theme];
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

  // Reduce Motion → fully static, like the v3 orb.
  const reduceMotion = useReducedMotion();
  const animAllowed = animated && !reduceMotion;

  // Calm breathe on a slow spring — interruptible, reversible, UI thread.
  useEffect(() => {
    if (!animAllowed) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withSpring(1.045, { damping: 22, stiffness: 45 }),
      -1,
      true
    );
    return () => cancelAnimation(breathe);
  }, [animAllowed, breathe]);

  // Shimmer sweep — only for luminous streaks (t ≥ ~0.85, i.e. 60d+,
  // full by 90d). Slow, calm, UI-thread.
  const shimmerT = smoothstep(0.85, 0.97, t);
  const shimmerActive = animAllowed && shimmerT > 0;
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
    if (reduceMotion) return;
    press.value = withSpring(motion.pressScale, motion.press);
  };
  const handlePressOut = () => {
    if (reduceMotion) return;
    press.value = withSpring(1, motion.press);
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
            interactive
            fallbackIntensity={70}
          >
            <View style={StyleSheet.absoluteFill}>
              {/* Base diagonal gradient — theme color story */}
              <LinearGradient
                colors={[inner, mid, outer]}
                start={{ x: 0.25, y: 0.12 }}
                end={{ x: 0.8, y: 0.95 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Spherical depth — shade gathering toward bottom-right */}
              <LinearGradient
                colors={['rgba(255,255,255,0.14)', 'rgba(0,0,0,0)']}
                start={{ x: 0.2, y: 0.1 }}
                end={{ x: 0.55, y: 0.45 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.38)']}
                start={{ x: 0.45, y: 0.45 }}
                end={{ x: 0.95, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Inner glow — brightens as the streak grows */}
              <View
                style={[
                  styles.innerGlow,
                  {
                    width: size * 0.56,
                    height: size * 0.56,
                    borderRadius: size * 0.28,
                    backgroundColor: inner,
                    opacity: 0.2 + 0.5 * t,
                  },
                ]}
              />
              {/* Rim light — bottom-right edge arc */}
              <View
                style={[
                  styles.rim,
                  {
                    width: size * 0.92,
                    height: size * 0.92,
                    borderRadius: size * 0.46,
                    right: size * 0.02,
                    bottom: size * 0.02,
                    opacity: 0.1 + 0.3 * t,
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
                  start={{ x: 0.15, y: 0.15 }}
                  end={{ x: 0.95, y: 0.95 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              {/* Specular highlight — top-left, crisp but soft-edged */}
              <View
                style={[
                  styles.specular,
                  {
                    width: size * 0.36,
                    height: size * 0.22,
                    borderRadius: size * 0.11,
                    top: size * 0.1,
                    left: size * 0.15,
                    opacity: 0.55 + 0.3 * t,
                    transform: [{ rotate: '-24deg' }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.3, y: 0.2 }}
                  end={{ x: 0.8, y: 0.9 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              {/* Inset highlights — the 5-layer recipe's non-negotiables,
                  adapted to RN: thin bright line at the top rim, soft dark
                  line at the bottom rim. Clipped to the sphere by the glass
                  surface's overflow hidden. */}
              <View
                style={[
                  styles.insetTop,
                  {
                    top: size * 0.045,
                    width: size * 0.62,
                    opacity: 0.35 + 0.25 * t,
                  },
                ]}
              />
              <View
                style={[
                  styles.insetBottom,
                  {
                    bottom: size * 0.045,
                    width: size * 0.62,
                    opacity: 0.3,
                  },
                ]}
              />
              {/* Shimmer sweep — luminous streaks only, clipped to sphere */}
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
  innerGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '22%',
  },
  rim: {
    position: 'absolute',
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    overflow: 'hidden',
  },
  insetTop: {
    position: 'absolute',
    alignSelf: 'center',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  insetBottom: {
    position: 'absolute',
    alignSelf: 'center',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shimmerBand: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
