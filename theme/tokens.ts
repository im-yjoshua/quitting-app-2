/**
 * Sovereign v4 design tokens — "Stitch Obsidian" (the ONLY module holding
 * color/type/spacing/radii/motion values).
 *
 * Source: Joshua's approved Google Stitch reference
 * (`~/workspace/stitch-import/stitch_sovereign_habit_tracker/`, theme
 * `obsidian/DESIGN.md`). The v3 "three laws" (pure #000000 canvas,
 * monochrome) are SUPERSEDED — the reference is a zinc-based near-black
 * theme with a violet accent, not a monochrome one.
 *
 * The system:
 *  - Canvas #09090b (near-black, never pure black). Card surfaces step up
 *    the zinc scale: surfaceDeep #0c0c0f (inner rows, sheet-adjacent),
 *    surface #18181b (cards). Separation is border-based: 1px #27272a
 *    hairlines, minimal shadows.
 *  - Violet accent #a78bfa (tabs, links, toggles, selection, small
 *    highlights); accentDeep #7c3aed (FAB fill, full-width violet CTAs —
 *    the reference's deeper violet for primary action surfaces).
 *  - Cards: surface fill + 1px hairline border + 16–20px radius
 *    (screenshots overrule DESIGN.md's 8px). Pills fully rounded.
 *  - Text: #fafafa primary, #a1a1aa secondary, #71717a muted.
 *  - Success emerald #34d399 (pill bg #bbf7d0), danger #ef4444.
 *  - The Orb keeps its color (product soul — dawn/ember/tide stay).
 *
 * Font: SF system on native (automatic). Stitch's Geist is web-only and
 * unlicensed for bundling — no custom font is loaded, ever.
 *
 * Appearance-aware: `useTheme()` returns the dark (Stitch) or light
 * (functional inverse; dark-first product) set. New code must go through
 * `useTheme()`; screens not yet reskinned still compile and read dark.
 *
 * RULE: a hex literal inside any component is a bug — every color comes
 * from this module (via `useTheme()` for appearance-aware code).
 */

export type ColorScheme = 'light' | 'dark';
export type AppearanceSetting = 'light' | 'dark' | 'system';

export interface ThemeColors {
  /** Near-black canvas (dark) / inverse (light). */
  background: string;
  /** Inverse canvas — the inverted primary-button (white pill) fill. */
  inverted: string;
  /** Card surface — cards, inputs, grouped lists. */
  surface: string;
  /** One tier deeper — inner rows inside cards, deep wells. */
  surfaceDeep: string;
  /** Primary text, titles, button labels — full brightness. */
  text: string;
  /** Secondary text — captions, subtitles, descriptions. */
  metadata: string;
  /** Muted — tertiary text, placeholder-ish, least-emphasis labels. */
  muted: string;
  /** Hairline borders — 1px separation between tiers. */
  hairline: string;
  /** Violet — tabs, links, toggles, selection, icon highlights. */
  accent: string;
  /** Deep violet — FAB fill, full-width violet CTA fills. */
  accentDeep: string;
  /** Soft accent wash — selected pills, focus tints. */
  accentSoft: string;
  /** Content drawn on the accent (switch thumbs, selected chips). */
  onAccent: string;
  /** Drop-shadow color (pure black, both appearances). */
  shadow: string;
  success: string;
  /** Light emerald — success pill backgrounds. */
  successSoft: string;
  /** Translucent emerald wash — soft success pills on dark surfaces
      (the reference's emerald pill tint). Pairs with `success` text. */
  successDim: string;
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
 * free; ember + tide premium), elevated by the 5-layer rendering.
 * Exported for the legacy components/Orb.tsx and the v3 components/orb/Orb
 * (which renders the violet `dawn` story — the Orb's v3 color).
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
  accent: '#a78bfa', // Stitch violet — tabs, links, toggles, selection
  accentDeep: '#7c3aed', // deep violet — FAB fill, violet CTA fills
  accentSoft: 'rgba(167,139,250,0.16)',
  success: '#34d399', // emerald
  successSoft: '#bbf7d0', // light emerald — success pill backgrounds
  successDim: 'rgba(52,211,153,0.15)', // translucent emerald wash — soft pills
  warning: '#FF9F0A', // iOS system orange
  danger: '#ef4444', // Stitch red — errors only
  /** Content drawn on the accent (switch thumbs, selected chips). */
  onAccent: '#FFFFFF',
  /** Drop-shadow color (pure black, both appearances). */
  shadow: '#000000',
  orb,
} as const;

