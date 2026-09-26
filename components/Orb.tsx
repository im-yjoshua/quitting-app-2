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

export function Orb({
  cleanDays,
  theme = 'dawn',
  size = 220,
  animated = true,
  onPress,
}: OrbProps) {
  const stops = THEME_STOPS[theme];
  const t = orbRadiance(cleanDays);

  const breathe = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;
    breathe.value = withRepeat(
      withTiming(1.04, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(breathe);
  }, [animated, breathe]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * press.value }],
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
            backgroundColor: stops.glow,
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
            backgroundColor: stops.glow,
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
                colors={[stops.inner, stops.mid, stops.outer]}
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
                    backgroundColor: stops.inner,
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
});
