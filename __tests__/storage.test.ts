/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Storage integrity tests — services/storage.ts with an in-memory AsyncStorage.
// ---------------------------------------------------------------------------

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
  loadStoredAppStateDetailed,
  saveStoredAppState,
  exportTelemetryBackup,
  importTelemetryBackup,
  DEFAULT_APP_STATE,
} from '../services/storage';
import type { AppStateData } from '../types/app';

const APP_STATE_KEY = '@sovereign/app_state';

/** Local copy of the storage checksum so tests can craft envelopes. */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function makeState(overrides: Partial<AppStateData['profile']> = {}): AppStateData {
  return {
    ...DEFAULT_APP_STATE,
    profile: {
      ...DEFAULT_APP_STATE.profile,
      habitTitle: 'Test Habit',
      isOnboarded: true,
      startDate: 1700000000000,
      ...overrides,
    },
  };
}

function readRaw(): string | null {
  return mockAsyncStore.get(APP_STATE_KEY) ?? null;
}

function quarantineKeys(): string[] {
  return [...mockAsyncStore.keys()].filter((k) =>
    k.startsWith(`${APP_STATE_KEY}.corrupt.`)
  );
}

beforeEach(() => {
  mockAsyncStore.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('loadStoredAppStateDetailed — integrity', () => {
  test('fresh install: no key → fresh-install with defaults', async () => {
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('fresh-install');
    expect(result.state).toEqual(DEFAULT_APP_STATE);
    expect(result.quarantinedKey).toBeUndefined();
  });

  test('valid envelope loads with status ok', async () => {
    const state = makeState();
    expect(await saveStoredAppState(state)).toBe(true);
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(state);
  });

  test('tampered payload is quarantined: primary key removed, original bytes preserved', async () => {
    await saveStoredAppState(makeState());
    const raw = readRaw()!;
    const tampered =
      raw.slice(0, Math.floor(raw.length / 2)) +
      (raw[Math.floor(raw.length / 2)] === 'a' ? 'b' : 'a') +
      raw.slice(Math.floor(raw.length / 2) + 1);
    expect(tampered).not.toBe(raw);
    mockAsyncStore.set(APP_STATE_KEY, tampered);

    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('corrupted-quarantined');
    expect(result.state).toEqual(DEFAULT_APP_STATE);
    expect(result.quarantinedKey).toBeDefined();
    // Bad payload can never poison the next launch.
    expect(readRaw()).toBeNull();
    // Original bytes are preserved for manual recovery.
    const qKeys = quarantineKeys();
    expect(qKeys).toHaveLength(1);
    expect(mockAsyncStore.get(qKeys[0])).toBe(tampered);
  });

  test('envelope with wrong checksum is quarantined', async () => {
    await saveStoredAppState(makeState());
    const parsed = JSON.parse(readRaw()!);
    parsed.checksum = 'deadbeef';
    mockAsyncStore.set(APP_STATE_KEY, JSON.stringify(parsed));

    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('corrupted-quarantined');
    expect(quarantineKeys()).toHaveLength(1);
  });

  test('envelope with non-numeric schema version is quarantined', async () => {
    const state = makeState();
    mockAsyncStore.set(
      APP_STATE_KEY,
      JSON.stringify({
        schemaVersion: 'two',
        savedAt: Date.now(),
        checksum: 'irrelevant',
        data: state,
      })
    );
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('corrupted-quarantined');
  });

  test('envelope from a newer schema version is used as-is, never clobbered', async () => {
    const state = makeState();
    const dataJson = JSON.stringify(state);
    const envelope = {
      schemaVersion: 99,
      savedAt: Date.now(),
      checksum: fnv1a32(dataJson),
      data: state,
    };
    const raw = JSON.stringify(envelope);
    mockAsyncStore.set(APP_STATE_KEY, raw);

    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(state);
    // Forward-compat: the newer payload is left byte-identical on disk.
    expect(readRaw()).toBe(raw);
  });

  test('older envelope version migrates into the current format', async () => {
    const state = makeState();
    const dataJson = JSON.stringify(state);
    mockAsyncStore.set(
      APP_STATE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAt: Date.now(),
        checksum: fnv1a32(dataJson),
        data: state,
      })
    );
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('migrated-from-legacy');
    expect(result.state).toEqual(state);
    // Re-saved as a current envelope.
    const rewritten = JSON.parse(readRaw()!);
    expect(rewritten.schemaVersion).toBe(2);
  });

  test('legacy bare payload migrates into an envelope', async () => {
    const state = makeState();
    mockAsyncStore.set(APP_STATE_KEY, JSON.stringify(state));
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('migrated-from-legacy');
    expect(result.state).toEqual(state);
    expect(JSON.parse(readRaw()!).schemaVersion).toBe(2);
  });

  test('unparseable JSON is quarantined, never trusted', async () => {
    const garbage = '{"profile": {"habitTitle": broken';
    mockAsyncStore.set(APP_STATE_KEY, garbage);
    const result = await loadStoredAppStateDetailed();
    expect(result.status).toBe('corrupted-quarantined');
    expect(readRaw()).toBeNull();
    const qKeys = quarantineKeys();
    expect(qKeys).toHaveLength(1);
    expect(mockAsyncStore.get(qKeys[0])).toBe(garbage);
  });

  test('saveStoredAppState refuses invalid state and writes nothing', async () => {
    const ok = await saveStoredAppState({} as unknown as AppStateData);
    expect(ok).toBe(false);
    expect(readRaw()).toBeNull();
  });
});

