/**
 * Urge Surf — pure session math, fully unit-tested.
 *
 * The guided breathing pattern: in 4s / hold 4s / out 6s, one 14s cycle,
 * for a 120s session. The screen drives the Orb's scale off `breathPhaseAt`.
 */
export const URGE_SURF_DURATION_S = 120;
/** "I'm okay now" exit appears after this many seconds — no guilt copy. */
export const URGE_SURF_EARLY_EXIT_S = 30;

export const BREATH_IN_S = 4;
export const BREATH_HOLD_S = 4;
export const BREATH_OUT_S = 6;
export const BREATH_CYCLE_S = BREATH_IN_S + BREATH_HOLD_S + BREATH_OUT_S; // 14

export type BreathPhase = 'in' | 'hold' | 'out';

/** Which breath phase the session is in at `elapsedSec` seconds in. */
export function breathPhaseAt(elapsedSec: number): BreathPhase {
  const t =
    ((elapsedSec % BREATH_CYCLE_S) + BREATH_CYCLE_S) % BREATH_CYCLE_S;
  if (t < BREATH_IN_S) return 'in';
  if (t < BREATH_IN_S + BREATH_HOLD_S) return 'hold';
  return 'out';
}

export function breathPhaseLabel(phase: BreathPhase): string {
  switch (phase) {
    case 'in':
      return 'Breathe in';
    case 'hold':
      return 'Hold';
    case 'out':
      return 'Breathe out';
  }
}

/** Seconds the current phase lasts — for syncing the orb animation. */
export function breathPhaseDurationSec(phase: BreathPhase): number {
  switch (phase) {
    case 'in':
      return BREATH_IN_S;
    case 'hold':
      return BREATH_HOLD_S;
    case 'out':
      return BREATH_OUT_S;
  }
}
