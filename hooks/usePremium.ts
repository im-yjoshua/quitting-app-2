/**
 * usePremium — the single funnel for every premium gate in the app.
 *
 * Reads the trusted offline entitlement snapshot (services/purchases.ts):
 * zero-latency, air-gapped. Re-reads on app foreground and exposes
 * `refresh()` so purchase/restore flows can update gates immediately.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getTrustedOfflineEntitlement } from '../services/purchases';

export interface PremiumState {
  isPremium: boolean;
  /** Re-read the trusted snapshot (call after purchase/restore). */
  refresh: () => Promise<void>;
}

export function usePremium(): PremiumState {
  const [isPremium, setIsPremium] = useState(false);

  const readSnapshot = useCallback(async () => {
    try {
      const ent = await getTrustedOfflineEntitlement();
      setIsPremium(ent.isSovereign);
    } catch {
      // Offline snapshot unreadable → treat as free. Never crash gating.
    }
  }, []);

  const refresh = useCallback(() => readSnapshot(), [readSnapshot]);

  useEffect(() => {
    // Async snapshot read on mount: the setState inside readSnapshot runs
    // after an await, so this is not a synchronous setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void readSnapshot();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void readSnapshot();
    });
    return () => sub.remove();
  }, [readSnapshot]);

  return { isPremium, refresh };
}
