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

import type { AppState } from '../types/app';
import {
  loadAppState,
  saveAppState,
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
import {
  requestNotificationPermissions,
  scheduleDailyCheckIn,
} from '../services/notifications';

interface AppStateContextValue {
  /** null while loading */
  state: AppState | null;
  loading: boolean;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  /** Records today's pledge. Resolves true when it counted, false on double-pledge. */
  pledgeNow: () => Promise<boolean>;
  pledgedToday: (nowMs: number) => boolean;
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

  const value = useMemo<AppStateContextValue>(
    () => ({ state, loading, completeOnboarding, pledgeNow, pledgedToday, refresh }),
    [state, loading, completeOnboarding, pledgeNow, pledgedToday, refresh]
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
