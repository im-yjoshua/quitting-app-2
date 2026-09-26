/**
 * usePremium — reads the trusted offline entitlement snapshot (services/purchases.ts).
 *
 * Zero-latency, air-gapped: the cached snapshot decides gating; the Day 5
 * paywall re-verifies with RevenueCat on purchase/restore.
 */
import { useEffect, useState } from 'react';

import { getTrustedOfflineEntitlement } from '../services/purchases';

export function usePremium(): boolean {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ent = await getTrustedOfflineEntitlement();
        if (!cancelled) setIsPremium(ent.isSovereign);
      } catch {
        // Offline snapshot unreadable → treat as free. Never crash gating.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isPremium;
}
