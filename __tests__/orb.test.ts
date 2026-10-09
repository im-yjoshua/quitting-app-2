/**
 * Orb v2 — Phase 2 (v3 redesign) pure-logic tests.
 *
 * Covers the streak-reactive presentation math in components/orb/logic.ts:
 * the radiance curve (day count → glow intensity), the desaturation curve
 * (day-0 gray → color bloom), and the per-layer glow opacity mapping.
 * (Presentation-only: no react-native imports here — node env.)
 */
import {
  orbDesaturation,
  orbGlow,
  orbRadiance,
} from '../components/orb/logic';

describe('orbRadiance', () => {
  it('is 0 at day 0 (dormant)', () => {
    expect(orbRadiance(0)).toBe(0);
  });

  it('clamps negative days to 0', () => {
    expect(orbRadiance(-5)).toBe(0);
  });

  it('is ~0.63 at 30 days', () => {
    expect(orbRadiance(30)).toBeCloseTo(0.6321, 4);
  });

  it('is ~0.95 at 90 days', () => {
    expect(orbRadiance(90)).toBeCloseTo(0.9502, 4);
  });

  it('grows monotonically and never exceeds 1', () => {
    const days = [0, 1, 7, 30, 60, 90, 180, 365, 1000];
    const values = days.map(orbRadiance);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('orbDesaturation', () => {
  it('is 1 at day 0 (fully desaturated gray)', () => {
    expect(orbDesaturation(0)).toBe(1);
  });

  it('clamps negative days to 1', () => {
    expect(orbDesaturation(-3)).toBe(1);
  });

  it('is ~0.37 at 12 days ("warm glow" gate)', () => {
    expect(orbDesaturation(12)).toBeCloseTo(0.3679, 4);
  });

  it('is ~0.00055 at 90 days (full color)', () => {
    expect(orbDesaturation(90)).toBeCloseTo(0.000553, 6);
  });

  it('decays monotonically toward 0', () => {
    const days = [0, 1, 7, 12, 30, 60, 90, 365];
    const values = days.map(orbDesaturation);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });
});

describe('orbGlow', () => {
  it('every channel is monotonic non-decreasing with the streak', () => {
    const days = [0, 1, 7, 30, 60, 90, 180, 365];
    const channels = days.map((d) => orbGlow(d));
    const keys = ['ring', 'inner', 'specular', 'rim'] as const;
    for (const key of keys) {
      for (let i = 1; i < channels.length; i += 1) {
        expect(channels[i][key]).toBeGreaterThanOrEqual(channels[i - 1][key]);
      }
    }
  });

  it('day 0 is dim but visible, long streaks are luminous', () => {
    const dim = orbGlow(0);
    const bright = orbGlow(365);
    for (const key of ['ring', 'inner', 'specular', 'rim'] as const) {
      expect(dim[key]).toBeGreaterThan(0);
      expect(bright[key]).toBeGreaterThan(dim[key]);
      expect(bright[key]).toBeLessThanOrEqual(1);
    }
  });

  it('stays bounded in [0, 1] for extreme inputs', () => {
    for (const d of [-100, 0, 365, 100000]) {
      const g = orbGlow(d);
      for (const key of ['ring', 'inner', 'specular', 'rim'] as const) {
        expect(g[key]).toBeGreaterThanOrEqual(0);
        expect(g[key]).toBeLessThanOrEqual(1);
      }
    }
  });
});
