/**
 * appStateStore — envelope-backed persistence for the v2 AppState.
 *
 * Reuses the ported integrity machinery from services/storage.ts
 * (checksum envelope, quarantine, legacy migration) via the generic
 * loadEnvelopedObject / saveEnvelopedObject helpers.
 */
import { fnv1a32, loadEnvelopedObject, saveEnvelopedObject } from './storage';
import { AppState, isAppState } from '../types/app';
import { INITIAL_PLEDGE_STATE } from './pledge';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Storage key for the v2 quit-tracking state (separate from v1's key). */
export const V2_APP_STATE_KEY = '@sovereign/v2_app_state';

export function defaultAppState(): AppState {
  return {
    schemaVersion: 2,
    quit: null,
    pledge: { ...INITIAL_PLEDGE_STATE },
    relapseLog: [],
    journal: [],
    milestonesSeen: [],
    urgeSurfs: [],
    settings: {
      pledgeReminder: true,
      milestoneAlerts: true,
      orbTheme: 'dawn',
      shareCardStyle: 'classic',
    },
  };
}

/**
 * Loads the persisted v2 state. Fresh installs, quarantined-corrupt payloads,
 * and wrong-shape payloads all resolve to defaults — the caller can never
 * receive untrusted state.
 */
export async function loadAppState(): Promise<AppState> {
  const result = await loadEnvelopedObject(V2_APP_STATE_KEY, isAppState);
  if (result.status === 'ok' && result.object !== null) {
    return result.object;
  }
  return defaultAppState();
}

/** Persists the v2 state. Refuses invalid payloads (guard enforced). */
export async function saveAppState(state: AppState): Promise<boolean> {
  return saveEnvelopedObject(V2_APP_STATE_KEY, isAppState, state);
}

/** Load → transform → save in one step. Returns the new state. */
export async function updateAppState(
  updater: (prev: AppState) => AppState
): Promise<AppState> {
  const prev = await loadAppState();
  const next = updater(prev);
  await saveAppState(next);
  return next;
}

/**
 * Destructive erase: removes the v2 app-state envelope and the notification
 * schedule record. The cached purchase entitlement is intentionally kept —
 * it belongs to the store account, not to personal data, and can be
 * re-verified with Restore Purchases.
 */
export async function eraseAllAppData(): Promise<void> {
  const keys = [V2_APP_STATE_KEY, '@sovereign/notifications_schedule'];
  for (const key of keys) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Best-effort; a missing key is the desired end state anyway.
    }
  }
}

// ---------------------------------------------------------------------------
// v2 backup export/import — checksummed JSON of the REAL v2 AppState.
// ---------------------------------------------------------------------------

export interface V2BackupPayload {
  exportVersion: 2;
  exportedAt: number;
  checksum: string;
  state: AppState;
}

/**
 * Integrity status for the You tab's Data & Backup row: verifies the
 * checksum envelope without changing anything.
 */
export async function verifyV2Integrity(): Promise<'verified' | 'recovered'> {
  const result = await loadEnvelopedObject(V2_APP_STATE_KEY, isAppState);
  return result.status === 'ok' ? 'verified' : 'recovered';
}

function isV2BackupPayload(raw: unknown): raw is V2BackupPayload {
  if (typeof raw !== 'object' || raw === null) return false;
  const p = raw as Partial<V2BackupPayload>;
  return (
    p.exportVersion === 2 &&
    typeof p.exportedAt === 'number' &&
    typeof p.checksum === 'string' &&
    isAppState(p.state)
  );
}

/** Serializes the current v2 AppState into checksummed JSON for backup. */
export async function exportV2Backup(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const state = await loadAppState();
    const stateJson = JSON.stringify(state);
    const payload: V2BackupPayload = {
      exportVersion: 2,
      exportedAt: Date.now(),
      checksum: fnv1a32(stateJson),
      state,
    };
    return { success: true, data: JSON.stringify(payload) };
  } catch (error) {
    return { success: false, error: `Backup failed: ${String(error)}` };
  }
}

/**
 * Restores the v2 AppState from a backup JSON string. Shape, checksum, and
 * state are all validated BEFORE anything is written — a damaged file is
 * rejected with a reason and never half-applied.
 */
export async function importV2Backup(json: string): Promise<{
  success: boolean;
  error?: string;
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: 'That file is not valid JSON.' };
  }
  if (!isV2BackupPayload(parsed)) {
    return {
      success: false,
      error: 'That file is not a recognized Sovereign backup.',
    };
  }
  if (parsed.checksum !== fnv1a32(JSON.stringify(parsed.state))) {
    return {
      success: false,
      error: 'Backup checksum mismatch — the file may be damaged.',
    };
  }
  const saved = await saveAppState(parsed.state);
  if (!saved) {
    return {
      success: false,
      error: 'Backup is valid but could not be saved on this device.',
    };
  }
  return { success: true };
}
