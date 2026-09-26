/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Paywall / premium-gating tests — services/purchases.ts with an in-memory
// AsyncStorage and stubbed native bridges.
//
// What this covers:
//   1. Entitlement mapping: the 3 products (sovereign_weekly_399,
//      sovereign_monthly_999, sovereign_yearly_2999) → sovereign_tier.
//   2. Gate logic: free vs premium through isValidatedEntitlement.
//   3. __DEV__ sim separation: (globalThis).__DEV__ is FALSY in this node
//      env, so every test below exercises the PRODUCTION path. The
//      dev-sandbox simulation (synthesized entitlements, fake purchases)
//      must stay unreachable here — a synthesized entitlement must NEVER
//      unlock premium, and purchaseProduct without a configured RevenueCat
//      bridge must fail honestly instead of minting premium.
//
// No test here touches real RevenueCat: react-native-purchases, expo-constants
// and biometrics are all stubbed; only the pure mapping/trust logic runs.
// ---------------------------------------------------------------------------

// Production path: __DEV__ is falsy in the node test env (no RN global), so
// the DEV-guarded simulation branches in purchases.ts stay OFF.
(globalThis as Record<string, unknown>).__DEV__ = false;

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
      clear: async (): Promise<void> => {
        mockAsyncStore.clear();
      },
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    purchaseProduct: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    LOG_LEVEL: { DEBUG: 4, INFO: 2 },
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PAYMENT_PENDING_ERROR: '3',
    NETWORK_ERROR: '10',
    PRODUCT_ALREADY_PURCHASED_ERROR: '6',
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', appOwnership: 'standalone' },
  AppOwnership: { Expo: 'expo', Standalone: 'standalone' },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
    Standalone: 'standalone',
    Bare: 'bare',
  },
}));

jest.mock('../services/biometrics', () => ({
  authenticateLocalOwner: jest.fn(async () => true),
}));

import type { CustomerInfo } from 'react-native-purchases';

import {
  DEFAULT_ENTITLEMENT,
  extractEntitlementFromCustomerInfo,
  getTrustedOfflineEntitlement,
  IAP_CONFIG,
  isValidatedEntitlement,
  PLAN_SKU,
  purchaseProduct,
  saveCachedEntitlement,
} from '../services/purchases';
import type { SovereignEntitlement } from '../types/app';

/** Minimal CustomerInfo shape with one active sovereign_tier entitlement. */
function customerInfoWith(
  productIdentifier: string,
  overrides: Record<string, unknown> = {}
): CustomerInfo {
  return {
    entitlements: {
      active: {
        [IAP_CONFIG.ENTITLEMENT_ID]: {
          isActive: true,
          productIdentifier,
          expirationDate: '2027-09-27T00:00:00.000Z',
          latestPurchaseDate: '2026-09-27T00:00:00.000Z',
          originalPurchaseDate: '2026-09-27T00:00:00.000Z',
          ...overrides,
        },
      },
    },
  } as unknown as CustomerInfo;
}

function customerInfoEmpty(): CustomerInfo {
  return { entitlements: { active: {} } } as unknown as CustomerInfo;
}

beforeEach(() => {
  mockAsyncStore = new Map<string, string>();
  delete process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
});

