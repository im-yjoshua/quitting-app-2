/**
 * onboardingFlow.test.ts — pure presentation logic for the v3 onboarding
 * rebuild (Phase 3, plan §3.1).
 *
 * Covers the "when did you quit" drum helpers (date options, moment
 * construction, display formatting, clamping) and the default-reason
 * builder. The completion contract itself (completeOnboarding →
 * createQuitFromAnswers) is covered by onboarding.test.ts and is untouched.
 *
 * No react-native imports here — node env. Local-time Date construction
 * keeps every case deterministic under the repo's TZ=America/New_York.
 */
import {
  QUIT_DAY_LOOKBACK,
  clampQuitMoment,
  defaultReasonForCategory,
  formatQuitMoment,
  quitDayOptions,
  quitMomentMs,
} from '../components/onboarding/logic';

/** Friday 2026-10-09 19:41 local — matches the repo's "today" in tests. */
const NOW = new Date(2026, 9, 9, 19, 41, 0).getTime();
const DAY = 86_400_000;

describe('quitDayOptions', () => {
  it('offers today plus the lookback window', () => {
    const options = quitDayOptions(NOW);
    expect(options).toHaveLength(QUIT_DAY_LOOKBACK + 1);
    expect(options[0]).toEqual({ offset: 0, label: 'Today' });
    expect(options[1]).toEqual({ offset: 1, label: 'Yesterday' });
  });

  it('labels older days with the short weekday name', () => {
    const options = quitDayOptions(NOW);
    // 2026-10-07 is a Wednesday, 2026-10-03 is a Saturday.
    expect(options[2]).toEqual({ offset: 2, label: 'Wed' });
    expect(options[6]).toEqual({ offset: 6, label: 'Sat' });
  });

  it('respects a custom lookback', () => {
    expect(quitDayOptions(NOW, 0)).toEqual([{ offset: 0, label: 'Today' }]);
  });
});

describe('quitMomentMs', () => {
  it('builds today at the given hour/minute', () => {
    expect(quitMomentMs(NOW, 0, 7, 30)).toBe(
      new Date(2026, 9, 9, 7, 30, 0, 0).getTime()
    );
  });

  it('builds a past day at the given hour/minute', () => {
    expect(quitMomentMs(NOW, 1, 21, 5)).toBe(
      new Date(2026, 9, 8, 21, 5, 0, 0).getTime()
    );
  });

  it('zeroes seconds and milliseconds', () => {
    const at = new Date(quitMomentMs(NOW, 0, 12, 0));
    expect(at.getSeconds()).toBe(0);
    expect(at.getMilliseconds()).toBe(0);
  });
});

describe('formatQuitMoment', () => {
  it('says Today for the current day', () => {
    expect(formatQuitMoment(quitMomentMs(NOW, 0, 19, 41), NOW)).toBe(
      'Today, 19:41'
    );
  });

  it('says Yesterday for the previous day', () => {
    expect(formatQuitMoment(quitMomentMs(NOW, 1, 9, 15), NOW)).toBe(
      'Yesterday, 09:15'
    );
  });

  it('uses the weekday for older days', () => {
    expect(formatQuitMoment(quitMomentMs(NOW, 2, 8, 0), NOW)).toBe(
      'Wed, 08:00'
    );
  });

  it('zero-pads hours and minutes', () => {
    expect(formatQuitMoment(quitMomentMs(NOW, 0, 0, 5), NOW)).toBe(
      'Today, 00:05'
    );
  });
});

describe('clampQuitMoment', () => {
  it('clamps future moments to now', () => {
    expect(clampQuitMoment(NOW + 3_600_000, NOW)).toBe(NOW);
  });

  it('clamps moments older than the lookback to the window start', () => {
    expect(clampQuitMoment(NOW - 10 * DAY, NOW)).toBe(NOW - 6 * DAY);
  });

  it('leaves in-window moments untouched', () => {
    const at = NOW - 2 * DAY;
    expect(clampQuitMoment(at, NOW)).toBe(at);
  });
});

describe('defaultReasonForCategory', () => {
  it('builds a personal reason from the preset label', () => {
    expect(defaultReasonForCategory('smoking')).toBe(
      'To be done with smoking for good.'
    );
    expect(defaultReasonForCategory('alcohol')).toBe(
      'To be done with alcohol for good.'
    );
  });

  it('uses the custom name for the custom category', () => {
    expect(defaultReasonForCategory('custom', '  energy drinks ')).toBe(
      'To be done with energy drinks for good.'
    );
  });

  it('falls back gracefully when the custom name is blank', () => {
    expect(defaultReasonForCategory('custom', '   ')).toBe(
      'To be done with this for good.'
    );
    expect(defaultReasonForCategory('custom')).toBe(
      'To be done with this for good.'
    );
  });
});
