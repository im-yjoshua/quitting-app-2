/**
 * statsChart.test.ts — bucketing for the v3 Stats charts (pure logic).
 *
 * Bar chart = clean-day share per bucket, monochrome.
 * Craving line = average rated craving per bucket (1–5), null when unrated.
 *
 * TZ is pinned by the `npm test` script (cross-env TZ=America/New_York).
 */
import { MS_PER_DAY } from '../services/chronometerEngine';
import {
  buildStatsChart,
  type StatsRange,
} from '../src/lib/chartData';

const DAY = MS_PER_DAY;
// Fixed "now": 2026-09-27 12:00 local (TZ pinned to America/New_York).
const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();

function startDaysAgo(n: number, extraHours = 0): string {
  return new Date(NOW - n * DAY - extraHours * 3_600_000).toISOString();
}

interface Entry {
  dayKey: string;
  craving: number | null;
  createdAt: string;
}

function makeEntry(daysAgo: number, craving: number | null): Entry {
  const ms = NOW - daysAgo * DAY;
  const d = new Date(ms);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dayKey: key, craving, createdAt: new Date(ms).toISOString() };
}

function relapse(daysAgo: number): { date: string } {
  return { date: new Date(NOW - daysAgo * DAY).toISOString() };
}

describe('buildStatsChart — week range', () => {
  it('returns 7 day buckets, oldest → newest, all clean when no relapses', () => {
    const buckets = buildStatsChart('week', startDaysAgo(30), [], [], NOW);
    expect(buckets).toHaveLength(7);
    for (const b of buckets) {
      expect(b.cleanRatio).toBe(1);
    }
    // Labels are day-of-month numbers, ordered oldest first.
    const labels = buckets.map((b) => b.label);
    expect(labels[0]).toBe(String(new Date(NOW - 6 * DAY).getDate()));
    expect(labels[6]).toBe(String(new Date(NOW).getDate()));
  });

  it('marks relapse days as 0', () => {
    const buckets = buildStatsChart(
      'week',
      startDaysAgo(30),
      [relapse(1)],
      [],
      NOW
    );
    // Buckets are oldest → newest; relapse was yesterday (index 5).
    expect(buckets[5].cleanRatio).toBe(0);
    expect(buckets[6].cleanRatio).toBe(1);
  });

  it('excludes pre-start (pending) days from the ratio', () => {
    // Quit started 3 days ago; the older buckets have no active days.
    const buckets = buildStatsChart('week', startDaysAgo(3), [], [], NOW);
    expect(buckets[0].cleanRatio).toBeNull(); // 6 days ago, pre-start
    expect(buckets[6].cleanRatio).toBe(1); // today
  });

  it('computes per-day average craving, null when unrated', () => {
    const buckets = buildStatsChart(
      'week',
      startDaysAgo(30),
      [],
      [makeEntry(0, 4), makeEntry(0, 2), makeEntry(1, 5), makeEntry(2, null)],
      NOW
    );
    expect(buckets[6].craving).toBe(3); // today: (4+2)/2
    expect(buckets[5].craving).toBe(5); // yesterday
    expect(buckets[4].craving).toBeNull(); // rated null
    expect(buckets[0].craving).toBeNull(); // no entries
  });
});

describe('buildStatsChart — month range', () => {
  it('returns 4 weekly buckets with clean-day shares', () => {
    const buckets = buildStatsChart(
      'month',
      startDaysAgo(60),
      [relapse(3)],
      [],
      NOW
    );
    expect(buckets).toHaveLength(4);
    // Newest week contains 1 slip in 7 days → 6/7.
    const newest = buckets[3];
    expect(newest.cleanRatio).toBeCloseTo(6 / 7, 6);
    expect(buckets[0].cleanRatio).toBe(1);
  });

  it('averages craving across the week bucket', () => {
    const buckets = buildStatsChart(
      'month',
      startDaysAgo(60),
      [],
      [makeEntry(0, 5), makeEntry(3, 1), makeEntry(10, 2)],
      NOW
    );
    expect(buckets[3].craving).toBe(3); // (5+1)/2 in newest week
    expect(buckets[2].craving).toBe(2);
  });
});

describe('buildStatsChart — all time range', () => {
  it('groups by calendar month, capped at 12', () => {
    // Quit 400 days ago → more than 12 months; keep the most recent 12.
    const buckets = buildStatsChart('all', startDaysAgo(400), [], [], NOW);
    expect(buckets.length).toBeLessThanOrEqual(12);
    expect(buckets.length).toBeGreaterThan(6);
    const last = buckets[buckets.length - 1];
    expect(last.label).toBe('Sep'); // NOW is 2026-09-27
    expect(last.cleanRatio).toBe(1);
  });

  it('accounts relapse days inside a month bucket', () => {
    const buckets = buildStatsChart(
      'all',
      startDaysAgo(60),
      [relapse(40)],
      [],
      NOW
    );
    // A month with one slip has a ratio strictly below 1.
    const august = buckets.find((b) => b.label === 'Aug');
    expect(august).toBeDefined();
    expect(august!.cleanRatio).toBeLessThan(1);
    expect(august!.cleanRatio).toBeGreaterThan(0.8);
  });

  it('counts only streak-active days in the month denominator', () => {
    // Quit 10 days ago (mid-September); September's denominator skips
    // the pre-start days.
    const buckets = buildStatsChart('all', startDaysAgo(10), [], [], NOW);
    const september = buckets[buckets.length - 1];
    expect(september.label).toBe('Sep');
    expect(september.cleanRatio).toBe(1);
  });
});

describe('buildStatsChart — range sanity', () => {
  const ranges: StatsRange[] = ['week', 'month', 'all'];
  it.each(ranges)('never returns null ratios when the streak covers days (%s)', (range) => {
    const buckets = buildStatsChart(range, startDaysAgo(30), [], [], NOW);
    expect(buckets.length).toBeGreaterThan(0);
    for (const b of buckets) {
      expect(b.cleanRatio).not.toBeNull();
    }
  });
});
