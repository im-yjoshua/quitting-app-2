import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AppStateData,
  UserProfile,
  RelapseRecord,
  CircadianDayRecord,
  CircadianHistory,
  CURRENT_SCHEMA_VERSION,
  SerializationResult,
  StorageEnvelope,
  TelemetryExportPayload,
  isCircadianHistory,
  isRelapseRecord,
  isStorageEnvelope,
  isTelemetryExportPayload,
  isUserProfile,
} from '../types/app';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Primary key for the envelope-backed app state (unchanged from v1 installs). */
const APP_STATE_KEY = '@sovereign/app_state';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_APP_STATE: AppStateData = {
  profile: {
    habitTitle: 'Digital Freedom',
    habitCategory: 'digital_distraction',
    startDate: Date.now(),
    bestRecordMs: 0,
    attemptCount: 1,
    weeklyCostEstimated: 0,
    dailyMinutesWasted: 0,
    auraScore: 0,
    tierStatus: 'Initiate',
    isOnboarded: false,
    biometricsEnabled: false,
  },
  relapseHistory: [],
  interventionState: {
    lastCompletedAt: null,
    cooldownUntil: null,
  },
  circadianHistory: {},
  activeChallengeId: null,
};

// ---------------------------------------------------------------------------
// Integrity primitives
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash, hex-encoded. Used as a corruption-detection checksum for
 * stored payloads. This is an integrity check, not cryptography — it catches
 * truncated writes, manual tampering, and restore glitches, nothing more.
 */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Runtime guard for a full AppStateData snapshot. Composes the granular guards
 * from types/app.ts so stored payloads are validated before the app trusts them.
 */
function isAppStateData(raw: unknown): raw is AppStateData {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<AppStateData>;
  const intervention = s.interventionState as
    | { lastCompletedAt?: unknown; cooldownUntil?: unknown }
    | undefined;
  if (!intervention) return false;
  const { lastCompletedAt, cooldownUntil } = intervention;
  return (
    isUserProfile(s.profile) &&
    Array.isArray(s.relapseHistory) &&
    s.relapseHistory.every(isRelapseRecord) &&
    (lastCompletedAt === null ||
      (typeof lastCompletedAt === 'number' && !isNaN(lastCompletedAt))) &&
    (cooldownUntil === null ||
      (typeof cooldownUntil === 'number' && !isNaN(cooldownUntil))) &&
    isCircadianHistory(s.circadianHistory) &&
    (s.activeChallengeId === null || typeof s.activeChallengeId === 'string')
  );
}

/**
 * Versioned migration hook. Raw pre-envelope payloads and older envelopes
 * converge here before being re-saved in the current format.
 */
function migrateAppState(state: AppStateData, fromVersion: number): AppStateData {
  // v1 -> v2: the envelope itself is the v2 format; the AppStateData shape did
  // not change, so there is nothing to rewrite. Add versioned branches here
  // when the shape changes in the future.
  void fromVersion;
  return state;
}

async function writeEnvelope(state: AppStateData): Promise<boolean> {
  try {
    const dataJson = JSON.stringify(state);
    const envelope: StorageEnvelope<AppStateData> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAt: Date.now(),
      checksum: fnv1a32(dataJson),
      data: state,
    };
    await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(envelope));
    return true;
  } catch (error) {
    console.warn('[Storage] Failed to write app state envelope:', error);
    return false;
  }
}

/**
 * Moves an unreadable payload aside under a timestamped quarantine key and
 * removes the corrupt primary key, so a bad write can never poison every
 * subsequent launch. The original bytes are preserved for manual recovery.
 */
