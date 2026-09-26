// TZ=America/New_York is set by the `test` script (via cross-env) so the
// "local vs UTC" assertions below are meaningful and deterministic on any machine.
/// <reference types="jest" />

import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  CIRCADIAN_BONUS_PER_DAY_MS,
  calculateCleanDurationMs,
  breakDownDuration,
  calculateConcentricDialMetrics,
  getLocalDateKey,
  calculateStreakTelemetry,
  calculateRelapseForfeiture,
} from '../services/chronometerEngine';
import type { CircadianDayRecord } from '../types/app';

const DAY = MS_PER_DAY;

function dayRecord(overrides: Partial<CircadianDayRecord> = {}): CircadianDayRecord {
  return {
    dateString: '2026-01-05',
    amCompleted: true,
    amCompletedAt: null,
    pmCompleted: true,
    pmCompletedAt: null,
    multiplierActive: true,
    ...overrides,
  };
}

describe('calculateCleanDurationMs', () => {
  test('returns elapsed ms for a valid window', () => {
    expect(calculateCleanDurationMs(1_000, 400)).toBe(600);
  });

  test('returns 0 when start equals now (day zero is honest)', () => {
    expect(calculateCleanDurationMs(1_000, 1_000)).toBe(0);
  });

  test('returns 0 for invalid inputs instead of NaN or negatives', () => {
    expect(calculateCleanDurationMs(500, 1_000)).toBe(0); // now before start
    expect(calculateCleanDurationMs(1_000, 0)).toBe(0); // unset start
    expect(calculateCleanDurationMs(1_000, -50)).toBe(0);
    expect(calculateCleanDurationMs(NaN, 100)).toBe(0);
    expect(calculateCleanDurationMs(100, NaN)).toBe(0);
  });
});

describe('breakDownDuration', () => {
  test('zero duration decomposes to all zeros', () => {
    const b = breakDownDuration(0);
    expect(b).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
    expect(b.formattedDays).toBe('00');
  });

  test('1d 1h 1m 1s decomposes correctly with padding', () => {
    const b = breakDownDuration(DAY + MS_PER_HOUR + MS_PER_MINUTE + MS_PER_SECOND);
    expect(b).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 0 });
    expect(b.formattedDays).toBe('01');
    expect(b.formattedHours).toBe('01');
  });

  test('negative durations clamp to zero', () => {
    expect(breakDownDuration(-5_000).totalMs).toBe(0);
  });
});

describe('calculateConcentricDialMetrics', () => {
  test('zero duration: no progress, full cycles remaining', () => {
    const m = calculateConcentricDialMetrics(0);
    expect(m.cycle24h.progress).toBe(0);
    expect(m.cycle24h.completedCycles).toBe(0);
    expect(m.cycle24h.isComplete).toBe(false);
    expect(m.cycle24h.remainingInCycleMs).toBe(DAY);
    expect(m.cycle90d.progress).toBe(0);
  });

  test('12 hours: 24h dial at half, angle 180', () => {
    const m = calculateConcentricDialMetrics(12 * MS_PER_HOUR);
    expect(m.cycle24h.progress).toBeCloseTo(0.5);
    expect(m.cycle24h.angleDeg).toBeCloseTo(180);
    expect(m.cycle24h.remainingInCycleMs).toBe(12 * MS_PER_HOUR);
  });

  test('exactly 24h completes one diurnal cycle and rolls over', () => {
    const m = calculateConcentricDialMetrics(DAY);
    expect(m.cycle24h.completedCycles).toBe(1);
    expect(m.cycle24h.isComplete).toBe(true);
    expect(m.cycle24h.progress).toBe(0);
  });

  test('7 days completes the surge cycle and counts 7 diurnal cycles', () => {
    const m = calculateConcentricDialMetrics(7 * DAY);
    expect(m.cycle7d.isComplete).toBe(true);
    expect(m.cycle7d.completedCycles).toBe(1);
    expect(m.cycle24h.completedCycles).toBe(7);
    expect(m.cycle90d.isComplete).toBe(false);
  });
});

