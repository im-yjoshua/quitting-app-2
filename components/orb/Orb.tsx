/**
 * Orb v2 — the emotional core of Sovereign v3.
 *
 * A luminous violet glass sphere on the black canvas: the SINGLE intentional
 * color object. Everything else stays monochrome so the Orb can be loud.
 *
 * - Breathing: 6s loop, scale 1↔1.04 via Reanimated shared values (UI thread)
 *   plus an opacity shimmer on the inner glow — the one sanctioned ambient
 *   motion (plan §5). Fully static under Reduce Motion.
 * - Streak-reactive glow: the day count maps to glow intensity through the
 *   pure presentation math in ./logic (the streak computation itself is
 *   untouched in services/). Day 0 renders dim + desaturated; color blooms
 *   as the streak grows.
 * - Center content: day count + "days clean" caption, tabular numerals,
 *   full-brightness white.
 * - Scales with min(width, height) — no fixed pixel sizes; SE → Pro Max.
 *
 * Accessibility: the stage carries the label ("47 days clean"); every
 * decorative layer is hidden from VoiceOver. Display-only — not a button,
 * so there are no touch targets here.
 *
 * Visual approach: the 5-layer glass recipe from the legacy components/Orb,
 * re-cut in the v3 language (violet only, ui/GlassView instead of
 * GlassSurface, center content instead of a tap target).
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { dark, motion, orbThemes, type as typeScale } from '../../theme/tokens';
import { GlassView } from '../ui/GlassView';
import { orbDesaturation, orbGlow } from './logic';

interface OrbProps {
  /** Days clean — drives glow intensity (presentation only). */
  cleanDays: number;
  /**
   * Sphere diameter in points. Defaults to 62% of min(window width, height).
   * The stage (glow bleed) is 1.5× the diameter.
   */
  size?: number;
  testID?: string;
}

/** Sphere diameter = this fraction of min(window width, height). */
const DIAMETER_FRACTION = 0.62;
/** Stage (glow bleed) relative to the sphere diameter. */
const STAGE_RATIO = 1.5;
/** Day-count font size relative to the sphere diameter. */
const NUMBER_FONT_RATIO = 0.3;

/** Mix a color toward `other` by `amount` (0 = color, 1 = other). */
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
 * Luminance-matched grayscale of a color — desaturates the orb at low
 * streaks so day 0 reads dim AND gray, while keeping the gradient's
 * 3D depth.
 */
function toGray(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return rgbToHex(lum, lum, lum);
}

export function Orb({ cleanDays, size, testID }: OrbProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Presentation-only normalization (mirrors the floor semantics in
  // services/ — the streak computation itself is untouched).
  const days = Math.max(0, Math.floor(cleanDays));
  const diameter = size ?? Math.min(width, height) * DIAMETER_FRACTION;
  const stage = diameter * STAGE_RATIO;

  // Violet only — the Orb's v3 color story. Day 0 desaturates toward gray.
  const stops = orbThemes.dawn;
  const desat = orbDesaturation(days);
  const inner = mixHex(stops.inner, toGray(stops.inner), desat);
  const mid = mixHex(stops.mid, toGray(stops.mid), desat);
  const outer = mixHex(stops.outer, toGray(stops.outer), desat);
  const glowColor = mixHex(stops.glow, toGray(stops.glow), desat);
  const glow = orbGlow(days);

  const breathe = useSharedValue(1);
  const shimmer = useSharedValue(0);

  // The one sanctioned ambient motion: 6s scale loop + glow opacity shimmer,
  // both on the UI thread. Fully static under Reduce Motion.
  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      shimmer.value = 0;
      return;
    }
    const half = { duration: motion.breathe.periodMs / 2, easing: Easing.inOut(Easing.sin) };
    breathe.value = withRepeat(withTiming(motion.breathe.peakScale, half), -1, true);
    shimmer.value = withRepeat(withTiming(1, half), -1, true);
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(shimmer);
    };
  }, [reduceMotion, breathe, shimmer]);

  const sphereAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const innerGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glow.inner + shimmer.value * motion.breathe.shimmerDelta,
  }));

  const sphereStyle = { width: diameter, height: diameter, borderRadius: diameter / 2 };
  const stageStyle = { width: stage, height: stage };
  const dayWord = days === 1 ? 'day' : 'days';

  return (
    <View
      style={[styles.stage, stageStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${days} ${dayWord} clean`}
      testID={testID}
    >
      {/* Glow bleed — opacity grows with the streak */}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.ring,
          {
            width: diameter * 1.4,
            height: diameter * 1.4,
            borderRadius: diameter * 0.7,
            backgroundColor: glowColor,
            opacity: glow.ring * 0.35,
          },
        ]}
      />
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.ring,
          {
            width: diameter * 1.18,
            height: diameter * 1.18,
            borderRadius: diameter * 0.59,
            backgroundColor: glowColor,
            opacity: glow.ring * 0.6,
          },
        ]}
      />
      <Animated.View style={[styles.center, sphereAnimatedStyle]}>
        <GlassView variant="clear" style={sphereStyle}>
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={StyleSheet.absoluteFill}
          >
            {/* Base diagonal gradient — the violet color story */}
            <LinearGradient
              colors={[inner, mid, outer]}
              start={{ x: 0.25, y: 0.12 }}
              end={{ x: 0.8, y: 0.95 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Spherical depth — light gathering top-left, shade bottom-right */}
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
            {/* Inner glow — brightens as the streak grows (+ shimmer) */}
            <Animated.View
              style={[
                styles.innerGlow,
                {
                  width: diameter * 0.56,
                  height: diameter * 0.56,
                  borderRadius: diameter * 0.28,
                  backgroundColor: inner,
                },
                innerGlowAnimatedStyle,
              ]}
            />
            {/* Rim light — bottom-right edge arc */}
            <View
              style={[
                styles.rim,
                {
                  width: diameter * 0.92,
                  height: diameter * 0.92,
                  borderRadius: diameter * 0.46,
                  right: diameter * 0.02,
                  bottom: diameter * 0.02,
                  opacity: glow.rim,
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
                  width: diameter * 0.36,
                  height: diameter * 0.22,
                  borderRadius: diameter * 0.11,
                  top: diameter * 0.1,
                  left: diameter * 0.15,
                  opacity: glow.specular,
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
            {/* Inset highlights — the thin bright top rim / soft dark bottom
                rim that keep glass from reading as milk. */}
            <View
              style={[
                styles.insetTop,
                { top: diameter * 0.045, width: diameter * 0.62, opacity: glow.specular },
              ]}
            />
            <View
              style={[styles.insetBottom, { bottom: diameter * 0.045, width: diameter * 0.62 }]}
            />
          </View>
        </GlassView>
        {/* Center content — the thing the user came to read. Breathes with
            the sphere as one object; hidden from VoiceOver (outer label). */}
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[styles.centerContent, StyleSheet.absoluteFill]}
        >
          <Text
            style={[
              styles.number,
              typeScale.tabular,
              { fontSize: diameter * NUMBER_FONT_RATIO, color: dark.colors.onAccent },
            ]}
          >
            {days}
          </Text>
          <Text
            style={[
              styles.caption,
              { fontSize: typeScale.subhead.fontSize, color: dark.colors.onAccent },
            ]}
          >
            {dayWord} clean
          </Text>
        </View>
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
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontWeight: '700',
    // Soft lift so the count reads over the inner glow at any streak.
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  caption: {
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
