/**
 * pledge.test.ts — pledge streak rules (spec §1, §7).
 * TZ is pinned to America/New_York by the npm test script.
 */
import {
  INITIAL_PLEDGE_STATE,
  applyMissedPledgeReset,
  daysBetweenDayKeys,
  hasPledgedToday,
  pledgeToday,
} from '../services/pledge';
import { getLocalDateKey } from '../services/chronometerEngine';
import type { PledgeState } from '../types/app';

/** Local-time epoch ms for readability. */
function localMs(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

const SEP_27_2026 = localMs(2026, 9, 27, 9, 0);

describe('daysBetweenDayKeys', () => {
  it('returns 0 for the same key', () => {
    expect(daysBetweenDayKeys('2026-09-27', '2026-09-27')).toBe(0);
  });

  it('returns 1 across a midnight boundary', () => {
    expect(daysBetweenDayKeys('2026-09-28', '2026-09-27')).toBe(1);
  });

  it('counts multi-day gaps', () => {
    expect(daysBetweenDayKeys('2026-10-01', '2026-09-27')).toBe(4);
  });
});

describe('pledgeToday', () => {
  it('first pledge starts a 1-day streak', () => {
    const { state, pledged } = pledgeToday(INITIAL_PLEDGE_STATE, SEP_27_2026);
    expect(pledged).toBe(true);
    expect(state.pledgeStreak).toBe(1);
    expect(state.lastPledgeDayKey).toBe('2026-09-27');
  });

  it('double-pledge on the same day is a no-op', () => {
    const first = pledgeToday(INITIAL_PLEDGE_STATE, SEP_27_2026);
    const second = pledgeToday(first.state, SEP_27_2026 + 3_600_000);
    expect(second.pledged).toBe(false);
    expect(second.state).toBe(first.state);
    expect(second.state.pledgeStreak).toBe(1);
  });

  it('pledging on the next consecutive day increments the streak', () => {
    const day1 = pledgeToday(INITIAL_PLEDGE_STATE, SEP_27_2026);
    const day2 = pledgeToday(day1.state, localMs(2026, 9, 28, 9, 0));
    expect(day2.pledged).toBe(true);
    expect(day2.state.pledgeStreak).toBe(2);
  });

  it('pledging after a gap restarts the streak at 1', () => {
    const day1 = pledgeToday(INITIAL_PLEDGE_STATE, SEP_27_2026);
    const afterGap = pledgeToday(day1.state, localMs(2026, 9, 30, 9, 0));
    expect(afterGap.pledged).toBe(true);
    expect(afterGap.state.pledgeStreak).toBe(1);
  });

  it('treats 23:59 and 00:01 as consecutive local days (midnight boundary)', () => {
    const late = pledgeToday(
      INITIAL_PLEDGE_STATE,
      localMs(2026, 9, 27, 23, 59)
    );
    const early = pledgeToday(late.state, localMs(2026, 9, 28, 0, 1));
    expect(early.pledged).toBe(true);
    expect(early.state.pledgeStreak).toBe(2);
  });

  it('pledging is allowed any time of day — no "too late" state', () => {
    const evening = pledgeToday(
      INITIAL_PLEDGE_STATE,
      localMs(2026, 9, 27, 23, 30)
    );
    expect(evening.pledged).toBe(true);
    expect(evening.state.lastPledgeDayKey).toBe('2026-09-27');
  });
});

describe('applyMissedPledgeReset', () => {
  it('keeps the streak when the last pledge was yesterday', () => {
    const prev: PledgeState = { lastPledgeDayKey: '2026-09-26', pledgeStreak: 5 };
    const next = applyMissedPledgeReset(prev, SEP_27_2026);
    expect(next).toBe(prev);
    expect(next.pledgeStreak).toBe(5);
  });

  it('keeps today\u2019s pledge untouched', () => {
    const prev: PledgeState = { lastPledgeDayKey: '2026-09-27', pledgeStreak: 5 };
    expect(applyMissedPledgeReset(prev, SEP_27_2026)).toBe(prev);
  });

  it('resets the streak to 0 when a full day was missed', () => {
    const prev: PledgeState = { lastPledgeDayKey: '2026-09-25', pledgeStreak: 5 };
    const next = applyMissedPledgeReset(prev, SEP_27_2026);
    expect(next.pledgeStreak).toBe(0);
    // The key is kept so the UI can say "you missed yesterday".
    expect(next.lastPledgeDayKey).toBe('2026-09-25');
  });

  it('is a no-op when the user never pledged', () => {
    expect(applyMissedPledgeReset(INITIAL_PLEDGE_STATE, SEP_27_2026)).toBe(
      INITIAL_PLEDGE_STATE
    );
  });
});

describe('hasPledgedToday', () => {
  it('reflects the local day key of nowMs', () => {
    const { state } = pledgeToday(INITIAL_PLEDGE_STATE, SEP_27_2026);
    expect(hasPledgedToday(state, SEP_27_2026)).toBe(true);
    expect(hasPledgedToday(state, localMs(2026, 9, 28, 9, 0))).toBe(false);
    // Sanity: the key really is the local day, not UTC.
    expect(getLocalDateKey(SEP_27_2026)).toBe('2026-09-27');
  });
});