describe('getLocalDateKey', () => {
  test('formats a local date as YYYY-MM-DD', () => {
    const ts = new Date(2026, 0, 5, 14, 30, 0).getTime(); // Jan 5, 2:30 PM local
    expect(getLocalDateKey(ts)).toBe('2026-01-05');
  });

  test('rolls over at local midnight, not UTC midnight', () => {
    const before = new Date(2026, 5, 10, 23, 59, 59).getTime();
    const after = new Date(2026, 5, 11, 0, 0, 0).getTime();
    expect(getLocalDateKey(before)).toBe('2026-06-10');
    expect(getLocalDateKey(after)).toBe('2026-06-11');
  });

  test('uses the local timezone, not UTC', () => {
    // 2026-01-05T00:30:00Z is still Jan 4 in New York (EST, UTC-5).
    const ts = Date.UTC(2026, 0, 5, 0, 30, 0);
    expect(getLocalDateKey(ts)).toBe('2026-01-04');
  });
});

describe('calculateStreakTelemetry', () => {
  test('no multiplier history: effective duration equals clean duration', () => {
    const now = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const start = now - 2 * DAY;
    const t = calculateStreakTelemetry(2 * DAY, start, {}, now);
    expect(t.multiplierDaysCount).toBe(0);
    expect(t.multiplierBonusMs).toBe(0);
    expect(t.effectiveDurationMs).toBe(2 * DAY);
    expect(t.todayMultiplierActive).toBe(false);
  });

  test('one multiplier-active day adds a 6-hour bonus and flags today', () => {
    const now = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const start = now - 2 * DAY;
    const todayKey = getLocalDateKey(now);
    const history: Record<string, CircadianDayRecord> = {
      [todayKey]: dayRecord({ dateString: todayKey, amCompletedAt: now - 3600_000, pmCompletedAt: now - 1800_000 }),
    };
    const t = calculateStreakTelemetry(2 * DAY, start, history, now);
    expect(t.multiplierDaysCount).toBe(1);
    expect(t.multiplierBonusMs).toBe(CIRCADIAN_BONUS_PER_DAY_MS);
    expect(CIRCADIAN_BONUS_PER_DAY_MS).toBe(6 * MS_PER_HOUR);
    expect(t.effectiveDurationMs).toBe(2 * DAY + CIRCADIAN_BONUS_PER_DAY_MS);
    expect(t.todayMultiplierActive).toBe(true);
  });

  test('rituals completed before the streak started are excluded (previous attempt)', () => {
    const now = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const start = new Date(2026, 0, 5, 8, 0, 0).getTime(); // streak began 8 AM today
    const todayKey = getLocalDateKey(now);
    const history: Record<string, CircadianDayRecord> = {
      [todayKey]: dayRecord({
        dateString: todayKey,
        amCompletedAt: new Date(2026, 0, 4, 9, 0, 0).getTime(), // yesterday: forfeited attempt
      }),
    };
    const t = calculateStreakTelemetry(now - start, start, history, now);
    expect(t.multiplierDaysCount).toBe(0);
    expect(t.multiplierBonusMs).toBe(0);
  });
});

describe('calculateRelapseForfeiture', () => {
  test('day-zero relapse forfeits nothing clean but still applies the aura policy', () => {
    const now = Date.now();
    const f = calculateRelapseForfeiture(now, now, {}, 100);
    expect(f.forfeitedCleanDurationMs).toBe(0);
    expect(f.forfeitedMultiplierBonusMs).toBe(0);
    expect(f.forfeitedEffectiveDurationMs).toBe(0);
    expect(f.forfeitedAura).toBe(50); // max(50, 10% of 100)
  });

  test('aura forfeiture is 10% for large balances', () => {
    const now = Date.now();
    const f = calculateRelapseForfeiture(now - 5 * DAY, now, {}, 1000);
    expect(f.forfeitedCleanDurationMs).toBe(5 * DAY);
    expect(f.forfeitedAura).toBe(100);
  });

  test('aura forfeiture never exceeds the current balance', () => {
    const now = Date.now();
    const f = calculateRelapseForfeiture(now - DAY, now, {}, 30);
    expect(f.forfeitedAura).toBe(30);
  });

  test('zero aura forfeits zero aura', () => {
    const now = Date.now();
    expect(calculateRelapseForfeiture(now - DAY, now, {}, 0).forfeitedAura).toBe(0);
  });
});
