/**
 * Voice journaling — the single real implementation.
 *
 * Recordings are captured with expo-audio, moved into the app's document
 * directory (so OS cache purges can't eat them), and their metadata is kept
 * in a checksum-verified storage envelope via the shared helpers in
 * services/storage.ts. No mock URIs, no simulated playback.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import {
  loadEnvelopedList,
  saveEnvelopedList,
} from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical voice journal entry. `uri` always points at a real audio file. */
export interface VoiceJournalEntry {
  id: string;
  uri: string;
  durationMillis: number;
  /** ISO-8601 timestamp of when the recording was saved. */
  createdAt: string;
  notes?: string;
}

export function isVoiceJournalEntry(raw: unknown): raw is VoiceJournalEntry {
  if (!raw || typeof raw !== 'object') return false;
  const e = raw as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.uri === 'string' &&
    e.uri.length > 0 &&
    typeof e.durationMillis === 'number' &&
    e.durationMillis > 0 &&
    typeof e.createdAt === 'string' &&
    !isNaN(Date.parse(e.createdAt)) &&
    (e.notes === undefined || typeof e.notes === 'string')
  );
}

function isVoiceJournalList(raw: unknown): raw is VoiceJournalEntry[] {
  return Array.isArray(raw) && raw.every(isVoiceJournalEntry);
}

/** Input for saving: the recorder hands us a temp file, we persist it. */
export interface NewVoiceJournalInput {
  /** Temp URI produced by the recorder (cache directory). */
  tempUri: string;
  durationMillis: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Keys & files
// ---------------------------------------------------------------------------

const VOICE_JOURNALS_KEY = '@sovereign/voice_journals';

/** Pre-envelope keys written while recording was mocked. Cleaned up on first run. */
const LEGACY_JOURNAL_KEYS = [
  '@sovereign/audio_journals',
  '@sovereign/journal_records',
];

const RECORDINGS_DIR_NAME = 'voice-journals';

/** Monotonic counter so ids are unique even within the same millisecond. */
let voiceJournalIdCounter = 0;

function newVoiceJournalId(): string {
  voiceJournalIdCounter += 1;
  return `voice_${Date.now()}_${voiceJournalIdCounter}`;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Requests microphone access. Returns false on denial or failure — never
 * throws, never claims a permission that wasn't granted.
 */
export async function requestRecordingPermission(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch (error) {
    console.warn('[VoiceJournal] Failed to request recording permission:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// File management
// ---------------------------------------------------------------------------

/**
 * Moves a fresh recording out of the temp/cache directory into the app's
 * document directory, where the OS won't purge it. Returns the final URI.
 * Falls back to the temp URI (with a warning) if the move fails, so a
 * recording is never silently lost.
 */
async function persistRecordingFile(
  tempUri: string,
  id: string
): Promise<string> {
  try {
    const base = FileSystem.documentDirectory;
    if (!base) {
      console.warn(
        '[VoiceJournal] No document directory available; keeping recording at its temp URI.'
      );
      return tempUri;
    }
    const dirUri = `${base}${RECORDINGS_DIR_NAME}/`;
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
    const destUri = `${dirUri}${id}.m4a`;
    await FileSystem.moveAsync({ from: tempUri, to: destUri });
    return destUri;
  } catch (error) {
    console.warn('[VoiceJournal] Failed to move recording into documents:', error);
    return tempUri;
  }
}

async function deleteRecordingFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('[VoiceJournal] Failed to delete recording file:', error);
  }
}

// ---------------------------------------------------------------------------
// Legacy cleanup
// ---------------------------------------------------------------------------

interface LegacyJournalItem {
  id?: unknown;
  uri?: unknown;
  durationMillis?: unknown;
  notes?: unknown;
  timestamp?: unknown;
  createdAt?: unknown;
}

/**
 * Converts one pre-envelope legacy item into the canonical shape.
 * Returns null for anything that isn't a real recording — in particular,
 * entries pointing at the old mock URI (`file://mock-audio-recording.m4a`)
 * are dropped: that audio never existed, and resurrecting phantom entries
 * would be dishonest.
 */
function normalizeLegacyItem(item: unknown): VoiceJournalEntry | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as LegacyJournalItem;
  const uri = typeof raw.uri === 'string' ? raw.uri : '';
  if (!uri || uri.includes('mock')) return null;
  const durationMillis =
    typeof raw.durationMillis === 'number' ? raw.durationMillis : 0;
  if (durationMillis <= 0) return null;
  const id =
    typeof raw.id === 'string' && raw.id.length > 0
      ? raw.id
      : newVoiceJournalId();
  const notes = typeof raw.notes === 'string' ? raw.notes : undefined;
  const dateSource =
    typeof raw.createdAt === 'string'
      ? raw.createdAt
      : typeof raw.timestamp === 'string'
        ? raw.timestamp
        : null;
  const parsedDate = dateSource ? Date.parse(dateSource) : NaN;
  return {
    id,
    uri,
    durationMillis: Math.round(durationMillis),
    createdAt: isNaN(parsedDate)
      ? new Date().toISOString()
      : new Date(parsedDate).toISOString(),
    ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
  };
}

/**
 * One-time migration from the pre-envelope keys. Runs only when the canonical
 * key has never been written. Legacy keys are removed afterwards whether or
 * not anything salvageable was found, so mock-era junk can't linger.
 */
async function migrateLegacyEntries(): Promise<VoiceJournalEntry[]> {
  const migrated: VoiceJournalEntry[] = [];
  const seenIds = new Set<string>();
  for (const key of LEGACY_JOURNAL_KEYS) {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn(`[VoiceJournal] Failed to read legacy key "${key}":`, error);
    }
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const entry = normalizeLegacyItem(item);
            if (entry && !seenIds.has(entry.id)) {
              seenIds.add(entry.id);
              migrated.push(entry);
            }
          }
        }
      } catch (error) {
        console.warn(
          `[VoiceJournal] Legacy key "${key}" is not valid JSON; skipping.`,
          error
        );
      }
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(
        `[VoiceJournal] Failed to remove legacy key "${key}":`,
        error
      );
    }
  }
  // Newest first, matching the previous list ordering.
  migrated.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return migrated;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Lists all voice journal entries, newest first. */
