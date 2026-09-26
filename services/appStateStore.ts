/**
 * appStateStore — envelope-backed persistence for the v2 AppState.
 *
 * Reuses the ported integrity machinery from services/storage.ts
 * (checksum envelope, quarantine, legacy migration) via the generic
 * loadEnvelopedObject / saveEnvelopedObject helpers.
 */
import { loadEnvelopedObject, saveEnvelopedObject } from './storage';
import { AppState, isAppState } from '../types/app';
import { INITIAL_PLEDGE_STATE } from './pledge';

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
