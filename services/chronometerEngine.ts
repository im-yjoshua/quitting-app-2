import type { CircadianDayRecord } from '../types/app';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND; // 60,000 ms
export const MS_PER_HOUR = 60 * MS_PER_MINUTE; // 3,600,000 ms
export const MS_PER_DAY = 24 * MS_PER_HOUR; // 86,400,000 ms

// Core Concentric Cycles
export const CYCLE_24H_MS = MS_PER_DAY; // 86,400,000 ms (Diurnal circadian cycle)
export const CYCLE_7D_MS = 7 * MS_PER_DAY; // 604,800,000 ms (Acute 7-day surge cycle)
export const CYCLE_30D_MS = 30 * MS_PER_DAY; // 2,592,000,000 ms (30-day dopamine milestone cycle)
export const CYCLE_90D_MS = 90 * MS_PER_DAY; // 7,776,000,000 ms (Full dopamine receptor homeostasis)

// Circadian Multiplier Constants
export const CIRCADIAN_MULTIPLIER_FACTOR = 1.25;
export const CIRCADIAN_BONUS_RATIO = 0.25; // Additional 25% clean duration credit per completed circadian day
export const CIRCADIAN_BONUS_PER_DAY_MS = CIRCADIAN_BONUS_RATIO * MS_PER_DAY; // 21,600,000 ms (6 hours)
export const CIRCADIAN_AURA_REWARD = 25;

export interface TemporalBreakdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  formattedDays: string;
  formattedHours: string;
  formattedMinutes: string;
  formattedSeconds: string;
}

export interface DialCycleMetric {
  cycleName: string;
  progress: number; // Clamped strictly to [0, 1]
  angleDeg: number; // [0, 360]
  elapsedInCycleMs: number;
  totalCycleMs: number;
  remainingInCycleMs: number;
  completedCycles: number;
  isComplete: boolean;
}

export interface ConcentricDialMetrics {
  cycle24h: DialCycleMetric;
  cycle7d: DialCycleMetric;
  cycle30d: DialCycleMetric;
  cycle90d: DialCycleMetric;
}

export interface StreakTelemetry {
  cleanDurationMs: number;
  effectiveDurationMs: number;
  breakdown: TemporalBreakdown;
  effectiveBreakdown: TemporalBreakdown;
  multiplierDaysCount: number;
  multiplierBonusMs: number;
  todayMultiplierActive: boolean;
  dials: ConcentricDialMetrics;
  effectiveDials: ConcentricDialMetrics;
}

/**
 * Pure, idempotent calculation of clean streak duration in milliseconds.
 * Returns 0 if timestamps are invalid, negative, or start is in the future.
 */
export function calculateCleanDurationMs(nowEpochMs: number, startEpochMs: number): number {
  if (
    typeof nowEpochMs !== 'number' ||
    typeof startEpochMs !== 'number' ||
    isNaN(nowEpochMs) ||
    isNaN(startEpochMs) ||
    startEpochMs <= 0 ||
    nowEpochMs < startEpochMs
  ) {
    return 0;
  }
  return Math.max(0, nowEpochMs - startEpochMs);
}

/**
 * Pure decomposition of an elapsed duration into days, hours, minutes, seconds, and milliseconds.
 */
