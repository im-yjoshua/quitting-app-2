/**
 * Journal records (journal screen surface) — thin adapter over the canonical
 * voice-journal implementation in services/voiceJournal.ts.
 *
 * The JournalRecord shape is preserved so existing callers don't change;
 * all persistence, file management, and permission work happens in the
 * canonical module.
 */
import { Alert } from 'react-native';
import {
  VoiceJournalEntry,
  deleteVoiceJournal,
  listVoiceJournals,
  requestRecordingPermission,
  saveVoiceJournal,
} from './voiceJournal';

export interface JournalRecord {
  id: string;
  uri: string;
  durationFormatted: string;
  createdAt: string;
  notes?: string;
  durationMillis: number;
}

function formatDuration(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toJournalRecord(entry: VoiceJournalEntry): JournalRecord {
  return {
    id: entry.id,
    uri: entry.uri,
    durationFormatted: formatDuration(entry.durationMillis),
    createdAt: new Date(entry.createdAt).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    notes: entry.notes,
    durationMillis: entry.durationMillis,
  };
}

export async function requestAudioPermissionsSecure(): Promise<boolean> {
  const granted = await requestRecordingPermission();
  if (!granted) {
    Alert.alert(
      'Microphone Access Denied',
      'Please allow microphone access in device settings to use voice journaling.'
    );
  }
  return granted;
}

export async function getJournalRecords(): Promise<JournalRecord[]> {
  const entries = await listVoiceJournals();
  return entries.map(toJournalRecord);
}

export async function saveJournalRecord(
  entry: JournalRecord
): Promise<JournalRecord[]> {
  const updated = await saveVoiceJournal({
    tempUri: entry.uri,
    durationMillis: entry.durationMillis,
    notes: entry.notes,
  });
  return updated.map(toJournalRecord);
}

export async function deleteJournalRecord(
  id: string
): Promise<JournalRecord[]> {
  const updated = await deleteVoiceJournal(id);
  return updated.map(toJournalRecord);
}

// ---------------------------------------------------------------------------
// Dashboard card display shape
// ---------------------------------------------------------------------------

/**
 * Display shape for the dashboard voice-journal card (components/utilities/
 * AudioJournalCard.tsx). The journal screen above uses JournalRecord; the
 * dashboard card uses this shape. Both mappings live in this one module —
 * the only adapter between VoiceJournalEntry and UI — sharing formatDuration.
 */
export interface AudioJournalEntry {
  id: string;
  timestamp: string;
  durationMillis: number;
  uri: string;
}

function toAudioJournalEntry(entry: VoiceJournalEntry): AudioJournalEntry {
  return {
    id: entry.id,
    timestamp: new Date(entry.createdAt).toLocaleString(),
    durationMillis: entry.durationMillis,
    uri: entry.uri,
  };
}

export async function getAudioJournals(): Promise<AudioJournalEntry[]> {
  const entries = await listVoiceJournals();
  return entries.map(toAudioJournalEntry);
}

export async function saveAudioJournal(entry: {
  uri: string;
  durationMillis: number;
}): Promise<AudioJournalEntry[]> {
  const updated = await saveVoiceJournal({
    tempUri: entry.uri,
    durationMillis: entry.durationMillis,
  });
  return updated.map(toAudioJournalEntry);
}

export async function deleteAudioJournal(
  id: string
): Promise<AudioJournalEntry[]> {
  const updated = await deleteVoiceJournal(id);
  return updated.map(toAudioJournalEntry);
}
