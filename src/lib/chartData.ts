/**
 * chartData.ts — pure bucketing for the v3 Stats charts.
 *
 * The Stats screen renders its bar chart and craving line from plain Views;
 * this module maps raw state → render-ready buckets (no UI code here):
 *
 * - `cleanRatio` (0..1): share of streak-active days in the bucket that are
 *   clean. Days before the current quit start are "pending" and excluded
 *   from the denominator; `null` means the bucket has no active days at all.
 * - `craving` (1..5): average rated craving across the bucket's journal
 *   entries; `null` when nothing was rated.
 *
 * Bucket shapes:
 * - week:  last 7 days, one bucket per day (oldest → newest)
 * - month: last 28 days, four weekly buckets (oldest → newest)
 * - all:   calendar months from quit start to now, capped at the 12 newest
 */
import { getLocalDateKey, MS_PER_DAY } from '../../services/chronometerEngine';

export type StatsRange = 'week' | 'month' | 'all';

export interface StatsBucket {
  /** Unique key (stable across re-renders for the same window). */
  key: string;
  /** X-axis label — weekday/day-of-month, M/D, or month name. */
  label: string;
  /** Clean-day share, 0..1; null when the bucket has no active days. */
  cleanRatio: number | null;
  /** Average craving 1..5; null when nothing was rated. */
  craving: number | null;
}

interface DayLike {
  date: string;
}

interface JournalLike {
  dayKey: string;
  craving: number | null;
}

interface DayRange {
  key: string;
  label: string;
  dayKeys: string[];
}

const DAY = MS_PER_DAY;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function relapseKeysOf(relapseLog: DayLike[]): Set<string> {
  const keys = new Set<string>();
  for (const e of relapseLog) {
    const ms = Date.parse(e.date);
    if (!isNaN(ms)) keys.add(getLocalDateKey(ms));
  }
  return keys;
}

/** Local-midnight ms for `nowMs`, then the day offset back. */
function dayStartMs(nowMs: number, daysAgo: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * DAY;
}

function bucketize(
  ranges: DayRange[],
  startKey: string | null,
  slipKeys: Set<string>,
  journal: JournalLike[]
): StatsBucket[] {
  const cravingByDay = new Map<string, number[]>();
  for (const j of journal) {
    if (j.craving !== null && j.craving !== undefined) {
      const list = cravingByDay.get(j.dayKey) ?? [];
      list.push(j.craving);
      cravingByDay.set(j.dayKey, list);
    }
  }

  return ranges.map(({ key, label, dayKeys }) => {
    // Only streak-active days (on/after the current quit start) count.
    const active = startKey === null
      ? []
      : dayKeys.filter((k) => k >= startKey);
    if (active.length === 0) {
      return { key, label, cleanRatio: null, craving: null };
    }
    const clean = active.filter((k) => !slipKeys.has(k)).length;
    const ratings = active.flatMap((k) => cravingByDay.get(k) ?? []);
    const craving =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;
    return {
      key,
      label,
      cleanRatio: clean / active.length,
      craving,
    };
  });
}

function weekRanges(nowMs: number): DayRange[] {
  const ranges: DayRange[] = [];
  for (let i = 6; i >= 0; i--) {
    const ms = dayStartMs(nowMs, i);
    const key = getLocalDateKey(ms);
    ranges.push({
      key,
      label: String(new Date(ms).getDate()),
      dayKeys: [key],
    });
  }
  return ranges;
}

function monthRanges(nowMs: number): DayRange[] {
  // Four weekly buckets over the last 28 days, oldest → newest.
  const ranges: DayRange[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = dayStartMs(nowMs, (w + 1) * 7 - 1);
    const dayKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const ms = start + i * DAY;
      if (ms > dayStartMs(nowMs, 0) + DAY - 1) break;
      dayKeys.push(getLocalDateKey(ms));
    }
    const first = new Date(start);
    ranges.push({
      key: getLocalDateKey(start),
      label: `${first.getMonth() + 1}/${first.getDate()}`,
      dayKeys,
    });
  }
  return ranges;
}

function allRanges(nowMs: number) {
  // Calendar months from quit month to the current month (cap: 12 newest).
  const now = new Date(nowMs);
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    months.unshift({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  const ranges = months.map(({ year, month }) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dayKeys: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const ms = new Date(year, month, d).getTime();
      // Skip days in the future (the current month).
      if (ms > nowMs) break;
      dayKeys.push(getLocalDateKey(ms));
    }
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: MONTH_NAMES[month],
      dayKeys,
    };
  });
  return ranges.filter((r) => r.dayKeys.length > 0);
}

export function buildStatsChart(
  range: StatsRange,
  startDateIso: string,
  relapseLog: DayLike[],
  journal: JournalLike[],
  nowMs: number
): StatsBucket[] {
  const startMs = Date.parse(startDateIso);
  const startKey = isNaN(startMs) ? null : getLocalDateKey(startMs);
  const slipKeys = relapseKeysOf(relapseLog);
  const ranges =
    range === 'week'
      ? weekRanges(nowMs)
      : range === 'month'
        ? monthRanges(nowMs)
        : allRanges(nowMs);
  const buckets = bucketize(ranges, startKey, slipKeys, journal);
  if (range === 'all') {
    // Drop months fully before the streak (all-null) at the start.
    const firstActive = buckets.findIndex((b) => b.cleanRatio !== null);
    if (firstActive > 0) return buckets.slice(firstActive);
  }
  return buckets;
}