export function breakDownDuration(durationMs: number): TemporalBreakdown {
  const clamped = Math.max(0, Math.floor(durationMs));
  const days = Math.floor(clamped / MS_PER_DAY);
  const hours = Math.floor((clamped % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((clamped % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((clamped % MS_PER_MINUTE) / MS_PER_SECOND);
  const milliseconds = clamped % MS_PER_SECOND;

  const pad = (val: number, len = 2) => String(val).padStart(len, '0');

  return {
    totalMs: clamped,
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    formattedDays: pad(days),
    formattedHours: pad(hours),
    formattedMinutes: pad(minutes),
    formattedSeconds: pad(seconds),
  };
}

/**
 * Pure calculation of concentric dial metrics:
 * - 24-hour cycle: Diurnal circadian progression
 * - 7-day surge cycle: Acute limbic rebellion and surge barrier
 * - 90-day receptor recovery cycle: Dopamine D2 receptor neuroplastic restoration
 */
export function calculateConcentricDialMetrics(cleanDurationMs: number): ConcentricDialMetrics {
  const safeMs = Math.max(0, cleanDurationMs);

  // 1. 24-Hour Diurnal Cycle (Completes 1 full 360 deg cycle in 24 Hours)
  const elapsed24h = safeMs % CYCLE_24H_MS;
  const progress24h = elapsed24h / CYCLE_24H_MS;
  const completed24hCycles = Math.floor(safeMs / CYCLE_24H_MS);

  const cycle24h: DialCycleMetric = {
    cycleName: '24-Hour Diurnal Cycle',
    progress: progress24h,
    angleDeg: parseFloat((progress24h * 360).toFixed(2)),
    elapsedInCycleMs: elapsed24h,
    totalCycleMs: CYCLE_24H_MS,
    remainingInCycleMs: CYCLE_24H_MS - elapsed24h,
    completedCycles: completed24hCycles,
    isComplete: completed24hCycles >= 1,
  };

  // 2. 7-Day Surge Cycle (Completes 1 full 360 deg cycle in 7 Days)
  const elapsed7d = safeMs % CYCLE_7D_MS;
  const progress7d = elapsed7d / CYCLE_7D_MS;
  const completed7dCycles = Math.floor(safeMs / CYCLE_7D_MS);

  const cycle7d: DialCycleMetric = {
    cycleName: '7-Day Surge Cycle',
    progress: progress7d,
    angleDeg: parseFloat((progress7d * 360).toFixed(2)),
    elapsedInCycleMs: elapsed7d,
    totalCycleMs: CYCLE_7D_MS,
    remainingInCycleMs: CYCLE_7D_MS - elapsed7d,
    completedCycles: completed7dCycles,
    isComplete: completed7dCycles >= 1,
  };

  // 3. 30-Day Milestone Cycle (Completes 1 full 360 deg cycle in 30 Days)
  const elapsed30d = safeMs % CYCLE_30D_MS;
  const progress30d = elapsed30d / CYCLE_30D_MS;
  const completed30dCycles = Math.floor(safeMs / CYCLE_30D_MS);

  const cycle30d: DialCycleMetric = {
    cycleName: '30-Day Milestone Cycle',
    progress: progress30d,
    angleDeg: parseFloat((progress30d * 360).toFixed(2)),
    elapsedInCycleMs: elapsed30d,
    totalCycleMs: CYCLE_30D_MS,
    remainingInCycleMs: CYCLE_30D_MS - elapsed30d,
    completedCycles: completed30dCycles,
    isComplete: completed30dCycles >= 1,
  };

  // 4. 90-Day Receptor Recovery Cycle (Completes 1 full 360 deg cycle in 90 Days)
  const elapsed90d = safeMs % CYCLE_90D_MS;
  const progress90d = elapsed90d / CYCLE_90D_MS;
  const completed90dCycles = Math.floor(safeMs / CYCLE_90D_MS);

  const cycle90d: DialCycleMetric = {
    cycleName: '90-Day Receptor Recovery Cycle',
    progress: progress90d,
    angleDeg: parseFloat((progress90d * 360).toFixed(2)),
    elapsedInCycleMs: elapsed90d,
    totalCycleMs: CYCLE_90D_MS,
    remainingInCycleMs: CYCLE_90D_MS - elapsed90d,
    completedCycles: completed90dCycles,
    isComplete: completed90dCycles >= 1,
  };

  return {
    cycle24h,
    cycle7d,
    cycle30d,
    cycle90d,
  };
}

/**
 * Returns formatted YYYY-MM-DD string for an epoch timestamp in local time.
 */
export function getLocalDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure calculation of circadian multiplier streak telemetry.
 * Scans the current streak window between startEpochMs and nowEpochMs, counting how many
 * calendar days have multiplierActive === true, and calculates the 1.25x effective streak duration.
 */
export function calculateStreakTelemetry(
  cleanDurationMs: number,
  startEpochMs: number,
  circadianHistory: Record<string, CircadianDayRecord>,
  nowEpochMs: number
): StreakTelemetry {
  const safeCleanMs = Math.max(0, cleanDurationMs);
  const todayKey = getLocalDateKey(nowEpochMs);
  const todayRecord = circadianHistory[todayKey];
  const todayMultiplierActive = Boolean(todayRecord && todayRecord.multiplierActive);

  // Enumerate calendar dates from startEpochMs to nowEpochMs
  let multiplierDaysCount = 0;

  if (startEpochMs > 0 && nowEpochMs >= startEpochMs && safeCleanMs > 0) {
    const startDate = new Date(startEpochMs);
    const currentDate = new Date(nowEpochMs);

    // Normalize to midnight for day iterations
    const iter = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    // Iterate day by day
    while (iter.getTime() <= end.getTime()) {
      const dateKey = getLocalDateKey(iter.getTime());
      const rec = circadianHistory[dateKey];

      if (rec && rec.multiplierActive) {
        // Verify that ritual completion timestamps actually belong to this clean streak:
        // If rituals were completed before startEpochMs, they belong to a previous, forfeited attempt!
        const amValid = rec.amCompletedAt === null || rec.amCompletedAt >= startEpochMs;
        const pmValid = rec.pmCompletedAt === null || rec.pmCompletedAt >= startEpochMs;
        if (amValid && pmValid) {
          multiplierDaysCount += 1;
        }
      }

      iter.setDate(iter.getDate() + 1);
    }
  }

  const multiplierBonusMs = multiplierDaysCount * CIRCADIAN_BONUS_PER_DAY_MS;
  const effectiveDurationMs = safeCleanMs + multiplierBonusMs;

  const breakdown = breakDownDuration(safeCleanMs);
  const effectiveBreakdown = breakDownDuration(effectiveDurationMs);
  const dials = calculateConcentricDialMetrics(safeCleanMs);
  const effectiveDials = calculateConcentricDialMetrics(effectiveDurationMs);

  return {
    cleanDurationMs: safeCleanMs,
    effectiveDurationMs,
    breakdown,
    effectiveBreakdown,
    multiplierDaysCount,
    multiplierBonusMs,
    todayMultiplierActive,
    dials,
    effectiveDials,
  };
}

/**
 * Pure calculation of forfeited telemetry when a relapse occurs.
 * Truthfully records forfeited clean run, multiplier bonus credit, and forfeited aura.
 */
export function calculateRelapseForfeiture(
  startEpochMs: number,
  nowEpochMs: number,
  circadianHistory: Record<string, CircadianDayRecord>,
  currentAura: number
): {
  forfeitedCleanDurationMs: number;
  forfeitedMultiplierBonusMs: number;
  forfeitedEffectiveDurationMs: number;
  forfeitedAura: number;
} {
  const cleanMs = calculateCleanDurationMs(nowEpochMs, startEpochMs);
  const telemetry = calculateStreakTelemetry(cleanMs, startEpochMs, circadianHistory, nowEpochMs);

  // Aura deduction policy: Forfeits 10% of current aura or 50 points, whichever is greater (floored at 0)
  const forfeitedAura = Math.min(currentAura, Math.max(50, Math.round(currentAura * 0.1)));

  return {
    forfeitedCleanDurationMs: cleanMs,
    forfeitedMultiplierBonusMs: telemetry.multiplierBonusMs,
    forfeitedEffectiveDurationMs: telemetry.effectiveDurationMs,
    forfeitedAura,
  };
}
