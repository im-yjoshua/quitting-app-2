/**
 * components/ui/logic.ts — pure helpers for the v3 UI library.
 *
 * No React Native imports in this module: it runs in Jest (node) AND on the
 * Reanimated UI thread. Functions called from worklets carry the 'worklet'
 * directive, which is an inert string literal outside the worklet runtime.
 */

/** GlassView fallback-ladder tier. Solid is terminal — never render nothing. */
export type GlassTier = 'solid' | 'glass' | 'blur';

export interface GlassCapabilities {
  /** Accessibility Reduce Transparency is on. */
  reduceTransparency: boolean;
  /**
   * expo-glass-effect can render:
   * isGlassEffectAPIAvailable() && isLiquidGlassAvailable().
   */
  glassEffectAvailable: boolean;
  /** A blur tier exists below glass (expo-blur installed). */
  blurAvailable: boolean;
}

/**
 * Resolve which GlassView tier to render.
 * Reduce Transparency always wins → solid. Glass never sits under body text
 * (enforced by call sites), so every tier here is chrome-only.
 */
export function resolveGlassTier(caps: GlassCapabilities): GlassTier {
  if (caps.reduceTransparency) return 'solid';
  if (caps.glassEffectAvailable) return 'glass';
  if (caps.blurAvailable) return 'blur';
  return 'solid';
}

/** Clamp a 0..1 progress value. NaN → 0. */
export function clamp01(n: number): number {
  'worklet';
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export interface RingAngles {
  /** Rotation (deg) of the right-half arc layer. */
  right: number;
  /** Rotation (deg) of the left-half arc layer. */
  left: number;
}

/** Craving intensity on the 1–5 scale (null = skipped). */
export type IntensityValue = 1 | 2 | 3 | 4 | 5 | null;

/**
 * One honest line for the urge-surf end screen, comparing the optional
 * start and end intensity ratings. Returns null when either rating was
 * skipped — the delta line is only shown when both were given.
 *
 * Copy rule: kind, factual, identity-respecting — never labels the person,
 * never frames a setback as an identity (phase-gate audit).
 */
export function intensityDeltaCopy(
  start: IntensityValue,
  end: IntensityValue
): string | null {
  if (start === null || end === null) return null;
  if (end < start) return `From ${start} to ${end}. The wave passed.`;
  if (end === start) return `Steady at ${start}. You stayed with it.`;
  return `From ${start} to ${end} — some waves run bigger. You’re still here.`;
}

/**
 * Arc angles for the two-half progress-ring technique.
 *
 * The ring draws from the top, sweeping clockwise. Each half-container clips
 * a full-circle border to a semicircle; rotating the inner circle reveals the
 * arc. At 0 both halves hide their semicircle (-180°); the right half fills
 * over 0→0.5, the left over 0.5→1.
 */
export function ringAngles(progress: number): RingAngles {
  'worklet';
  const p = clamp01(progress);
  if (p <= 0.5) {
    return { right: p * 360 - 180, left: -180 };
  }
  return { right: 0, left: (p - 0.5) * 360 - 180 };
}
