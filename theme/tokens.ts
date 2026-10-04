/**
 * Sovereign v2 design tokens — monochrome system (redesign "Kill the cheap").
 *
 * The three laws:
 *  1. Monochrome — canvas is pure #000000 (dark) / #FFFFFF (light). Exactly
 *     one grey (#1C1C1E / #F2F2F7), and ONLY for grouped list cards + text
 *     inputs. No aurora washes, no tinted backgrounds.
 *  2. Apple's dimensions — SF system type scale with 17pt body, 4/8pt grid,
 *     44pt touch targets, standard radii, springs.
 *  3. System components — native tabs, system sheets, native switches.
 *
 * The one stated deviation: the Orb keeps its color (product soul — the
 * single intentional color object on a monochrome canvas). Orb tokens live
 * here and are the ONLY non-monochrome, non-semantic colors allowed.
 *
 * Accent (sovereign violet #7C6CF0, clears 3:1 on both canvases) is confined
 * to: active tab indicator, links, toggle on-states, selected states. NEVER on
 * full-width primary buttons — those are inverted fills.
 *
 * RULE: no hex literal inside any component — every color comes from this
 * module (via `useTheme()` for appearance-aware code).
 */

export type ColorScheme = 'light' | 'dark';
export type AppearanceSetting = 'light' | 'dark' | 'system';

export interface ThemeColors {
  /** Pure canvas. */
  background: string;
  /** Inverse canvas — the inverted primary-button fill. */
  inverted: string;
  /** The ONE grey — grouped list cards + text inputs ONLY. */
  surface: string;
  /** Body text, titles, button labels — ALWAYS full brightness. */
  text: string;
  /** Timestamps, captions, placeholders ONLY (< 1/3 of visible text). */
  metadata: string;
  /** Hairline separators. */
  hairline: string;
  /** Sovereign violet — tabs, links, toggles, selection. */
  accent: string;
  /** Soft accent wash for selected tab pills etc. */
  accentSoft: string;
  /** Content drawn on the accent (switch thumbs, selected chips). */
  onAccent: string;
  /** Drop-shadow color (pure black, both appearances). */
  shadow: string;
  success: string;
  warning: string;
  danger: string;
  /** The Orb's color story — the product's single intentional color object. */
  orb: {
    dormant: string;
    ember: string;
    radiant: string;
    sovereign: string;
  };
}

const orb = {
  dormant: '#3A4154', // day 0 — dim, waiting
  ember: '#E88BB0', // early streak
  radiant: '#7C6CF0', // growing
  sovereign: '#5BC8E8', // long streak — icy bright
} as const;

/**
 * Orb theme gradient stops — the product's single intentional color object
 * (the stated monochrome deviation). Same three themes as before (dawn
 * free; ember + tide premium), elevated by the 5-layer rendering in
 * components/Orb.tsx. Exported for components/Orb.tsx (kept out of
 * ThemeColors so the monochrome theme objects stay pure).
 */
export const orbThemes = {
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
} as const;

const shared = {
  accent: '#7C6CF0', // sovereign violet
  accentSoft: 'rgba(124, 108, 240, 0.16)',
  success: '#30D158', // iOS system green
  warning: '#FF9F0A', // iOS system orange
  danger: '#FF453A', // iOS system red
  /** Content drawn on the accent (switch thumbs, selected chips). */
  onAccent: '#FFFFFF',
  /** Drop-shadow color (pure black, both appearances). */
  shadow: '#000000',
  orb,
} as const;

const darkColors: ThemeColors = {
  background: '#000000',
  inverted: '#FFFFFF',
  surface: '#1C1C1E',
  text: '#FFFFFF',
  metadata: 'rgba(235,235,245,0.60)',
  hairline: 'rgba(255,255,255,0.12)',
  ...shared,
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  inverted: '#000000',
  surface: '#F2F2F7',
  text: '#000000',
  metadata: 'rgba(0,0,0,0.55)',
  hairline: 'rgba(0,0,0,0.10)',
  ...shared,
};

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

export const dark: Theme = { scheme: 'dark', colors: darkColors };
export const light: Theme = { scheme: 'light', colors: lightColors };

/** 4pt base unit — only values on the 4/8 grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Standard radii (primitives table).
 * sm 8 — chips, small buttons · md 12 — standard buttons, text fields ·
 * lg 16 — cards, modals, alerts · xl 20 — sheets, composers · pill — capsule.
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * HIG type scale, SF system. 17pt body. Semibold/Bold carry hierarchy —
 * never Light/Thin. Tight tracking on large sizes only.
 */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.3 },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.2 },
  title2: { fontSize: 22, fontWeight: '700' as const },
  title3: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  // Legacy aliases (pre-redesign screens) — mapped onto the HIG scale.
  hero: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.2 },
  /** Tabular numerals for every counter, timer, and money readout. */
  tabular: { fontVariant: ['tabular-nums'] as const },
} as const;

/**
 * Reanimated spring presets. Springs, never easing curves; interruptible +
 * reversible; only transform/opacity animated.
 */
export const motion = {
  /** Standard transitions (~300ms feel). */
  standard: { damping: 18, stiffness: 200 },
  /** Quick micro-interactions (~150ms feel). */
  quick: { damping: 20, stiffness: 320 },
  /** Press feedback. */
  press: { damping: 16, stiffness: 380 },
  /** Press scale target. */
  pressScale: 0.97,
} as const;

// ---------------------------------------------------------------------------
// Legacy compatibility (pre-redesign screens, reskinned in later phases).
// `colors` resolves to the DARK monochrome set so un-migrated screens keep
// compiling and read as dark monochrome. New code must use `useTheme()`.
// ---------------------------------------------------------------------------

/** @deprecated — use `useTheme()` from theme/useTheme instead. */
export const colors = {
  background: '#000000',
  backgroundElevated: '#1C1C1E',
  backgroundElement: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.60)',
  textTertiary: 'rgba(235,235,245,0.60)',
  accent: '#7C6CF0',
  accentSoft: 'rgba(124, 108, 240, 0.16)',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  hairline: 'rgba(255,255,255,0.12)',
  hairlineStrong: 'rgba(255,255,255,0.12)',
  orb: { ...orb },
} as const;

export type Colors = typeof colors;
