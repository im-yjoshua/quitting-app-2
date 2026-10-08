/// <reference types="jest" />

/**
 * pledgeTime.test.ts — validation, 12h formatting, and the immutable
 * store patch for the editable pledge-time picker (Phase A).
 */
import {
  applyPledgeTime,
  formatPledgeTime12h,
  isValidPledgeTime,
} from '../services/pledgeTime';
import {
  createAppStateFromQuit,
  createQuitFromAnswers,
} from '../services/onboarding';
import type { AppState } from '../types/app';

function makeState(pledgeTime = '07:00'): AppState {
  const quit = createQuitFromAnswers(
    {
      category: 'smoking',
      reasons: ['For my lungs'],
      dailyCost: 5,
      dailyMinutes: 30,
      pledgeTime,
    },
    Date.parse('2026-09-27T09:00:00Z')
  );
  return createAppStateFromQuit(quit);
}

describe('isValidPledgeTime', () => {
  it('accepts zero-padded 24h times', () => {
    expect(isValidPledgeTime('07:00')).toBe(true);
    expect(isValidPledgeTime('00:00')).toBe(true);
    expect(isValidPledgeTime('23:59')).toBe(true);
  });

  it('rejects malformed or out-of-range times', () => {
    expect(isValidPledgeTime('7:00')).toBe(false);
    expect(isValidPledgeTime('07:0')).toBe(false);
    expect(isValidPledgeTime('24:00')).toBe(false);
    expect(isValidPledgeTime('07:60')).toBe(false);
    expect(isValidPledgeTime('')).toBe(false);
    expect(isValidPledgeTime('abc')).toBe(false);
    expect(isValidPledgeTime('07:00:00')).toBe(false);
  });
});

describe('formatPledgeTime12h', () => {
  it('formats morning, noon, evening, and midnight', () => {
    expect(formatPledgeTime12h('07:00')).toBe('7:00 AM');
    expect(formatPledgeTime12h('00:00')).toBe('12:00 AM');
    expect(formatPledgeTime12h('12:00')).toBe('12:00 PM');
    expect(formatPledgeTime12h('19:30')).toBe('7:30 PM');
    expect(formatPledgeTime12h('23:59')).toBe('11:59 PM');
  });
});

describe('applyPledgeTime', () => {
  it('persists the new time on quit.pledgeTime', () => {
    const next = applyPledgeTime(makeState('07:00'), '08:30');
    expect(next.quit?.pledgeTime).toBe('08:30');
  });

  it('leaves the rest of the state untouched', () => {
    const prev = makeState('07:00');
    const next = applyPledgeTime(prev, '21:15');
    expect(next.schemaVersion).toBe(prev.schemaVersion);
    expect(next.pledge).toBe(prev.pledge);
    expect(next.relapseLog).toBe(prev.relapseLog);
    expect(next.journal).toBe(prev.journal);
    expect(next.milestonesSeen).toBe(prev.milestonesSeen);
    expect(next.urgeSurfs).toBe(prev.urgeSurfs);
    expect(next.settings).toBe(prev.settings);
    // Quit is a new object, but its other fields are unchanged.
    expect(next.quit).not.toBe(prev.quit);
    expect(next.quit?.category).toBe(prev.quit?.category);
    expect(next.quit?.reasons).toBe(prev.quit?.reasons);
    expect(next.quit?.startDate).toBe(prev.quit?.startDate);
    expect(prev.quit?.pledgeTime).toBe('07:00');
  });

  it('throws on an invalid time and changes nothing', () => {
    const prev = makeState('07:00');
    expect(() => applyPledgeTime(prev, '25:00')).toThrow(
      'Invalid pledge time'
    );
    expect(prev.quit?.pledgeTime).toBe('07:00');
  });

  it('is a no-op when onboarding is incomplete (quit is null)', () => {
    const prev = { ...makeState('07:00'), quit: null };
    expect(applyPledgeTime(prev, '08:30').quit).toBeNull();
  });
});