export async function listVoiceJournals(): Promise<VoiceJournalEntry[]> {
  const result = await loadEnvelopedList(VOICE_JOURNALS_KEY, isVoiceJournalList);
  if (result.status === 'fresh-install') {
    const migrated = await migrateLegacyEntries();
    if (migrated.length > 0) {
      const saved = await saveEnvelopedList(
        VOICE_JOURNALS_KEY,
        isVoiceJournalList,
        migrated
      );
      if (!saved) {
        console.warn(
          '[VoiceJournal] Migrated entries could not be persisted; returning them in memory only.'
        );
      }
      return migrated;
    }
    return [];
  }
  if (result.status === 'corrupted-quarantined') {
    console.warn(
      `[VoiceJournal] Corrupt voice-journal payload quarantined at "${result.quarantinedKey}". Starting with an empty list; the original bytes were preserved.`
    );
  }
  return result.list;
}

/**
 * Saves a fresh recording: moves the temp file into the document directory,
 * then persists the metadata envelope. If metadata persistence fails, the
 * moved file is removed again so a save is atomic — never a phantom entry,
 * never an orphaned file.
 */
export async function saveVoiceJournal(
  input: NewVoiceJournalInput
): Promise<VoiceJournalEntry[]> {
  const id = newVoiceJournalId();
  const uri = await persistRecordingFile(input.tempUri, id);
  const entry: VoiceJournalEntry = {
    id,
    uri,
    durationMillis: Math.max(1, Math.round(input.durationMillis)),
    createdAt: new Date().toISOString(),
    ...(input.notes && input.notes.trim()
      ? { notes: input.notes.trim() }
      : {}),
  };
  if (!isVoiceJournalEntry(entry)) {
    await deleteRecordingFile(uri);
    return listVoiceJournals();
  }
  const current = await listVoiceJournals();
  const updated = [entry, ...current.filter((e) => e.id !== id)];
  const saved = await saveEnvelopedList(
    VOICE_JOURNALS_KEY,
    isVoiceJournalList,
    updated
  );
  if (!saved) {
    await deleteRecordingFile(uri);
    console.warn(
      '[VoiceJournal] Metadata save failed; the recording file was removed to avoid orphans.'
    );
    return current;
  }
  return updated;
}

/**
 * Deletes a recording: removes the audio file (idempotent) and drops the
 * metadata entry. Returns the remaining entries, newest first.
 */
export async function deleteVoiceJournal(
  id: string
): Promise<VoiceJournalEntry[]> {
  const current = await listVoiceJournals();
  const target = current.find((e) => e.id === id);
  const updated = current.filter((e) => e.id !== id);
  if (target) {
    await deleteRecordingFile(target.uri);
  }
  await saveEnvelopedList(VOICE_JOURNALS_KEY, isVoiceJournalList, updated);
  return updated;
}
