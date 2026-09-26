/**
 * Sovereign v2 design tokens — dark-first Liquid Glass theme.
 *
 * The visual identity: deep-space background (#07090E) with soft aurora
 * gradients, frosted glass surfaces floating above, minimal type.
 * Glass belongs on: tab bar, sheets, CTAs, floating overlays (Apple HIG).
 * Content stays on solid/legible surfaces — never glass-on-glass text.
 */

export const colors = {
  // Canvas
  background: '#07090E',
  backgroundElevated: '#0D1119',
  backgroundElement: '#141A26',

  // Aurora gradient stops (soft pastel washes over the dark canvas,
  // echoing the motion_conquest backdrop)
  aurora: {
    violet: '#7C6CF0',
    cyan: '#5BC8E8',
    rose: '#E88BB0',
    mint: '#7FE0C3',
  },

  // Text
  text: '#F2F4F8',
  textSecondary: '#A7B0C2',
  textTertiary: '#6B7488',

  // Brand / accents
  accent: '#7C6CF0', // sovereign violet
  accentSoft: 'rgba(124, 108, 240, 0.16)',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',

  // Glass tints
  glassTintDark: 'rgba(20, 26, 38, 0.55)',
  glassTintLight: 'rgba(242, 244, 248, 0.12)',

  // Borders / dividers
  hairline: 'rgba(242, 244, 248, 0.10)',
  hairlineStrong: 'rgba(242, 244, 248, 0.18)',

  // Orb (the living streak visualization) — aura by tier
  orb: {
    dormant: '#3A4154', // day 0 — dim, waiting
    ember: '#E88BB0', // early streak
    radiant: '#7C6CF0', // growing
    sovereign: '#5BC8E8', // long streak — icy bright
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  hero: { fontSize: 44, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  callout: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.4 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2 },
} as const;

/** Soft aurora gradient stops for screen backdrops (used with expo-linear-gradient). */
export const backdropGradient = {
  colors: ['#0B0E1A', '#07090E', '#0A0F1E'] as const,
  // Aurora wash blobs are drawn per-screen with radial-feel linear gradients
  // at low opacity over this base.
} as const;

export type Colors = typeof colors;
