/**
 * savings.test.ts — money/time math incl. zero-cost and fractional days,
 * formatting, and the 12-week clean-day heatmap.
 *
 * TZ is pinned by the `npm test` script (cross-env TZ=America/New_York).
 */
import {
  HEATMAP_DAYS,
  buildCleanHeatmap,
  cleanDaysFloor,
  formatMoney,
  formatTimeReclaimed,
  moneySaved,
  timeReclaimed,
} from '../services/savings';
import { MS_PER_DAY } from '../services/chronometerEngine';

const DAY = MS_PER_DAY;
// Fixed "now": 2026-09-27 12:00 local (TZ pinned to America/New_York).
const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();

function startDaysAgo(n: number, extraHours = 0): string {
  return new Date(NOW - n * DAY - extraHours * 3_600_000).toISOString();
}

describe('cleanDaysFloor', () => {
  it('floors fractional days (23h → 0)', () => {
    expect(cleanDaysFloor(startDaysAgo(0, 23), NOW)).toBe(0);
  });

  it('counts whole days', () => {
    expect(cleanDaysFloor(startDaysAgo(47), NOW)).toBe(47);
  });

  it('clamps future starts to 0', () => {
    expect(cleanDaysFloor(new Date(NOW + DAY).toISOString(), NOW)).toBe(0);
  });

  it('returns 0 for garbage input', () => {
    expect(cleanDaysFloor('not-a-date', NOW)).toBe(0);
  });
});

describe('moneySaved', () => {
  it('multiplies daily cost by clean days', () => {
    expect(moneySaved(10, 47)).toBe(470);
  });

  it('rounds to cents', () => {
    expect(moneySaved(2.5, 47)).toBe(117.5);
    expect(moneySaved(3.333, 3)).toBe(10);
  });

  it('zero daily cost → 0 (skip = allowed)', () => {
    expect(moneySaved(0, 47)).toBe(0);
  });

  it('negative/NaN cost is treated as 0, never NaN', () => {
    expect(moneySaved(-5, 47)).toBe(0);
    expect(moneySaved(NaN, 47)).toBe(0);
    expect(Number.isNaN(moneySaved(NaN, 47))).toBe(false);
  });
});

describe('timeReclaimed', () => {
  it('converts daily minutes × days to hours/minutes', () => {
    expect(timeReclaimed(60, 47)).toEqual({ hours: 47, minutes: 0 });
    expect(timeReclaimed(90, 2)).toEqual({ hours: 3, minutes: 0 });
    expect(timeReclaimed(45, 3)).toEqual({ hours: 2, minutes: 15 });
  });

  it('zero daily minutes → 0h 0m', () => {
    expect(timeReclaimed(0, 47)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('formatting', () => {
  it('formatMoney renders dollars and cents', () => {
    expect(formatMoney(470)).toBe('$470.00');
    expect(formatMoney(117.5)).toBe('$117.50');
    expect(formatMoney(1234.56)).toBe('$1,234.56');
  });

  it('formatTimeReclaimed switches to days at 24h+', () => {
    expect(formatTimeReclaimed(2, 15)).toBe('2h 15m');
    expect(formatTimeReclaimed(47, 0)).toBe('1d 23h');
  });
});

describe('buildCleanHeatmap', () => {
  it('returns 84 days, oldest → newest, ending today', () => {
    const heat = buildCleanHeatmap(startDaysAgo(50), [], NOW);
    expect(heat).toHaveLength(HEATMAP_DAYS);
    expect(heat[0].key < heat[HEATMAP_DAYS - 1].key).toBe(true);
  });

  it('marks days since start as clean', () => {
    const heat = buildCleanHeatmap(startDaysAgo(10), [], NOW);
    const last = heat[HEATMAP_DAYS - 1];
    expect(last.status).toBe('clean');
    expect(heat[HEATMAP_DAYS - 11].status).toBe('clean');
  });

  it('marks days before the current start as pending (old streaks not shown)', () => {
    const heat = buildCleanHeatmap(startDaysAgo(10), [], NOW);
    expect(heat[0].status).toBe('pending');
  });

  it('marks relapse days as slip', () => {
    const relapseLog = [
      { date: new Date(NOW - 3 * DAY).toISOString(), daysCleanBefore: 40 },
    ];
    const heat = buildCleanHeatmap(startDaysAgo(3), relapseLog, NOW);
    const slip = heat[HEATMAP_DAYS - 4];
    expect(slip.status).toBe('slip');
    expect(heat[HEATMAP_DAYS - 1].status).toBe('clean');
  });

  it('ignores relapse entries with garbage dates', () => {
    const heat = buildCleanHeatmap(startDaysAgo(10), [
      { date: 'garbage', daysCleanBefore: 5 },
    ], NOW);
    expect(heat.every((d) => d.status !== 'slip')).toBe(true);
  });

  it('a fresh day-0 streak shows today as slip when the relapse was today', () => {
    const relapseLog = [{ date: new Date(NOW).toISOString(), daysCleanBefore: 47 }];
    const heat = buildCleanHeatmap(new Date(NOW).toISOString(), relapseLog, NOW);
    expect(heat[HEATMAP_DAYS - 1].status).toBe('slip');
  });
});
