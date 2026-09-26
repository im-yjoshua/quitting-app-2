/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Journal — services/journal.ts + persistence round-trip through
// services/appStateStore (spec §2.7 + §7).
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
      multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
        keys.map((k) => [k, mockAsyncStore.get(k) ?? null]),
      multiSet: async (pairs: [string, string][]): Promise<void> => {
        for (const [k, v] of pairs) mockAsyncStore.set(k, v);
      },
      multiRemove: async (keys: string[]): Promise<void> => {
        for (const k of keys) mockAsyncStore.delete(k);
      },
      getAllKeys: async (): Promise<string[]> => [...mockAsyncStore.keys()],
      clear: async (): Promise<void> => {
        mockAsyncStore.clear();
      },
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import {
  addJournalEntry,
  createJournalEntry,
  deleteJournalEntry,
  formatDayHeader,
  groupEntriesByDay,
} from '../services/journal';
import {
  defaultAppState,
  loadAppState,
  updateAppState,
} from '../services/appStateStore';
import { getLocalDateKey } from '../services/chronometerEngine';
import { isAppState } from '../types/app';
import type { AppState, JournalEntry } from '../types/app';

beforeEach(() => {
  mockAsyncStore.clear();
});

// Fixed "now": 2026-09-27 12:00:00 UTC (08:00 in the pinned TZ).
const NOW_MS = Date.parse('2026-09-27T12:00:00.000Z');
const DAY_MS = 86_400_000;

function makeEntry(
  note: string,
  craving: 1 | 2 | 3 | 4 | 5 | null,
  atMs: number
): JournalEntry {
  return createJournalEntry(note, craving, atMs);
}

describe('createJournalEntry', () => {
  it('builds a well-shaped entry', () => {
    const entry = makeEntry('  rough morning  ', 3, NOW_MS);
    expect(entry.id).toMatch(/^journal_/);
    expect(entry.dayKey).toBe(getLocalDateKey(NOW_MS));
    expect(entry.dayKey).toBe('2026-09-27');
    expect(entry.craving).toBe(3);
    expect(entry.note).toBe('rough morning'); // trimmed
    expect(entry.createdAt).toBe(new Date(NOW_MS).toISOString());
    expect(entry.voiceUri).toBeUndefined();
  });

  it('allows a null craving (plain note)', () => {
    const entry = makeEntry('grateful today', null, NOW_MS);
    expect(entry.craving).toBeNull();
  });

  it('generates unique ids even within the same millisecond', () => {
    const a = makeEntry('a', 1, NOW_MS);
    const b = makeEntry('b', 1, NOW_MS);
    expect(a.id).not.toBe(b.id);
  });
});

describe('addJournalEntry / deleteJournalEntry', () => {
  it('prepends newest-first', () => {
    const base: AppState = defaultAppState();
    const first = makeEntry('first', 2, NOW_MS - DAY_MS);
    const second = makeEntry('second', 4, NOW_MS);
    const next = addJournalEntry(addJournalEntry(base, first), second);
    expect(next.journal.map((e) => e.note)).toEqual(['second', 'first']);
  });

  it('deletes by id and keeps the rest', () => {
    const base: AppState = defaultAppState();
    const keep = makeEntry('keep', 1, NOW_MS);
    const drop = makeEntry('drop', 5, NOW_MS);
    const added = addJournalEntry(addJournalEntry(base, keep), drop);
    const next = deleteJournalEntry(added, drop.id);
    expect(next.journal.map((e) => e.note)).toEqual(['keep']);
  });

  it('keeps the state valid per the runtime guard', () => {
    const base: AppState = defaultAppState();
    const next = addJournalEntry(base, makeEntry('valid', 3, NOW_MS));
    expect(isAppState(next)).toBe(true);
  });
});

describe('groupEntriesByDay', () => {
  it('groups reverse-chronologically by day', () => {
    const entries = [
      makeEntry('day1-a', 2, NOW_MS - 2 * DAY_MS),
      makeEntry('day2', 3, NOW_MS - DAY_MS),
      makeEntry('day1-b', 4, NOW_MS - 2 * DAY_MS + 3_600_000),
    ];
    const groups = groupEntriesByDay(entries);
    expect(groups.map((g) => g.dayKey)).toEqual([
      getLocalDateKey(NOW_MS - DAY_MS),
      getLocalDateKey(NOW_MS - 2 * DAY_MS),
    ]);
    // Within a day: newest first.
    expect(groups[1].entries.map((e) => e.note)).toEqual(['day1-b', 'day1-a']);
  });

  it('returns [] for no entries', () => {
    expect(groupEntriesByDay([])).toEqual([]);
  });
});

describe('formatDayHeader', () => {
  it('says Today for today', () => {
    expect(formatDayHeader(getLocalDateKey(NOW_MS), NOW_MS)).toBe('Today');
  });

  it('says Yesterday for yesterday', () => {
    expect(
      formatDayHeader(getLocalDateKey(NOW_MS - DAY_MS), NOW_MS)
    ).toBe('Yesterday');
  });

  it('renders a short date for older days', () => {
    const header = formatDayHeader(
      getLocalDateKey(NOW_MS - 7 * DAY_MS),
      NOW_MS
    );
    expect(header).toMatch(/^\w{3} \d{1,2}$/); // e.g. "Sep 20"
  });
});

describe('journal persistence round-trip (via the store)', () => {
  it('survives save → load through the checksum envelope', async () => {
    const entry = makeEntry('round trip', 4, NOW_MS);
    await updateAppState((prev) => addJournalEntry(prev, entry));

    const loaded = await loadAppState();
    expect(isAppState(loaded)).toBe(true);
    expect(loaded.journal).toHaveLength(1);
    expect(loaded.journal[0]).toEqual(entry);
  });

  it('round-trips a deletion', async () => {
    const keep = makeEntry('keep', 1, NOW_MS);
    const drop = makeEntry('drop', 5, NOW_MS);
    await updateAppState((prev) =>
      addJournalEntry(addJournalEntry(prev, keep), drop)
    );
    await updateAppState((prev) => deleteJournalEntry(prev, drop.id));

    const loaded = await loadAppState();
    expect(loaded.journal.map((e) => e.note)).toEqual(['keep']);
  });
});