async function quarantineCorruptPayload(
  key: string,
  raw: string
): Promise<string> {
  const quarantineKey = `${key}.corrupt.${Date.now()}`;
  try {
    await AsyncStorage.setItem(quarantineKey, raw);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to quarantine corrupt payload at "${key}":`, error);
  }
  return quarantineKey;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export type StorageLoadStatus =
  | 'ok'
  | 'fresh-install'
  | 'migrated-from-legacy'
  | 'corrupted-quarantined';

export interface StorageLoadResult {
  readonly status: StorageLoadStatus;
  readonly state: AppStateData;
  /** Present only when status is 'corrupted-quarantined'. */
  readonly quarantinedKey?: string;
}

/**
 * Loads the stored app state with an explicit status. Corrupt or unparseable
 * payloads are quarantined under a separate key — the app never silently
 * discards user data, and callers can distinguish a fresh install from a
 * recovered-from-corruption state.
 */
export async function loadStoredAppStateDetailed(): Promise<StorageLoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(APP_STATE_KEY);
  } catch (error) {
    console.warn('[Storage] Failed to read app state key:', error);
    return { status: 'fresh-install', state: DEFAULT_APP_STATE };
  }

  if (raw === null) {
    return { status: 'fresh-install', state: DEFAULT_APP_STATE };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const quarantinedKey = await quarantineCorruptPayload(APP_STATE_KEY, raw);
    return {
      status: 'corrupted-quarantined',
      state: DEFAULT_APP_STATE,
      quarantinedKey,
    };
  }

  // Current format: checksum-verified envelope.
  if (isStorageEnvelope<AppStateData>(parsed)) {
    const dataJson = JSON.stringify(parsed.data);
    if (parsed.checksum !== fnv1a32(dataJson) || !isAppStateData(parsed.data)) {
      const quarantinedKey = await quarantineCorruptPayload(APP_STATE_KEY, raw);
      return {
        status: 'corrupted-quarantined',
        state: DEFAULT_APP_STATE,
        quarantinedKey,
      };
    }
    if (parsed.schemaVersion < CURRENT_SCHEMA_VERSION) {
      const migrated = migrateAppState(parsed.data, parsed.schemaVersion);
      await writeEnvelope(migrated);
      return { status: 'migrated-from-legacy', state: migrated };
    }
    // Envelope from a newer app version: use as-is, never clobber it.
    return { status: 'ok', state: parsed.data };
  }

  // Legacy format: raw pre-envelope payloads written by v1 installs.
  if (isAppStateData(parsed)) {
    await writeEnvelope(parsed);
    return { status: 'migrated-from-legacy', state: parsed };
  }

  // Unrecognized shape: quarantine, do not trust.
  const quarantinedKey = await quarantineCorruptPayload(APP_STATE_KEY, raw);
  return {
    status: 'corrupted-quarantined',
    state: DEFAULT_APP_STATE,
    quarantinedKey,
  };
}

/**
 * Backwards-compatible loader. Corruption is quarantined and logged with the
 * quarantine key — never a silent reset.
 */
export async function loadStoredAppState(): Promise<AppStateData> {
  const result = await loadStoredAppStateDetailed();
  if (result.status === 'corrupted-quarantined') {
    console.warn(
      `[Storage] Corrupt app-state payload quarantined at "${result.quarantinedKey}". ` +
        'Returning defaults; the original payload was preserved for recovery.'
    );
  }
  return result.state;
}

// ---------------------------------------------------------------------------
// Saving and granular updaters
// ---------------------------------------------------------------------------

/**
 * Persists the full app state inside a checksum-verified envelope. Refuses to
 * write payloads that fail validation rather than persisting garbage.
 */
export async function saveStoredAppState(state: AppStateData): Promise<boolean> {
  if (!isAppStateData(state)) {
    console.warn('[Storage] Refusing to persist invalid app state.');
    return false;
  }
  return writeEnvelope(state);
}

export async function updateUserProfile(
  updater: (prev: UserProfile) => UserProfile
): Promise<UserProfile> {
  const state = await loadStoredAppState();
  const nextProfile = updater(state.profile);
  await saveStoredAppState({ ...state, profile: nextProfile });
  return nextProfile;
}

export async function appendRelapseRecord(
  record: RelapseRecord
): Promise<RelapseRecord[]> {
  const state = await loadStoredAppState();
  const nextHistory = [record, ...state.relapseHistory];
  await saveStoredAppState({ ...state, relapseHistory: nextHistory });
  return nextHistory;
}

export async function updateCircadianDay(
  dateKey: string,
  updater: (prev: CircadianDayRecord) => CircadianDayRecord
): Promise<CircadianHistory> {
  const state = await loadStoredAppState();
  const existing = state.circadianHistory[dateKey] || {
    dateString: dateKey,
    amCompleted: false,
    amCompletedAt: null,
    pmCompleted: false,
    pmCompletedAt: null,
    multiplierActive: false,
  };
  const updatedDay = updater(existing);
  const nextHistory = { ...state.circadianHistory, [dateKey]: updatedDay };
  await saveStoredAppState({ ...state, circadianHistory: nextHistory });
  return nextHistory;
}

// ---------------------------------------------------------------------------
// Write-queue seam
// ---------------------------------------------------------------------------

export async function forceFlushPendingWrites(): Promise<void> {
  // AsyncStorage applies every write immediately; there is no in-memory write
  // buffer to flush. This is a seam so a future write queue can hook in here
  // without changing callers (e.g. the AppState background handler).
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Air-gapped telemetry backup (real implementation)
// ---------------------------------------------------------------------------

/**
 * Serializes the current app state into a checksummed TelemetryExportPayload.
 * The caller decides how to share the resulting JSON (share sheet, file, …).
 */
export async function exportTelemetryBackup(): Promise<
  SerializationResult<string>
> {
  const state = await loadStoredAppState();
  try {
    const stateJson = JSON.stringify(state);
    const payload: TelemetryExportPayload = {
      exportVersion: 1,
      exportedAt: Date.now(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      checksum: fnv1a32(stateJson),
      deviceMetadata: { airGapped: true, platform: Platform.OS },
      state,
    };
    return { success: true, data: JSON.stringify(payload) };
  } catch (error) {
    return {
      success: false,
      error: `Failed to serialize telemetry backup: ${String(error)}`,
    };
  }
}

/**
 * Restores app state from a telemetry backup produced by exportTelemetryBackup.
 * The payload shape, checksum, and state are all validated before anything is
 * written; invalid backups are rejected with a reason, never half-applied.
 */
export async function importTelemetryBackup(
  json: string
): Promise<{ success: boolean; data?: AppStateData; error?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: 'Backup is not valid JSON.' };
  }
  if (!isTelemetryExportPayload(parsed)) {
    return {
      success: false,
      error: 'Backup is not a recognized Sovereign telemetry payload.',
    };
  }
  if (parsed.checksum !== fnv1a32(JSON.stringify(parsed.state))) {
    return {
      success: false,
      error: 'Backup checksum mismatch — the file may be damaged.',
    };
  }
  if (!isAppStateData(parsed.state)) {
    return { success: false, error: 'Backup contains invalid app state.' };
  }
  const saved = await saveStoredAppState(parsed.state);
  if (!saved) {
    return {
      success: false,
      error: 'Backup is valid but could not be saved on this device.',
    };
  }
  return { success: true, data: parsed.state };
}

// ---------------------------------------------------------------------------
// Generic envelope helpers for auxiliary typed lists
// ---------------------------------------------------------------------------

export type EnvelopedListStatus =
  | 'ok'
  | 'fresh-install'
  | 'migrated-from-legacy'
  | 'corrupted-quarantined';

export interface EnvelopedListResult<T> {
  readonly status: EnvelopedListStatus;
  readonly list: T[];
  /** Present only when status is 'corrupted-quarantined'. */
  readonly quarantinedKey?: string;
}

async function writeEnvelopedValue<T>(key: string, data: T): Promise<boolean> {
  try {
    const dataJson = JSON.stringify(data);
    const envelope: StorageEnvelope<T> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAt: Date.now(),
      checksum: fnv1a32(dataJson),
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to write envelope at "${key}":`, error);
    return false;
  }
}

