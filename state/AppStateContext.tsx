/**
 * AppStateContext — loads the v2 AppState once, exposes it to every screen,
 * and owns the few mutations Day 2 needs (onboarding completion, pledging).
 *
 * - On mount and on every foreground: load → apply missed-pledge reset → persist.
 * - `quit === null` means onboarding is not complete (route guard in Home).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState as RNAppState } from 'react-native';
import { router } from 'expo-router';

import type {
  AppSettings,
  AppState,
  JournalEntry,
  RelapseEntry,
} from '../types/app';
import {
  loadAppState,
  saveAppState,
  updateAppState,
} from '../services/appStateStore';
import {
  applyMissedPledgeReset,
  hasPledgedToday,
  pledgeToday,
} from '../services/pledge';
import {
  createAppStateFromQuit,
  createQuitFromAnswers,
  type OnboardingAnswers,
} from '../services/onboarding';
import { applyPledgeTime } from '../services/pledgeTime';
import {
  requestNotificationPermissions,
  scheduleDailyCheckIn,
  scheduleRelapsePlusOne,
} from '../services/notifications';
import { applyRelapse } from '../services/relapse';
import { markMilestonesSeenPure } from '../services/milestones';
import {
  addJournalEntry,
  createJournalEntry,
  deleteJournalEntry,
} from '../services/journal';

interface AppStateContextValue {
  /** null while loading */
  state: AppState | null;
  loading: boolean;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  /** Records today's pledge. Resolves true when it counted, false on double-pledge. */
  pledgeNow: () => Promise<boolean>;
  pledgedToday: (nowMs: number) => boolean;
  /** Logs a slip compassionately. Returns the appended entry. */
  logRelapse: (note?: string) => Promise<RelapseEntry>;
  /** Records a completed urge-surf session. */
  logUrgeSurf: () => Promise<void>;
  /** Saves a text check-in. Returns the created entry. */
  addJournal: (
    note: string,
    craving: 1 | 2 | 3 | 4 | 5 | null
  ) => Promise<JournalEntry>;
  removeJournalEntry: (id: string) => Promise<void>;
  /** Merges newly-celebrated milestone day-counts into milestonesSeen. */
  markMilestonesSeen: (days: number[]) => Promise<void>;
  /** Patches settings (notification toggles, orb theme, share card style). */
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  /** Sets the daily pledge reminder time ("HH:MM", 24h). Throws on bad format. */
  updatePledgeTime: (time: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const loaded = await loadAppState();
    const pledge = applyMissedPledgeReset(loaded.pledge, Date.now());
    if (pledge !== loaded.pledge) {
      const next = { ...loaded, pledge };
      await saveAppState(next);
      setState(next);
    } else {
      setState(loaded);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [refresh]);

  const completeOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      const nowMs = Date.now();
      const quit = createQuitFromAnswers(answers, nowMs);
      const next = createAppStateFromQuit(quit);
      await saveAppState(next);
      setState(next);

      // Contextual permission ask: "so we can remind you to pledge".
      // Never blocks onboarding — a declined permission just skips scheduling.
      try {
        const granted = await requestNotificationPermissions();
        if (granted) {
          const [h, m] = quit.pledgeTime.split(':').map(Number);
          await scheduleDailyCheckIn(h, m);
        }
      } catch {
        // Local notifications are best-effort.
      }

      router.replace('/(tabs)');
    },
    []
  );

  const pledgeNow = useCallback(async (): Promise<boolean> => {
    const prev = await loadAppState();
    const result = pledgeToday(prev.pledge, Date.now());
    if (!result.pledged) return false;
    const next = { ...prev, pledge: result.state };
    await saveAppState(next);
    setState(next);
    return true;
  }, []);

  const pledgedToday = useCallback(
    (nowMs: number) => (state ? hasPledgedToday(state.pledge, nowMs) : false),
    [state]
  );

  const logRelapse = useCallback(
    async (note?: string): Promise<RelapseEntry> => {
      const nowMs = Date.now();
      let entry: RelapseEntry | null = null;
      const next = await updateAppState((prev) => {
        const applied = applyRelapse(prev, nowMs, note);
        entry = applied.entry;
        return applied.state;
      });
      setState(next);
      // Relapse +1 day (spec §5): "Day 1 again — and that's okay. Pledge it."
      // Best-effort; a denied permission just skips it.
      try {
        await scheduleRelapsePlusOne(nowMs);
      } catch {
        // Local notifications are best-effort.
      }
      if (!entry) throw new Error('Relapse entry was not created');
      return entry;
    },
    []
  );

  const logUrgeSurf = useCallback(async (): Promise<void> => {
    const iso = new Date(Date.now()).toISOString();
    const next = await updateAppState((prev) => ({
      ...prev,
      urgeSurfs: [...prev.urgeSurfs, iso],
    }));
    setState(next);
  }, []);

  const addJournal = useCallback(
    async (
      note: string,
      craving: 1 | 2 | 3 | 4 | 5 | null
    ): Promise<JournalEntry> => {
      const nowMs = Date.now();
      let entry: JournalEntry | null = null;
      const next = await updateAppState((prev) => {
        entry = createJournalEntry(note, craving, nowMs);
        return addJournalEntry(prev, entry);
      });
      setState(next);
      if (!entry) throw new Error('Journal entry was not created');
      return entry;
    },
    []
  );

  const removeJournalEntry = useCallback(async (id: string): Promise<void> => {
    const next = await updateAppState((prev) => deleteJournalEntry(prev, id));
    setState(next);
  }, []);

  const markMilestonesSeen = useCallback(async (days: number[]): Promise<void> => {
    if (days.length === 0) return;
    const next = await updateAppState((prev) => ({
      ...prev,
      milestonesSeen: markMilestonesSeenPure(prev.milestonesSeen, days),
    }));
    setState(next);
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>): Promise<void> => {
      const next = await updateAppState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...partial },
      }));
      setState(next);
    },
    []
  );

  const updatePledgeTime = useCallback(
    async (time: string): Promise<void> => {
      const next = await updateAppState((prev) => applyPledgeTime(prev, time));
      setState(next);
    },
    []
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      loading,
      completeOnboarding,
      pledgeNow,
      pledgedToday,
      logRelapse,
      logUrgeSurf,
      addJournal,
      removeJournalEntry,
      markMilestonesSeen,
      updateSettings,
      updatePledgeTime,
      refresh,
    }),
    [
      state,
      loading,
      completeOnboarding,
      pledgeNow,
      pledgedToday,
      logRelapse,
      logUrgeSurf,
      addJournal,
      removeJournalEntry,
      markMilestonesSeen,
      updateSettings,
      updatePledgeTime,
      refresh,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