describe('entitlement mapping: 3 products → sovereign_tier', () => {
  it('maps sovereign_weekly_399 → weekly', () => {
    const ent = extractEntitlementFromCustomerInfo(
      customerInfoWith('sovereign_weekly_399')
    );
    expect(ent.isSovereign).toBe(true);
    expect(ent.activePlan).toBe('weekly');
    expect(ent.source).toBe('revenuecat');
  });

  it('maps sovereign_monthly_999 → monthly', () => {
    const ent = extractEntitlementFromCustomerInfo(
      customerInfoWith('sovereign_monthly_999')
    );
    expect(ent.isSovereign).toBe(true);
    expect(ent.activePlan).toBe('monthly');
  });

  it('maps sovereign_yearly_2999 → yearly', () => {
    const ent = extractEntitlementFromCustomerInfo(
      customerInfoWith('sovereign_yearly_2999')
    );
    expect(ent.isSovereign).toBe(true);
    expect(ent.activePlan).toBe('yearly');
  });

  it('uses the sovereign_tier entitlement id, not legacy names', () => {
    expect(IAP_CONFIG.ENTITLEMENT_ID).toBe('sovereign_tier');
    expect(PLAN_SKU).toEqual({
      weekly: 'sovereign_weekly_399',
      monthly: 'sovereign_monthly_999',
      yearly: 'sovereign_yearly_2999',
    });
  });

  it('honors legacy sovereign_lifetime if ever seen (never mints it)', () => {
    const ci = {
      entitlements: {
        active: {
          sovereign_lifetime: {
            isActive: true,
            productIdentifier: 'sovereign_lifetime',
            expirationDate: null,
            latestPurchaseDate: '2026-01-01T00:00:00.000Z',
            originalPurchaseDate: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    } as unknown as CustomerInfo;
    const ent = extractEntitlementFromCustomerInfo(ci);
    expect(ent.isSovereign).toBe(true);
    expect(ent.source).toBe('revenuecat');
  });

  it('returns a non-sovereign default when nothing is active', () => {
    const ent = extractEntitlementFromCustomerInfo(customerInfoEmpty());
    expect(ent.isSovereign).toBe(false);
    expect(ent.activePlan).toBeNull();
  });

  it('parses ISO expiration dates to epoch ms', () => {
    const ent = extractEntitlementFromCustomerInfo(
      customerInfoWith('sovereign_yearly_2999', {
        expirationDate: '2027-09-27T00:00:00.000Z',
      })
    );
    expect(ent.expirationDate).toBe(
      new Date('2027-09-27T00:00:00.000Z').getTime()
    );
  });
});

describe('gate logic: free vs premium', () => {
  it('a RevenueCat-validated entitlement unlocks premium', () => {
    const ent: SovereignEntitlement = {
      ...DEFAULT_ENTITLEMENT,
      isSovereign: true,
      activePlan: 'yearly',
      source: 'revenuecat',
    };
    expect(isValidatedEntitlement(ent)).toBe(true);
  });

  it('a dev-sandbox synthesized entitlement NEVER unlocks premium', () => {
    // The __DEV__ purchase simulation writes source: 'offline_cache'.
    const simulated: SovereignEntitlement = {
      ...DEFAULT_ENTITLEMENT,
      isSovereign: true,
      activePlan: 'weekly',
      source: 'offline_cache',
    };
    expect(isValidatedEntitlement(simulated)).toBe(false);
  });

  it('a free user (not sovereign) stays locked', () => {
    expect(isValidatedEntitlement(DEFAULT_ENTITLEMENT)).toBe(false);
  });
});

describe('trusted offline snapshot (production path)', () => {
  it('empty cache → free', async () => {
    const ent = await getTrustedOfflineEntitlement();
    expect(ent.isSovereign).toBe(false);
  });

  it('RevenueCat-validated cache → premium', async () => {
    await saveCachedEntitlement({
      ...DEFAULT_ENTITLEMENT,
      isSovereign: true,
      activePlan: 'monthly',
      expirationDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      source: 'revenuecat',
      lastVerifiedAt: Date.now(),
    });
    const ent = await getTrustedOfflineEntitlement();
    expect(ent.isSovereign).toBe(true);
    expect(ent.activePlan).toBe('monthly');
  });

  it('dev-sim synthesized cache → free (sim/prod separation)', async () => {
    await saveCachedEntitlement({
      ...DEFAULT_ENTITLEMENT,
      isSovereign: true,
      activePlan: 'yearly',
      expirationDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      source: 'offline_cache',
      lastVerifiedAt: Date.now(),
    });
    const ent = await getTrustedOfflineEntitlement();
    expect(ent.isSovereign).toBe(false);
  });

  it('expired subscription cache → free', async () => {
    await saveCachedEntitlement({
      ...DEFAULT_ENTITLEMENT,
      isSovereign: true,
      activePlan: 'weekly',
      expirationDate: Date.now() - 1000,
      source: 'revenuecat',
      lastVerifiedAt: Date.now(),
    });
    const ent = await getTrustedOfflineEntitlement();
    expect(ent.isSovereign).toBe(false);
  });
});

describe('purchaseProduct without a RevenueCat bridge (production path)', () => {
  it('fails honestly instead of minting premium', async () => {
    // No EXPO_PUBLIC_REVENUECAT_* keys set (see beforeEach) and __DEV__
    // is falsy → the dev-sim branch must stay off.
    for (const plan of ['weekly', 'monthly', 'yearly'] as const) {
      const result = await purchaseProduct(plan);
      expect(result.success).toBe(false);
      expect(result.cancelled).not.toBe(true);
      expect(result.error).toBeTruthy();
      expect(result.entitlement).toBeUndefined();
    }
    // And nothing was cached as a side effect.
    const ent = await getTrustedOfflineEntitlement();
    expect(ent.isSovereign).toBe(false);
  });
});
