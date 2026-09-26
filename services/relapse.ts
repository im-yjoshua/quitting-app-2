/**
 * Relapse logic — pure functions, fully unit-tested.
 *
 * Rules (spec §1):
 * - On relapse → append RelapseEntry{daysCleanBefore}
 * - longestStreakDays = max(longestStreakDays, daysCleanBefore)
 * - totalRelapses++
 * - startDate = now (a new Day 0, logged honestly)
 * - milestonesSeen keeps values ≤ the new streak only — higher milestones
 *   are re-earned later, and they feel earned twice.
 *
 * Tone rules (enforced by the screen, kept out of here): no "failed",
 * no identity-shaming, no red/error styling.
 */
import { MS_PER_DAY } from './chronometerEngine';
import type { AppState, Quit, RelapseEntry } from '../types/app';

/**
 * Whole clean days banked before the slip. Uses the same floor-of-days
 * math as Home's `DAY n` label, so the confirmation sheet agrees with it.
 */
export function daysCleanBefore(
  startDateIso: string,
  nowMs: number
): number {
  return Math.max(
    0,
    Math.floor((nowMs - Date.parse(startDateIso)) / MS_PER_DAY)
  );
}

export interface RelapseApplication {
  state: AppState;
  entry: RelapseEntry;
  /** The longest streak BEFORE this relapse — for the compassion screen. */
  previousLongestStreakDays: number;
}

/**
 * Applies a relapse to the state. Throws when there is no active quit —
 * the relapse screen is only reachable from Home with a quit in place.
 */
export function applyRelapse(
  prev: AppState,
  nowMs: number,
  note?: string
): RelapseApplication {
  const quit: Quit | null = prev.quit;
  if (!quit) {
    throw new Error('Cannot log a relapse with no active quit');
  }

  const cleanDays = daysCleanBefore(quit.startDate, nowMs);
  const trimmed = note?.trim();
  const entry: RelapseEntry = {
    date: new Date(nowMs).toISOString(),
    daysCleanBefore: cleanDays,
    ...(trimmed ? { note: trimmed } : {}),
  };

  const nextQuit: Quit = {
    ...quit,
    startDate: new Date(nowMs).toISOString(),
    longestStreakDays: Math.max(quit.longestStreakDays, cleanDays),
    totalRelapses: quit.totalRelapses + 1,
  };

  // The new streak is 0 days, so every celebrated milestone (> 0) drops out
  // and can be re-earned. Written generally against the new streak length.
  const newStreakDays = 0;

  return {
    state: {
      ...prev,
      quit: nextQuit,
      relapseLog: [...prev.relapseLog, entry],
      milestonesSeen: prev.milestonesSeen.filter((m) => m <= newStreakDays),
    },
    entry,
    previousLongestStreakDays: quit.longestStreakDays,
  };
}
