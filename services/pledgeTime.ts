/**
 * pledgeTime — the daily pledge reminder time ("HH:MM", 24h, zero-padded).
 *
 * Pure functions so the store updater and the You tab share one contract:
 * validation, 12h display formatting, and the immutable state patch.
 */
import type { AppState } from '../types/app';

/** Strict "HH:MM" 24h check — "07:00" ok, "7:00"/"24:00"/"07:60" rejected. */
export function isValidPledgeTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** "07:00" → "7:00 AM", "19:30" → "7:30 PM", "00:00" → "12:00 AM". */
export function formatPledgeTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Returns a new AppState with quit.pledgeTime replaced. Throws on a bad
 * format so a malformed time can never reach the notification scheduler.
 * Everything else is untouched (same references where possible).
 */
export function applyPledgeTime(prev: AppState, time: string): AppState {
  if (!isValidPledgeTime(time)) {
    throw new Error(`Invalid pledge time: ${time}`);
  }
  if (!prev.quit) return prev;
  return { ...prev, quit: { ...prev.quit, pledgeTime: time } };
}