const darkColors: ThemeColors = {
  background: '#09090b',
  inverted: '#fafafa',
  surface: '#18181b',
  surfaceDeep: '#0c0c0f',
  text: '#fafafa',
  metadata: '#a1a1aa',
  muted: '#71717a',
  hairline: '#27272a',
  ...shared,
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  inverted: '#09090b',
  surface: '#F2F2F7',
  surfaceDeep: '#E9E9EC',
  text: '#09090b',
  metadata: '#71717a',
  muted: '#a1a1aa',
  hairline: '#E4E4E7',
  ...shared,
};

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

export const dark: Theme = { scheme: 'dark', colors: darkColors };
export const light: Theme = { scheme: 'light', colors: lightColors };

/**
 * Share-card art — the premium dark milestone card (Phase 7, Stitch
 * share_card reference). Hex lives here, never in the component.
 * `classic` is the free obsidian-violet card; `noir` is the premium
 * black-gold card. Content stays honest: no attestation theater.
 */
export const shareCardThemes = {
  classic: {
    gradient: ['#16121f', '#0b0b0e', '#141021'],
    number: '#fafafa',
    accent: '#a78bfa',
    wordmark: '#8a86a0',
    body: '#a1a1aa',
  },
  noir: {
    gradient: ['#050505', '#0a0a0a', '#050505'],
    number: '#f5eedd',
    accent: '#d4af6a',
    wordmark: '#8a7f66',
    body: '#8a7f66',
  },
} as const;

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
 * sm 8 — chips, small buttons · md 12 — text fields, small cards ·
 * lg 16 — cards · xl 20 — cards, sheets · pill — full-round pills/CTAs.
 *
 * Stitch rule: cards 16–20px (screenshots overrule DESIGN.md's 8px);
 * pills fully rounded.
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
  /** Tabular numerals for every counter, timer, and money readout. Spreads into Text styles. */
  tabular: {
    fontVariant: ['tabular-nums'] as unknown as import('react-native').FontVariant[],
  },
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
  /**
   * Orb v2 breathing — the one sanctioned ambient motion (plan §5):
   * 6s loop, scale 1↔peakScale, plus a shimmerDelta opacity shimmer on the
   * inner glow. Fully static under Reduce Motion.
   */
  breathe: { periodMs: 6000, peakScale: 1.04, shimmerDelta: 0.12 },
} as const;

// ---------------------------------------------------------------------------
// Legacy compatibility (pre-redesign screens, reskinned in later phases).
// `colors` resolves to the DARK Stitch set so un-migrated screens keep
// compiling and read as Stitch dark. New code must use `useTheme()`.
// ---------------------------------------------------------------------------

/** @deprecated — use `useTheme()` from theme/useTheme instead. */
export const colors = {
  background: '#09090b',
  backgroundElevated: '#18181b',
  backgroundElement: '#18181b',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  accent: '#a78bfa',
  accentDeep: '#7c3aed',
  accentSoft: 'rgba(167,139,250,0.16)',
  success: '#34d399',
  successSoft: '#bbf7d0',
  warning: '#FF9F0A',
  danger: '#ef4444',
  hairline: '#27272a',
  hairlineStrong: '#27272a',
  orb: { ...orb },
} as const;

export type Colors = typeof colors;
