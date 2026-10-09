/**
 * components/orb/logic.ts — pure presentation math for Orb v2.
 *
 * The glow brightens as the streak grows, but the streak computation itself
 * lives in services/ (untouched). These functions only map a day count to
 * visual intensity.
 *
 * No React Native imports in this module: it runs in Jest (node) AND on the
 * Reanimated UI thread. Functions called from worklets carry the 'worklet'
 * directive, which is an inert string literal outside the worklet runtime.
 */

/**
 * Radiance t ∈ [0, 1): 0 at day 0 (dim), ~0.63 at 30d, ~0.95 at 90d.
 * Asymptotic — always growing, never capped at a step.
 */
export function orbRadiance(cleanDays: number): number {
  'worklet';
  const d = Math.max(0, cleanDays);
  return 1 - Math.exp(-d / 30);
}

/**
 * Desaturation factor ∈ (0, 1]: 1 at day 0 (gray sphere), ~0.37 at 12d
 * ("warm glow"), ~0 by 90d (full color). Decays faster than the radiance
 * curve so color arrives earlier than full luminosity.
 */
export function orbDesaturation(cleanDays: number): number {
  'worklet';
  const d = Math.max(0, cleanDays);
  return Math.exp(-d / 12);
}

/** Per-layer glow opacities, each monotonic non-decreasing with the streak. */
export interface OrbGlow {
  /** Outer bleed rings behind the sphere. */
  ring: number;
  /** Inner glow core on the sphere. */
  inner: number;
  /** Specular highlight, top-left. */
  specular: number;
  /** Rim light along the bottom-right edge. */
  rim: number;
}

/**
 * Day count → glow intensity mapping (pure presentation). Day 0 renders
 * dim but visible; long streaks are luminous. All channels stay in [0, 1].
 */
export function orbGlow(cleanDays: number): OrbGlow {
  'worklet';
  const t = orbRadiance(cleanDays);
  return {
    ring: 0.06 + 0.3 * t,
    inner: 0.18 + 0.52 * t,
    specular: 0.5 + 0.34 * t,
    rim: 0.08 + 0.32 * t,
  };
}

/** Smoothstep 0→1 across [edge0, edge1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  'worklet';
  const s = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return s * s * (3 - 2 * s);
}
