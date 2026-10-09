/**
 * components/onboarding/logic.ts — pure presentation logic for the v3
 * onboarding flow (Phase 3, plan §3.1).
 *
 * The "when did you quit" step needs date math for its drums; the service
 * contract (services/onboarding.ts) requires at least one reason, which the
 * v3 flow no longer collects — so the flow submits a personal default.
 *
 * No React Native imports in this module: it runs in Jest (node) AND in
 * the app. The completion contract itself is untouched and stays covered
 * by __tests__/onboarding.test.ts.
 */
import { QUIT_CATEGORY_LABELS, type QuitCategory } from '../../types/app';

/** The quit-date drum reaches this many days back (today + lookback). */
export const QUIT_DAY_LOOKBACK = 6;

export interface QuitDayOption {
  /** Days before today (0 = today). */
  offset: number;
  /** Drum label: "Today" / "Yesterday" / short weekday. */
  label: string;
}

const DAY_MS = 86_400_000;

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Date-drum options for the quit moment: today plus the lookback window,
 * newest first.
 */
export function quitDayOptions(
  nowMs: number,
  lookback: number = QUIT_DAY_LOOKBACK
): QuitDayOption[] {
  const now = new Date(nowMs);
  const options: QuitDayOption[] = [];
  for (let offset = 0; offset <= lookback; offset++) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset
    );
    const label =
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Yesterday'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
    options.push({ offset, label });
  }
  return options;
}

/** Local-time ms for (today − dayOffset) at hour:minute (24h). */
export function quitMomentMs(
  nowMs: number,
  dayOffset: number,
  hour: number,
  minute: number
): number {
  const now = new Date(nowMs);
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOffset,
    hour,
    minute,
    0,
    0
  ).getTime();
}

/** "Today, 19:41" — the quit-moment preview line (24h, tabular-ready). */
export function formatQuitMoment(quitAtMs: number, nowMs: number): string {
  const q = new Date(quitAtMs);
  const dayDiff = Math.round(
    (startOfDayMs(new Date(nowMs)) - startOfDayMs(q)) / DAY_MS
  );
  const dayLabel =
    dayDiff <= 0
      ? 'Today'
      : dayDiff === 1
        ? 'Yesterday'
        : q.toLocaleDateString('en-US', { weekday: 'short' });
  const hh = String(q.getHours()).padStart(2, '0');
  const mm = String(q.getMinutes()).padStart(2, '0');
  return `${dayLabel}, ${hh}:${mm}`;
}

/** Keeps a picked quit moment inside [now − lookback days, now]. */
export function clampQuitMoment(
  quitAtMs: number,
  nowMs: number,
  lookbackDays: number = QUIT_DAY_LOOKBACK
): number {
  return Math.min(nowMs, Math.max(nowMs - lookbackDays * DAY_MS, quitAtMs));
}

/**
 * The v3 flow collects no reasons, but createQuitFromAnswers throws on an
 * empty list — so the quit ships with one personal default built from the
 * chosen category. It rotates on Home like any other reason.
 */
export function defaultReasonForCategory(
  category: QuitCategory,
  customName?: string
): string {
  const name =
    category === 'custom'
      ? (customName ?? '').trim() || 'this'
      : QUIT_CATEGORY_LABELS[category].toLowerCase();
  return `To be done with ${name} for good.`;
}
