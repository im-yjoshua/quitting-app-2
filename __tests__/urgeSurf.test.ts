/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Urge Surf session math — services/urgeSurf.ts (spec §2.3).
// ---------------------------------------------------------------------------

import {
  BREATH_CYCLE_S,
  BREATH_HOLD_S,
  BREATH_IN_S,
  BREATH_OUT_S,
  URGE_SURF_DURATION_S,
  URGE_SURF_EARLY_EXIT_S,
  breathPhaseAt,
  breathPhaseDurationSec,
  breathPhaseLabel,
} from '../services/urgeSurf';

describe('breath phases', () => {
  it('in 4s / hold 4s / out 6s = 14s cycle', () => {
    expect(BREATH_IN_S + BREATH_HOLD_S + BREATH_OUT_S).toBe(BREATH_CYCLE_S);
    expect(BREATH_CYCLE_S).toBe(14);
  });

  it('starts in "in"', () => {
    expect(breathPhaseAt(0)).toBe('in');
    expect(breathPhaseAt(3.999)).toBe('in');
  });

  it('holds from 4s to 8s', () => {
    expect(breathPhaseAt(4)).toBe('hold');
    expect(breathPhaseAt(7.999)).toBe('hold');
  });

  it('breathes out from 8s to 14s', () => {
    expect(breathPhaseAt(8)).toBe('out');
    expect(breathPhaseAt(13.999)).toBe('out');
  });

  it('wraps into the next cycle at 14s', () => {
    expect(breathPhaseAt(14)).toBe('in');
    expect(breathPhaseAt(28.5)).toBe('in');
  });

  it('is mid-cycle at session end (120s → 8s into a cycle → out)', () => {
    expect(breathPhaseAt(120)).toBe('out');
  });

  it('never goes negative on odd input', () => {
    expect(breathPhaseAt(-1)).toBe('out'); // wraps like 13s
  });
});

describe('phase labels and durations', () => {
  it('labels read naturally', () => {
    expect(breathPhaseLabel('in')).toBe('Breathe in');
    expect(breathPhaseLabel('hold')).toBe('Hold');
    expect(breathPhaseLabel('out')).toBe('Breathe out');
  });

  it('durations match the pattern', () => {
    expect(breathPhaseDurationSec('in')).toBe(4);
    expect(breathPhaseDurationSec('hold')).toBe(4);
    expect(breathPhaseDurationSec('out')).toBe(6);
  });
});

describe('session constants', () => {
  it('is a 2-minute session with early exit after 30s', () => {
    expect(URGE_SURF_DURATION_S).toBe(120);
    expect(URGE_SURF_EARLY_EXIT_S).toBe(30);
  });
});
