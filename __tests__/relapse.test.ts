/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Relapse rules — services/relapse.ts (spec §1 + §7).
// TZ-pinned via `npm test` (cross-env TZ=America/New_York).
// ---------------------------------------------------------------------------
// NOTE: jest.mock calls must precede imports (ts-jest evaluates in order).

let mockAsyncStore: Map<string, string>;

jest.mock('@react-native-async-storage/async-storage', () => {
  mockAsyncStore = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string): Promise<string | null> =>
        mockAsyncStore.has(key) ? mockAsyncStore.get(key)! : null,
      setItem: async (key: string, value: string): Promise<void> => {
        mockAsyncStore.set(key, value);
      },
      removeItem: async (key: string): Promise<void> => {
        mockAsyncStore.delete(key);
      },
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { MS_PER_DAY } from '../services/chronometerEngine';
import {
  applyRelapse,
  daysCleanBefore,
} from '../services/relapse';
import { defaultAppState } from '../services/appStateStore';
import type { AppState, Quit } from '../types/app';

// Fixed "now": 2026-09-27 12:00:00 UTC (08:00 in the pinned TZ).
const NOW_MS = Date.parse('2026-09-27T12:00:00.000Z');

function makeQuit(overrides: Partial<Quit> = {}): Quit {
  return {
    id: 'quit_test',
    category: 'smoking',
    startDate: new Date(NOW_MS - 47 * MS_PER_DAY).toISOString(),
    reasons: ['For Ammi'],
    dailyCost: 5,
    dailyMinutes: 30,
    pledgeTime: '07:00',
    longestStreakDays: 30,
    totalRelapses: 2,
    ...overrides,
  };
}

function makeState(quit: Quit | null = makeQuit()): AppState {
  return {
    ...defaultAppState(),
    quit,
    milestonesSeen: [1, 3, 7, 14],
    relapseLog: [
      {
        date: new Date(NOW_MS - 60 * MS_PER_DAY).toISOString(),
        daysCleanBefore: 12,
      },
    ],
  };
}

describe('daysCleanBefore', () => {
  it('returns whole days banked before the slip', () => {
    expect(
      daysCleanBefore(new Date(NOW_MS - 47 * MS_PER_DAY).toISOString(), NOW_MS)
    ).toBe(47);
  });

  it('returns 0 for a slip on day 0', () => {
    expect(daysCleanBefore(new Date(NOW_MS).toISOString(), NOW_MS)).toBe(0);
  });

  it('floors fractional days', () => {
    const start = new Date(
      NOW_MS - 2.5 * MS_PER_DAY
    ).toISOString();
    expect(daysCleanBefore(start, NOW_MS)).toBe(2);
  });

  it('clamps a future start date to 0', () => {
    const start = new Date(NOW_MS + MS_PER_DAY).toISOString();
    expect(daysCleanBefore(start, NOW_MS)).toBe(0);
  });
});

describe('applyRelapse', () => {
  it('appends a well-shaped RelapseEntry to the log', () => {
    const { state, entry } = applyRelapse(makeState(), NOW_MS);
    expect(entry.date).toBe(new Date(NOW_MS).toISOString());
    expect(entry.daysCleanBefore).toBe(47);
    expect(entry.note).toBeUndefined();
    expect(state.relapseLog).toHaveLength(2);
    expect(state.relapseLog[1]).toEqual(entry);
    expect(state.relapseLog[0].daysCleanBefore).toBe(12); // history preserved
  });

  it('trims and keeps an optional trigger note', () => {
    const { entry } = applyRelapse(makeState(), NOW_MS, '  late night stress  ');
    expect(entry.note).toBe('late night stress');
  });

  it('omits the note when blank', () => {
    const { entry } = applyRelapse(makeState(), NOW_MS, '   ');
    expect(entry.note).toBeUndefined();
  });

  it('preserves the longest streak when the old one wins', () => {
    const state = makeState(
      makeQuit({
        startDate: new Date(NOW_MS - 10 * MS_PER_DAY).toISOString(),
        longestStreakDays: 60,
      })
    );
    const { state: next } = applyRelapse(state, NOW_MS);
    expect(next.quit!.longestStreakDays).toBe(60);
  });

  it('promotes the new streak when it beats the old longest', () => {
    const { state, previousLongestStreakDays } = applyRelapse(makeState(), NOW_MS);
    expect(previousLongestStreakDays).toBe(30);
    expect(state.quit!.longestStreakDays).toBe(47);
  });

  it('resets startDate to now and increments totalRelapses', () => {
    const { state } = applyRelapse(makeState(), NOW_MS);
    expect(state.quit!.startDate).toBe(new Date(NOW_MS).toISOString());
    expect(state.quit!.totalRelapses).toBe(3);
  });

  it('prunes milestonesSeen to ≤ the new streak (re-earn higher ones)', () => {
    const { state } = applyRelapse(makeState(), NOW_MS);
    expect(state.quit).not.toBeNull();
    expect(state.milestonesSeen).toEqual([]);
  });

  it('leaves pledge state untouched (pledge streak is independent)', () => {
    const base = makeState();
    base.pledge = { lastPledgeDayKey: '2026-09-27', pledgeStreak: 5 };
    const { state } = applyRelapse(base, NOW_MS);
    expect(state.pledge).toEqual({
      lastPledgeDayKey: '2026-09-27',
      pledgeStreak: 5,
    });
  });

  it('throws when there is no active quit', () => {
    expect(() => applyRelapse(makeState(null), NOW_MS)).toThrow(
      /no active quit/
    );
  });
});
