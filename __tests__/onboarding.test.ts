/**
 * onboarding.test.ts — state creation from the 4-step answers (spec §2.1, §7).
 * Skips default to 0; reasons are trimmed/capped; custom categories keep names.
 */
import {
  createAppStateFromQuit,
  createQuitFromAnswers,
  type OnboardingAnswers,
} from '../services/onboarding';
import { isAppState, isQuit } from '../types/app';

const BASE: OnboardingAnswers = {
  category: 'smoking',
  reasons: ['For Ammi\u2019s smile', 'Because I want my lungs back', 'So I can run again'],
  dailyCost: 5,
  dailyMinutes: 30,
  pledgeTime: '07:00',
};

describe('createQuitFromAnswers', () => {
  it('builds a valid Quit from complete answers', () => {
    const quit = createQuitFromAnswers(BASE, Date.parse('2026-09-27T09:00:00Z'));
    expect(isQuit(quit)).toBe(true);
    expect(quit.category).toBe('smoking');
    expect(quit.reasons).toHaveLength(3);
    expect(quit.dailyCost).toBe(5);
    expect(quit.dailyMinutes).toBe(30);
    expect(quit.pledgeTime).toBe('07:00');
    expect(quit.longestStreakDays).toBe(0);
    expect(quit.totalRelapses).toBe(0);
    expect(Date.parse(quit.startDate)).not.toBeNaN();
  });

  it('throws when no reason is provided', () => {
    expect(() =>
      createQuitFromAnswers({ ...BASE, reasons: ['  ', ''] }, Date.now())
    ).toThrow('At least one reason');
  });

  it('accepts a single reason and trims whitespace', () => {
    const quit = createQuitFromAnswers(
      { ...BASE, reasons: ['  For my kids  ', '', ''] },
      Date.now()
    );
    expect(quit.reasons).toEqual(['For my kids']);
  });

  it('caps reasons at 3', () => {
    const quit = createQuitFromAnswers(
      { ...BASE, reasons: ['a', 'b', 'c', 'd', 'e'] },
      Date.now()
    );
    expect(quit.reasons).toEqual(['a', 'b', 'c']);
  });

  it('keeps the custom name only for the custom category', () => {
    const custom = createQuitFromAnswers(
      { ...BASE, category: 'custom', customName: '  energy drinks ' },
      Date.now()
    );
    expect(custom.customName).toBe('energy drinks');

    const preset = createQuitFromAnswers(
      { ...BASE, category: 'weed', customName: 'stray text' },
      Date.now()
    );
    expect(preset.customName).toBeUndefined();
  });

  it('clamps negative cost/minutes to 0 (skips land at 0)', () => {
    const quit = createQuitFromAnswers(
      { ...BASE, dailyCost: 0, dailyMinutes: 0 },
      Date.now()
    );
    expect(quit.dailyCost).toBe(0);
    expect(quit.dailyMinutes).toBe(0);

    const clamped = createQuitFromAnswers(
      { ...BASE, dailyCost: -5, dailyMinutes: -10 },
      Date.now()
    );
    expect(clamped.dailyCost).toBe(0);
    expect(clamped.dailyMinutes).toBe(0);
  });

  it('generates unique ids per call', () => {
    const a = createQuitFromAnswers(BASE, 1000);
    const b = createQuitFromAnswers(BASE, 2000);
    expect(a.id).not.toBe(b.id);
  });
});

describe('createAppStateFromQuit', () => {
  it('wraps the quit in a valid default AppState', () => {
    const quit = createQuitFromAnswers(BASE, Date.now());
    const state = createAppStateFromQuit(quit);
    expect(isAppState(state)).toBe(true);
    expect(state.schemaVersion).toBe(2);
    expect(state.quit).toBe(quit);
    expect(state.pledge).toEqual({ lastPledgeDayKey: null, pledgeStreak: 0 });
    expect(state.relapseLog).toEqual([]);
    expect(state.journal).toEqual([]);
    expect(state.milestonesSeen).toEqual([]);
    expect(state.urgeSurfs).toEqual([]);
    expect(state.settings).toEqual({
      pledgeReminder: true,
      milestoneAlerts: true,
      orbTheme: 'dawn',
      shareCardStyle: 'classic',
      appearance: 'system',
    });
  });
});