/**
 * Loads a typed list stored under its own key inside a checksum-verified
 * envelope — the same integrity guarantees as the main app state, without
 * forcing every feature's data into the AppStateData shape.
 *
 * Bare-JSON arrays left by pre-envelope code are validated and migrated into
 * envelopes automatically; corrupt payloads are quarantined, never trusted.
 */
export async function loadEnvelopedList<T>(
  key: string,
  guard: (raw: unknown) => raw is T[]
): Promise<EnvelopedListResult<T>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to read key "${key}":`, error);
    return { status: 'fresh-install', list: [] };
  }

  if (raw === null) {
    return { status: 'fresh-install', list: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const quarantinedKey = await quarantineCorruptPayload(key, raw);
    return { status: 'corrupted-quarantined', list: [], quarantinedKey };
  }

  if (isStorageEnvelope<T[]>(parsed)) {
    const dataJson = JSON.stringify(parsed.data);
    if (parsed.checksum !== fnv1a32(dataJson) || !guard(parsed.data)) {
      const quarantinedKey = await quarantineCorruptPayload(key, raw);
      return { status: 'corrupted-quarantined', list: [], quarantinedKey };
    }
    return { status: 'ok', list: parsed.data };
  }

  // Legacy format: a bare JSON array. Validate, then migrate into an envelope.
  if (guard(parsed)) {
    await writeEnvelopedValue(key, parsed);
    return { status: 'migrated-from-legacy', list: parsed };
  }

  const quarantinedKey = await quarantineCorruptPayload(key, raw);
  return { status: 'corrupted-quarantined', list: [], quarantinedKey };
}

/**
 * Persists a typed list inside a checksum-verified envelope. Refuses to write
 * payloads that fail validation rather than persisting garbage.
 */
export async function saveEnvelopedList<T>(
  key: string,
  guard: (raw: unknown) => raw is T[],
  list: T[]
): Promise<boolean> {
  if (!guard(list)) {
    console.warn(`[Storage] Refusing to persist invalid list at "${key}".`);
    return false;
  }
  return writeEnvelopedValue(key, list);
}

export type EnvelopedObjectStatus =
  | 'ok'
  | 'fresh-install'
  | 'migrated-from-legacy'
  | 'corrupted-quarantined';

export interface EnvelopedObjectResult<T> {
  readonly status: EnvelopedObjectStatus;
  readonly object: T | null;
  /** Present only when status is 'corrupted-quarantined'. */
  readonly quarantinedKey?: string;
}

/**
 * Loads a single typed object stored under its own key inside a
 * checksum-verified envelope. Bare-JSON objects left by pre-envelope code are
 * validated and migrated into envelopes automatically; corrupt payloads are
 * quarantined, never trusted.
 */
export async function loadEnvelopedObject<T>(
  key: string,
  guard: (raw: unknown) => raw is T
): Promise<EnvelopedObjectResult<T>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to read key "${key}":`, error);
    return { status: 'fresh-install', object: null };
  }

  if (raw === null) {
    return { status: 'fresh-install', object: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const quarantinedKey = await quarantineCorruptPayload(key, raw);
    return { status: 'corrupted-quarantined', object: null, quarantinedKey };
  }

  if (isStorageEnvelope<T>(parsed)) {
    const dataJson = JSON.stringify(parsed.data);
    if (parsed.checksum !== fnv1a32(dataJson) || !guard(parsed.data)) {
      const quarantinedKey = await quarantineCorruptPayload(key, raw);
      return { status: 'corrupted-quarantined', object: null, quarantinedKey };
    }
    return { status: 'ok', object: parsed.data };
  }

  // Legacy format: a bare JSON object. Validate, then migrate into an envelope.
  if (guard(parsed)) {
    await writeEnvelopedValue(key, parsed);
    return { status: 'migrated-from-legacy', object: parsed };
  }

  const quarantinedKey = await quarantineCorruptPayload(key, raw);
  return { status: 'corrupted-quarantined', object: null, quarantinedKey };
}

/**
 * Persists a single typed object inside a checksum-verified envelope. Refuses
 * to write payloads that fail validation rather than persisting garbage.
 */
export async function saveEnvelopedObject<T>(
  key: string,
  guard: (raw: unknown) => raw is T,
  object: T
): Promise<boolean> {
  if (!guard(object)) {
    console.warn(`[Storage] Refusing to persist invalid object at "${key}".`);
    return false;
  }
  return writeEnvelopedValue(key, object);
}
