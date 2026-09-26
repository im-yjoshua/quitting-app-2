import type { AuraTier } from '../types/app';

/**
 * Single source of truth for aura tier thresholds.
 * Pure function — no independent tier computation may live in screens/services.
 * Moved verbatim out of context/AppDataContext so it can be unit-tested
 * without a React Native runtime. Behavior is unchanged.
 */
export function calculateTier(auraScore: number): AuraTier {
  if (auraScore >= 2000) return 'Sovereign';
  if (auraScore >= 500) return 'Sentinel';
  return 'Initiate';
}
