/// <reference types="jest" />
import { calculateTier } from '../services/auraTiers';
import { TIERS, resolveChallengeTier } from '../services/challengeTiers';

describe('calculateTier (aura)', () => {
  test('below 500 aura is Initiate', () => {
    expect(calculateTier(0)).toBe('Initiate');
    expect(calculateTier(499)).toBe('Initiate');
    expect(calculateTier(-10)).toBe('Initiate');
  });

  test('500 boundary promotes to Sentinel', () => {
    expect(calculateTier(500)).toBe('Sentinel');
    expect(calculateTier(1999)).toBe('Sentinel');
  });

  test('2000 boundary promotes to Sovereign', () => {
    expect(calculateTier(2000)).toBe('Sovereign');
    expect(calculateTier(1_000_000)).toBe('Sovereign');
  });
});

describe('resolveChallengeTier (challenge XP)', () => {
  test('tier table is intact: 5 tiers in ascending minXp order', () => {
    expect(TIERS).toHaveLength(5);
    expect(TIERS.map((t) => t.name)).toEqual(['Initiate', 'Vanguard', 'Ascendant', 'Imperator', 'Sovereign']);
    const mins = TIERS.map((t) => t.minXp);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });

  test('0 XP is Initiate with Vanguard next', () => {
    const { currentTier, nextTier } = resolveChallengeTier(0);
    expect(currentTier.name).toBe('Initiate');
    expect(nextTier?.name).toBe('Vanguard');
  });

  test('151 boundary promotes to Vanguard (150 stays Initiate)', () => {
    expect(resolveChallengeTier(150).currentTier.name).toBe('Initiate');
    const { currentTier, nextTier } = resolveChallengeTier(151);
    expect(currentTier.name).toBe('Vanguard');
    expect(nextTier?.name).toBe('Ascendant');
  });

  test('501 boundary promotes to Ascendant (500 stays Vanguard)', () => {
    expect(resolveChallengeTier(500).currentTier.name).toBe('Vanguard');
    const { currentTier, nextTier } = resolveChallengeTier(501);
    expect(currentTier.name).toBe('Ascendant');
    expect(nextTier?.name).toBe('Imperator');
  });

  test('1201 boundary promotes to Imperator (1200 stays Ascendant)', () => {
    expect(resolveChallengeTier(1200).currentTier.name).toBe('Ascendant');
    const { currentTier, nextTier } = resolveChallengeTier(1201);
    expect(currentTier.name).toBe('Imperator');
    expect(nextTier?.name).toBe('Sovereign');
  });

  test('2501 boundary promotes to Sovereign with no next tier (2500 stays Imperator)', () => {
    expect(resolveChallengeTier(2500).currentTier.name).toBe('Imperator');
    const { currentTier, nextTier } = resolveChallengeTier(2501);
    expect(currentTier.name).toBe('Sovereign');
    expect(nextTier).toBeNull();
  });

  test('very large XP stays Sovereign with no next tier', () => {
    const { currentTier, nextTier } = resolveChallengeTier(999_999);
    expect(currentTier.name).toBe('Sovereign');
    expect(nextTier).toBeNull();
  });
});
