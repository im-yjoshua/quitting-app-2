/**
 * Journal logic — pure functions, fully unit-tested.
 *
 * Text check-ins are free and unlimited. Entries live in AppState.journal,
 * persisted through the checksum envelope via services/appStateStore.
 * (Voice notes live in the canonical voiceJournal store and are merged
 * at render time; they're premium-gated — see the journal screen.)
 */
import { getLocalDateKey } from './chronometerEngine';
import type { AppState, JournalEntry } from '../types/app';

let journalIdCounter = 0;

function newJournalId(nowMs: number): string {
  journalIdCounter += 1;
  return `journal_${nowMs}_${journalIdCounter}`;
}

/** Builds a text check-in entry. The note is trimmed; craving may be null. */
export function createJournalEntry(
  note: string,
  craving: 1 | 2 | 3 | 4 | 5 | null,
  nowMs: number
): JournalEntry {
  return {
    id: newJournalId(nowMs),
    dayKey: getLocalDateKey(nowMs),
    craving,
    note: note.trim(),
    createdAt: new Date(nowMs).toISOString(),
  };
}

/** Newest-first prepend. */
export function addJournalEntry(
  prev: AppState,
  entry: JournalEntry
): AppState {
  return { ...prev, journal: [entry, ...prev.journal] };
}

export function deleteJournalEntry(prev: AppState, id: string): AppState {
  return { ...prev, journal: prev.journal.filter((e) => e.id !== id) };
}

export interface JournalDayGroup {
  dayKey: string;
  entries: JournalEntry[];
}

/**
 * Groups entries into reverse-chron day buckets; entries within a day are
 * newest first. Tolerates unsorted input.
 */
export function groupEntriesByDay(
  entries: JournalEntry[]
): JournalDayGroup[] {
  const sorted = [...entries].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
  const groups: JournalDayGroup[] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === entry.dayKey) {
      last.entries.push(entry);
    } else {
      groups.push({ dayKey: entry.dayKey, entries: [entry] });
    }
  }
  return groups;
}

/** "Today" / "Yesterday" / "Sep 24" style day header for a group. */
export function formatDayHeader(dayKey: string, nowMs: number): string {
  const todayKey = getLocalDateKey(nowMs);
  if (dayKey === todayKey) return 'Today';
  const [y, m, d] = dayKey.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const daysAgo = Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(y, m - 1, d).getTime()) /
      86_400_000
  );
  if (daysAgo === 1) return 'Yesterday';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
