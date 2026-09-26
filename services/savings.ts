/**
 * savings.ts — pure stats math for the Stats tab (spec §2.5).
 *
 * - Money saved: dailyCost × cleanDays (floor-of-days, matches Home's DAY n).
 * - Time reclaimed: dailyMinutes × cleanDays.
 * - Zero-cost / zero-minutes users are first-class: everything returns 0,
 *   never NaN or a crash.
 * - Heatmap: last 12 weeks of clean-day cells derived from the current
 *   streak start + the relapse log. Days before the current startDate are
 *   'pending' (not part of this streak); relapse days are 'slip'.
 */
import { MS_PER_DAY, getLocalDateKey } from './chronometerEngine';
import type { RelapseEntry } from '../types/app';

export const HEATMAP_WEEKS = 12;
export const HEATMAP_DAYS = HEATMAP_WEEKS * 7; // 84

/** Whole clean days, floored — the same number Home shows as "DAY n". */
export function cleanDaysFloor(startDateIso: string, nowMs: number): number {
  const startMs = Date.parse(startDateIso);
  if (isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / MS_PER_DAY));
}

/** Money saved, rounded to cents. Zero daily cost → 0, never NaN. */
export function moneySaved(dailyCost: number, cleanDays: number): number {
  const cost = isFinite(dailyCost) && dailyCost > 0 ? dailyCost : 0;
  const days = Math.max(0, Math.floor(cleanDays));
  return Math.round(cost * days * 100) / 100;
}

/** Time reclaimed, split for display. Zero daily minutes → 0h 0m. */
export function timeReclaimed(
  dailyMinutes: number,
  cleanDays: number
): { hours: number; minutes: number } {
  const mins = isFinite(dailyMinutes) && dailyMinutes > 0 ? dailyMinutes : 0;
  const days = Math.max(0, Math.floor(cleanDays));
  const totalMinutes = Math.round(mins * days);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function formatMoney(amount: number): string {
  const safe = isFinite(amount) ? amount : 0;
  return (
    '$' +
    safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatTimeReclaimed(hours: number, minutes: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `${days}d ${h}h`;
  }
  return `${hours}h ${minutes}m`;
}

export type HeatDayStatus = 'clean' | 'slip' | 'pending';

export interface HeatDay {
  /** Local YYYY-MM-DD */
  key: string;
  status: HeatDayStatus;
}

/**
 * 12-week clean-day heatmap, oldest → newest.
 * Only the CURRENT streak is shown: days before startDate are 'pending',
 * relapse days are 'slip', everything else since start is 'clean'.
 */
export function buildCleanHeatmap(
  startDateIso: string,
  relapseLog: RelapseEntry[],
  nowMs: number
): HeatDay[] {
  const startMs = Date.parse(startDateIso);
  const startKey = isNaN(startMs) ? null : getLocalDateKey(startMs);
  const relapseKeys = new Set(
    relapseLog
      .map((e) => {
        const ms = Date.parse(e.date);
        return isNaN(ms) ? null : getLocalDateKey(ms);
      })
      .filter((k): k is string => k !== null)
  );

  const days: HeatDay[] = [];
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * MS_PER_DAY);
    const key = getLocalDateKey(d.getTime());
    let status: HeatDayStatus = 'pending';
    if (startKey !== null && key >= startKey) {
      status = relapseKeys.has(key) ? 'slip' : 'clean';
    }
    days.push({ key, status });
  }
  return days;
}