describe('export / import round-trip validation', () => {
  async function exportOrThrow(): Promise<string> {
    const exported = await exportTelemetryBackup();
    if (!exported.success) {
      throw new Error(`export failed in test: ${exported.error}`);
    }
    return exported.data;
  }

  test('export produces a checksummed payload that verifies', async () => {
    const state = makeState();
    await saveStoredAppState(state);
    const json = await exportOrThrow();
    const payload = JSON.parse(json);
    expect(payload.exportVersion).toBe(1);
    expect(payload.checksum).toBe(fnv1a32(JSON.stringify(payload.state)));
    expect(payload.state).toEqual(state);
  });

  test('import of a valid backup replaces live state only after validation', async () => {
    await saveStoredAppState(makeState({ habitTitle: 'Old Habit' }));
    const json = await exportOrThrow();
    // Simulate the user editing their data after the backup was taken.
    await saveStoredAppState(makeState({ habitTitle: 'Newer Habit' }));

    const result = await importTelemetryBackup(json);
    expect(result.success).toBe(true);
    expect(result.data!.profile.habitTitle).toBe('Old Habit');
    const reloaded = await loadStoredAppStateDetailed();
    expect(reloaded.status).toBe('ok');
    expect(reloaded.state.profile.habitTitle).toBe('Old Habit');
  });

  test('import rejects a tampered backup and never touches live state', async () => {
    const original = makeState({ habitTitle: 'Untouched' });
    await saveStoredAppState(original);
    const json = await exportOrThrow();
    const rawBefore = readRaw();

    // Tamper inside the state payload: JSON stays valid, shape stays valid,
    // but the checksum no longer matches — the exact damage path.
    const payload = JSON.parse(json);
    payload.state.profile.habitTitle = 'Hacked';
    const tampered = JSON.stringify(payload);

    const result = await importTelemetryBackup(tampered);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/checksum|damaged/i);
    // The bad file never clobbered the good data.
    expect(readRaw()).toBe(rawBefore);
    const reloaded = await loadStoredAppStateDetailed();
    expect(reloaded.status).toBe('ok');
    expect(reloaded.state.profile.habitTitle).toBe('Untouched');
  });

  test('import rejects structurally broken JSON without writing anything', async () => {
    await saveStoredAppState(makeState({ habitTitle: 'Untouched' }));
    const rawBefore = readRaw();
    const result = await importTelemetryBackup('{"exportVersion": 1, broken');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not valid JSON/i);
    expect(readRaw()).toBe(rawBefore);
  });

  test('import rejects non-JSON input without writing anything', async () => {
    const result = await importTelemetryBackup('not json at all {{{');
    expect(result.success).toBe(false);
    expect(readRaw()).toBeNull();
  });

  test('import rejects a wrong-shaped payload without writing anything', async () => {
    const result = await importTelemetryBackup(JSON.stringify({ foo: 1 }));
    expect(result.success).toBe(false);
    expect(readRaw()).toBeNull();
  });

  test('import rejects a payload whose state fails validation', async () => {
    const state = makeState();
    const dataJson = JSON.stringify({ ...state, profile: { broken: true } });
    const payload = {
      exportVersion: 1,
      exportedAt: Date.now(),
      schemaVersion: 2,
      checksum: fnv1a32(dataJson),
      deviceMetadata: { airGapped: true, platform: 'ios' },
      state: JSON.parse(dataJson),
    };
    const result = await importTelemetryBackup(JSON.stringify(payload));
    expect(result.success).toBe(false);
    expect(readRaw()).toBeNull();
  });
});
