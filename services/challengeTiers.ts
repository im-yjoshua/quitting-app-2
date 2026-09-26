/**
 * Single source of truth for challenge-XP tier resolution.
 * Pure module — no independent tier computation may live in screens/services.
 * Moved verbatim out of context/ChallengesContext so it can be unit-tested
 * without a React Native runtime. Behavior is unchanged.
 */
export const TIERS = [
  { level: 1, name: 'Initiate', minXp: 0, colors: ['#94A3B8', '#CBD5E1'] },
  { level: 2, name: 'Vanguard', minXp: 151, colors: ['#2563EB', '#38BDF8'] },
  { level: 3, name: 'Ascendant', minXp: 501, colors: ['#7C3AED', '#C084FC'] },
  { level: 4, name: 'Imperator', minXp: 1201, colors: ['#D97706', '#FDE047'] },
  { level: 5, name: 'Sovereign', minXp: 2501, colors: ['#059669', '#34D399'] },
];

export function resolveChallengeTier(xp: number): {
  currentTier: (typeof TIERS)[0];
  nextTier: (typeof TIERS)[0] | null;
} {
  let currentTier = TIERS[0];
  let nextTier: (typeof TIERS)[0] | null = null;

  for (let i = 0; i < TIERS.length; i++) {
    if (xp >= TIERS[i].minXp) {
      currentTier = TIERS[i];
      nextTier = TIERS[i + 1] || null;
    } else {
      break;
    }
  }

  return { currentTier, nextTier };
}
