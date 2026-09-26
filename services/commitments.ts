/**
 * commitments.ts — App Commitments (the honest Screen Time successor).
 *
 * The user declares which apps they commit to avoid; Sovereign tracks the
 * declaration and nothing more. iOS grants this app no app-blocking
 * entitlements, so nothing here claims to block, limit, or filter anything.
 * Users who want enforced limits are guided to set up iOS Screen Time
 * themselves (the guide copy lives in the You tab).
 *
 * Stored in the checksum envelope (services/storage.ts) under its own key,
 * separate from the v2 AppState. Fresh v2 install → no legacy migration.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadEnvelopedObject,
  saveEnvelopedObject,
} from './storage';

export const COMMITMENTS_STORAGE_KEY = '@sovereign/v2_app_commitments';

const MAX_TRIGGER_APPS = 20;
const MAX_APP_NAME_LENGTH = 40;

export interface AppCommitmentState {
  /** User-declared names of apps they commit to avoid. Never enforced. */
  triggerApps: string[];
}

const DEFAULT_STATE: AppCommitmentState = { triggerApps: [] };

export function isCommitmentState(raw: unknown): raw is AppCommitmentState {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return (
    Array.isArray(o.triggerApps) &&
    o.triggerApps.every((n) => typeof n === 'string')
  );
}

export async function loadCommitments(): Promise<AppCommitmentState> {
  const result = await loadEnvelopedObject(
    COMMITMENTS_STORAGE_KEY,
    isCommitmentState
  );
  if (result.status === 'ok' && result.object !== null) return result.object;
  return { ...DEFAULT_STATE, triggerApps: [] };
}

export async function saveCommitments(
  state: AppCommitmentState
): Promise<boolean> {
  return saveEnvelopedObject(COMMITMENTS_STORAGE_KEY, isCommitmentState, state);
}

export function normalizeAppName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_APP_NAME_LENGTH) return null;
  return name;
}

/** Pure add: dedupes (case-insensitive), caps at 20. */
export function addTriggerApp(
  prev: AppCommitmentState,
  rawName: string
): { state: AppCommitmentState; added: boolean } {
  const name = normalizeAppName(rawName);
  if (!name) return { state: prev, added: false };
  const exists = prev.triggerApps.some(
    (a) => a.toLowerCase() === name.toLowerCase()
  );
  if (exists || prev.triggerApps.length >= MAX_TRIGGER_APPS) {
    return { state: prev, added: false };
  }
  return { state: { triggerApps: [...prev.triggerApps, name] }, added: true };
}

/** Pure remove. */
export function removeTriggerApp(
  prev: AppCommitmentState,
  name: string
): AppCommitmentState {
  return {
    triggerApps: prev.triggerApps.filter(
      (a) => a.toLowerCase() !== name.toLowerCase()
    ),
  };
}

/** Wipes the commitments key (used by erase-all-data). */
export async function clearCommitments(): Promise<void> {
  try {
    await AsyncStorage.removeItem(COMMITMENTS_STORAGE_KEY);
  } catch {
    // Best-effort; the envelope loader treats missing keys as defaults.
  }
}
