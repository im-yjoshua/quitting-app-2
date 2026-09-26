/**
 * Pledge logic — pure functions, fully unit-tested.
 *
 * Rules (spec §1):
 * - Pledging twice on the same local day is a no-op.
 * - pledgeStreak increments only on CONSECUTIVE local day keys.
 * - A missed day resets pledgeStreak to 0 — the CLEAN streak is NEVER
 *   touched by pledge state (this module doesn't even know about it).
 * - Pledging is allowed any time during the day (no "too late" shame).
 * - All boundaries use LOCAL midnight, not UTC.
 */
import { getLocalDateKey } from './chronometerEngine';
import type { PledgeState } from '../types/app';

export const INITIAL_PLEDGE_STATE: PledgeState = {
  lastPledgeDayKey: null,
  pledgeStreak: 0,
};

/** Local-midnight epoch ms for a "YYYY-MM-DD" day key. */
function dayKeyToLocalMidnightMs(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * Whole days between two local day keys (laterKey - earlierKey).
 * Math.round absorbs DST 23h/25h days.
 */
export function daysBetweenDayKeys(
  laterKey: string,
  earlierKey: string
): number {
  const ms =
    dayKeyToLocalMidnightMs(laterKey) - dayKeyToLocalMidnightMs(earlierKey);
  return Math.round(ms / 86_400_000);
}

export interface PledgeResult {
  /** The resulting pledge state (unchanged object on no-op). */
  state: PledgeState;
  /** True when this call actually recorded a pledge. */
  pledged: boolean;
}

/**
 * Records a pledge for the local day containing nowMs.
 * Returns pledged=false with the identical state object on double-pledge.
 */
export function pledgeToday(
  prev: PledgeState,
  nowMs: number
): PledgeResult {
  const todayKey = getLocalDateKey(nowMs);
  if (prev.lastPledgeDayKey === todayKey) {
    return { state: prev, pledged: false };
  }
  const consecutive =
    prev.lastPledgeDayKey !== null &&
    daysBetweenDayKeys(todayKey, prev.lastPledgeDayKey) === 1;
  return {
    state: {
      lastPledgeDayKey: todayKey,
      pledgeStreak: consecutive ? prev.pledgeStreak + 1 : 1,
    },
    pledged: true,
  };
}

/**
 * Call on app foreground. When at least one full calendar day has passed
 * since the last pledge without one, the pledge streak resets to 0.
 * The lastPledgeDayKey is kept so the UI can show "you missed yesterday".
 */
export function applyMissedPledgeReset(
  prev: PledgeState,
  nowMs: number
): PledgeState {
  if (prev.lastPledgeDayKey === null) return prev;
  const todayKey = getLocalDateKey(nowMs);
  if (prev.lastPledgeDayKey === todayKey) return prev;
  if (daysBetweenDayKeys(todayKey, prev.lastPledgeDayKey) >= 2) {
    return { lastPledgeDayKey: prev.lastPledgeDayKey, pledgeStreak: 0 };
  }
  return prev;
}

/** True when the user has already pledged on the local day containing nowMs. */
export function hasPledgedToday(
  state: PledgeState,
  nowMs: number
): boolean {
  return state.lastPledgeDayKey === getLocalDateKey(nowMs);
}
