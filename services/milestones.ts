/**
 * milestones.ts — pure milestone detection (spec §1, §2.6).
 *
 * Detection runs on app foreground, after midnight rollover, and after
 * relapse (wired in hooks/useMilestoneCelebration). Each milestone fires
 * the celebration sheet exactly ONCE: detect → show → mark seen.
 * After a relapse, milestonesSeen is pruned (services/relapse.ts), so
 * higher milestones are honestly re-earned.
 */
export const MILESTONES: readonly number[] = [1, 3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Milestones the user has reached (cleanDays >= milestone) that have not
 * yet been celebrated. Returned in ascending order.
 */
export function detectNewMilestones(
  cleanDays: number,
  milestonesSeen: readonly number[]
): number[] {
  const seen = new Set(milestonesSeen);
  const days = Math.max(0, Math.floor(cleanDays));
  return MILESTONES.filter((m) => m <= days && !seen.has(m));
}

/**
 * Next milestone strictly above the current day count, or null when the
 * user has passed 365.
 */
export function nextMilestone(cleanDays: number): number | null {
  const days = Math.max(0, Math.floor(cleanDays));
  for (const m of MILESTONES) {
    if (m > days) return m;
  }
  return null;
}

/** Pure merge: union of previously-seen and newly-celebrated, sorted. */
export function markMilestonesSeenPure(
  prev: readonly number[],
  newlySeen: readonly number[]
): number[] {
  return Array.from(new Set([...prev, ...newlySeen])).sort((a, b) => a - b);
}
