/**
 * uiFoundation — Phase 1 (v3 redesign) foundation tests.
 *
 * Covers the pure logic behind components/ui: the GlassView fallback
 * ladder, the ProgressRing arc math, and the v3 token invariants.
 * (Presentation-only: no react-native imports here — node env.)
 */
import {
  clamp01,
  resolveGlassTier,
  ringAngles,
} from '../components/ui/logic';
import {
  dark,
  light,
  motion,
  radii,
  spacing,
  type as typeScale,
} from '../theme/tokens';

describe('resolveGlassTier', () => {
  const base = {
    reduceTransparency: false,
    glassEffectAvailable: false,
    blurAvailable: true,
  };

  it('prefers the native glass tier when available', () => {
    expect(
      resolveGlassTier({ ...base, glassEffectAvailable: true })
    ).toBe('glass');
  });

  it('falls back to blur when glass is unavailable', () => {
    expect(resolveGlassTier(base)).toBe('blur');
  });

  it('falls back to solid when blur is also unavailable', () => {
    expect(
      resolveGlassTier({ ...base, blurAvailable: false })
    ).toBe('solid');
  });

  it('Reduce Transparency forces solid even when glass is available', () => {
    expect(
      resolveGlassTier({
        ...base,
        reduceTransparency: true,
        glassEffectAvailable: true,
      })
    ).toBe('solid');
  });

  it('never resolves to "nothing" — solid is the terminal tier', () => {
    expect(
      resolveGlassTier({
        reduceTransparency: false,
        glassEffectAvailable: false,
        blurAvailable: false,
      })
    ).toBe('solid');
  });
});

describe('clamp01', () => {
  it('passes through in-range values', () => {
    expect(clamp01(0.42)).toBeCloseTo(0.42);
  });

  it('clamps out-of-range values', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(7)).toBe(1);
  });

  it('treats NaN as 0', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('ringAngles', () => {
  it('hides both halves at 0', () => {
    expect(ringAngles(0)).toEqual({ right: -180, left: -180 });
  });

  it('sweeps the right half over 0 → 0.5', () => {
    expect(ringAngles(0.25)).toEqual({ right: -90, left: -180 });
    expect(ringAngles(0.5)).toEqual({ right: 0, left: -180 });
  });

  it('sweeps the left half over 0.5 → 1', () => {
    expect(ringAngles(0.75)).toEqual({ right: 0, left: -90 });
    expect(ringAngles(1)).toEqual({ right: 0, left: 0 });
  });

  it('clamps out-of-range progress', () => {
    expect(ringAngles(-2)).toEqual(ringAngles(0));
    expect(ringAngles(2)).toEqual(ringAngles(1));
  });
});

describe('v3 token invariants', () => {
  it('accent is the v3 violet, confined to accent roles', () => {
    expect(dark.colors.accent).toBe('#BF5AF2');
    expect(light.colors.accent).toBe('#BF5AF2');
  });

  it('canvas is pure black / pure white', () => {
    expect(dark.colors.background).toBe('#000000');
    expect(light.colors.background).toBe('#FFFFFF');
    expect(dark.colors.text).toBe('#FFFFFF');
    expect(light.colors.text).toBe('#000000');
  });

  it('the one grey is reserved for grouped cards + inputs', () => {
    expect(dark.colors.surface).toBe('#1C1C1E');
    expect(light.colors.surface).toBe('#F2F2F7');
  });

  it('inverted primaries are the inverse canvas', () => {
    expect(dark.colors.inverted).toBe('#FFFFFF');
    expect(light.colors.inverted).toBe('#000000');
  });

  it('standard spring is damping 18 / stiffness 200', () => {
    expect(motion.standard).toEqual(
      expect.objectContaining({ damping: 18, stiffness: 200 })
    );
  });

  it('spacing stays on the 4/8 grid', () => {
    const values = Object.values(spacing);
    expect(values).toEqual([4, 8, 16, 24, 32, 48]);
    for (const v of values) expect(v % 4).toBe(0);
  });

  it('radii follow the Apple table', () => {
    expect(radii).toMatchObject({ sm: 8, md: 12, lg: 16, xl: 20 });
  });

  it('type scale: 34 Bold large title, 17 body, tabular numerals', () => {
    expect(typeScale.largeTitle.fontSize).toBe(34);
    expect(typeScale.largeTitle.fontWeight).toBe('700');
    expect(typeScale.body.fontSize).toBe(17);
    expect(typeScale.tabular.fontVariant).toContain('tabular-nums');
  });
});
