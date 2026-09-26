import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, {
  CustomerInfo,
  PurchasesError,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from 'react-native-purchases';
import { authenticateLocalOwner } from './biometrics';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import { PurchasePlan, SovereignEntitlement } from '../types/app';

// Product SKUs and Entitlement Identifiers
export const IAP_CONFIG = {
  ENTITLEMENT_ID: 'sovereign_tier',
  SKU_ANNUAL: 'sovereign_annual_59',
  SKU_LIFETIME: 'sovereign_lifetime_149',
  ANNUAL_PRICE_USD: 59.0,
  LIFETIME_PRICE_USD: 149.0,
  STORAGE_KEY: '@sovereign_entitlement_v1',
} as const;

export const DEFAULT_ENTITLEMENT: SovereignEntitlement = {
  isSovereign: false,
  activePlan: null,
  expirationDate: null,
  latestPurchaseDate: null,
  originalPurchaseDate: null,
  source: 'offline_cache',
  lastVerifiedAt: 0,
};

let isConfigured = false;
let isConfiguring = false;

/**
 * Reads local cached entitlement snapshot from AsyncStorage for zero-latency,
 * air-gapped app launches without waiting for remote network verification.
 */
export async function loadCachedEntitlement(): Promise<SovereignEntitlement> {
  try {
    const raw = await AsyncStorage.getItem(IAP_CONFIG.STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ENTITLEMENT;
    }
    const parsed = JSON.parse(raw) as Partial<SovereignEntitlement>;

    // Check expiration if annual subscription
    const now = Date.now();
    const isExpired =
      parsed.activePlan === 'annual' &&
      typeof parsed.expirationDate === 'number' &&
      parsed.expirationDate < now;

    return {
      isSovereign: isExpired ? false : !!parsed.isSovereign,
      activePlan: isExpired ? null : parsed.activePlan || null,
      expirationDate: parsed.expirationDate ?? null,
      latestPurchaseDate: parsed.latestPurchaseDate ?? null,
      originalPurchaseDate: parsed.originalPurchaseDate ?? null,
      source: parsed.source || 'offline_cache',
      lastVerifiedAt: parsed.lastVerifiedAt || now,
    };
  } catch (error) {
    console.error('[Purchases] Failed to read cached entitlement:', error);
    return DEFAULT_ENTITLEMENT;
  }
}

/**
 * Persists updated entitlement snapshot into local device storage.
 */
export async function saveCachedEntitlement(
  entitlement: SovereignEntitlement
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      IAP_CONFIG.STORAGE_KEY,
      JSON.stringify(entitlement)
    );
  } catch (error) {
    console.error('[Purchases] Failed to persist cached entitlement:', error);
  }
}

/**
 * A cached entitlement unlocks premium ONLY if it was previously validated by
 * RevenueCat (source === 'revenuecat'). Dev-sandbox synthesized entitlements
 * (source === 'offline_cache' with isSovereign true) are test artifacts and must
 * never unlock premium outside __DEV__.
 */
export function isValidatedEntitlement(
  entitlement: SovereignEntitlement
): boolean {
  return entitlement.isSovereign === true && entitlement.source === 'revenuecat';
}

/**
 * Offline entitlement trust rule — the single choke point for every
 * "RevenueCat unavailable" path in this file:
 * - __DEV__: honor whatever is cached (the dev sandbox may hold a simulated
 *   entitlement from the DEV-ONLY purchase simulation below).
 * - production: honor ONLY previously RevenueCat-validated entitlements.
 */
export async function getTrustedOfflineEntitlement(): Promise<SovereignEntitlement> {
  const cached = await loadCachedEntitlement();
  if (__DEV__) {
    return cached;
  }
  return isValidatedEntitlement(cached) ? cached : DEFAULT_ENTITLEMENT;
}

/**
 * Initializes the RevenueCat SDK if API keys are provided.
 * Gracefully operates in fallback mode if running in environments
 * without active store capabilities.
 */
export async function initializePurchases(): Promise<boolean> {
  if (isConfigured || isConfiguring) return isConfigured;
  isConfiguring = true;

  try {
    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === AppOwnership.Expo ||
      Constants.appOwnership === 'expo';

    const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
    const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
    const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;

    let apiKey: string | undefined;

    if (isExpoGo) {
      // In Expo Go, native StoreKit/Play Store is unavailable. Only RevenueCat Test Store keys (test_*) work.
      if (testKey && testKey.startsWith('test_')) {
        apiKey = testKey;
      } else {
        // Gracefully operate in offline simulated sandbox mode without triggering native StoreKit errors
        console.log('[Purchases] Expo Go detected without Test Store key. Operating in offline simulated entitlement mode.');
        isConfigured = false;
        return false;
      }
    } else {
      apiKey = Platform.OS === 'ios' ? appleKey : googleKey;
    }

    if (!apiKey || apiKey.includes('placeholder')) {
      console.log('[Purchases] RevenueCat API key not configured. Operating in offline simulated entitlement mode.');
      isConfigured = false;
      return false;
    }

    // Set non-verbose logging in production, info in dev
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    } else {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.INFO);
    }

    // Configure RevenueCat instance
    await Purchases.configure({ apiKey });
    isConfigured = true;
    return true;
  } catch (error) {
    // In simulator, Expo Go, or test runners, native StoreKit bindings may not be wired.
    console.warn('[Purchases] RevenueCat native initialization deferred/unlinked:', error);
    isConfigured = false;
    return false;
  } finally {
    isConfiguring = false;
  }
}

/**
 * Parses RevenueCat CustomerInfo to extract active Sovereign entitlement.
 */
export function extractEntitlementFromCustomerInfo(
  customerInfo: CustomerInfo
): SovereignEntitlement {
  const sovereignEntitlement =
    customerInfo.entitlements.active[IAP_CONFIG.ENTITLEMENT_ID] ||
    customerInfo.entitlements.active['sovereign_access'] ||
    customerInfo.entitlements.active['sovereign_annual'] ||
    customerInfo.entitlements.active['sovereign_lifetime'];

  if (sovereignEntitlement && sovereignEntitlement.isActive) {
    const isLifetime =
      sovereignEntitlement.productIdentifier === IAP_CONFIG.SKU_LIFETIME ||
      !sovereignEntitlement.expirationDate;

    return {
      isSovereign: true,
      activePlan: isLifetime ? 'lifetime' : 'annual',
      expirationDate: sovereignEntitlement.expirationDate
        ? new Date(sovereignEntitlement.expirationDate).getTime()
        : null,
      latestPurchaseDate: sovereignEntitlement.latestPurchaseDate
        ? new Date(sovereignEntitlement.latestPurchaseDate).getTime()
        : Date.now(),
      originalPurchaseDate: sovereignEntitlement.originalPurchaseDate
        ? new Date(sovereignEntitlement.originalPurchaseDate).getTime()
        : Date.now(),
      source: 'revenuecat',
      lastVerifiedAt: Date.now(),
    };
  }

  return {
    ...DEFAULT_ENTITLEMENT,
    lastVerifiedAt: Date.now(),
  };
}

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  entitlement?: SovereignEntitlement;
}

/**
 * Executes a native purchase transaction for the requested plan.
 * Handles Apple App Store StoreKit error codes cleanly (e.g. user cancellation, network failures).
 */
export async function purchaseProduct(plan: PurchasePlan): Promise<PurchaseResult> {
  const targetSku =
    plan === 'annual' ? IAP_CONFIG.SKU_ANNUAL : IAP_CONFIG.SKU_LIFETIME;

  // Ensure purchases bridge is active
  const ready = await initializePurchases();

  if (!ready) {
    if (__DEV__) {
      // DEV-ONLY sandbox: RevenueCat isn't configured (e.g. Expo Go without a
      // test key). Synthesize a successful purchase so the paywall UI can be
      // tested end-to-end. __DEV__ is false in every production/release build,
      // so this path can NEVER grant premium in production. Do not remove or
      // weaken the __DEV__ guard.
      console.log('[Purchases] DEV-ONLY simulated sandbox purchase for:', plan);
      const simulatedEntitlement: SovereignEntitlement = {
        isSovereign: true,
        activePlan: plan,
        expirationDate: plan === 'annual' ? Date.now() + 365 * 24 * 60 * 60 * 1000 : null,
        latestPurchaseDate: Date.now(),
        originalPurchaseDate: Date.now(),
        source: 'offline_cache',
        lastVerifiedAt: Date.now(),
      };
      await saveCachedEntitlement(simulatedEntitlement);
      return { success: true, entitlement: simulatedEntitlement };
    }
    // Production with no RevenueCat bridge: fail honestly. Never synthesize
    // premium — that would be a universal paywall bypass.
    return {
      success: false,
      error: 'Purchases are unavailable right now. Check your connection and try again.',
    };
  }

  try {
    // Attempt to locate matching package from RevenueCat offerings
    const offerings = await Purchases.getOfferings();
    let packageToPurchase: PurchasesPackage | undefined;

    if (offerings.current && offerings.current.availablePackages.length > 0) {
      packageToPurchase = offerings.current.availablePackages.find(
        (pkg) =>
          pkg.product.identifier === targetSku ||
          (plan === 'annual' && pkg.packageType === 'ANNUAL') ||
          (plan === 'lifetime' && pkg.packageType === 'LIFETIME')
      );
    }

    let customerInfo: CustomerInfo;

    if (packageToPurchase) {
      const result = await Purchases.purchasePackage(packageToPurchase);
      customerInfo = result.customerInfo;
    } else {
      // Fallback to direct StoreKit product identifier purchase
      const result = await Purchases.purchaseProduct(targetSku);
      customerInfo = result.customerInfo;
    }

    const entitlement = extractEntitlementFromCustomerInfo(customerInfo);
    if (entitlement.isSovereign) {
      await saveCachedEntitlement(entitlement);
      return { success: true, entitlement };
    }

    return {
      success: false,
      error: 'Transaction processed but Sovereign entitlement was not activated.',
    };
  } catch (rawError: unknown) {
    const error = rawError as PurchasesError;

    // App Store Guideline: User cancellation must be handled quietly without jarring alerts
    if (
      error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
      error.userCancelled
    ) {
      return { success: false, cancelled: true };
    }

    let errorMessage = 'An error occurred while securing your Sovereign pass.';
    if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      errorMessage = 'Payment authorization is pending parental or bank approval.';
    } else if (error.code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
      errorMessage = 'Connection interrupted. Verify your network connection and retry.';
    } else if (error.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      errorMessage = 'Pass is already owned on this Apple ID. Restoring purchases...';
      const restoreRes = await restorePurchasesWithoutPrompt();
      return restoreRes;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}

export interface RestoreResult {
  success: boolean;
  restored: boolean;
  message: string;
  entitlement?: SovereignEntitlement;
}

/**
 * Internal restore helper without re-prompting biometrics.
 */
async function restorePurchasesWithoutPrompt(): Promise<PurchaseResult> {
  try {
    const ready = await initializePurchases();
    if (!ready) {
      // Offline: honor only a previously RevenueCat-validated entitlement.
      // Synthesized dev-sandbox entitlements never unlock premium here.
      const trusted = await getTrustedOfflineEntitlement();
      return { success: trusted.isSovereign, entitlement: trusted };
    }
    const customerInfo = await Purchases.restorePurchases();
    const entitlement = extractEntitlementFromCustomerInfo(customerInfo);
    if (entitlement.isSovereign) {
      await saveCachedEntitlement(entitlement);
      return { success: true, entitlement };
    }
    return { success: false, error: 'No active purchases found to restore.' };
  } catch (error: unknown) {
    const err = error as Error;
    return { success: false, error: err.message || 'Restoration failed.' };
  }
}

/**
 * Implements seamless "Restore Purchases" logic with instant biometric confirmation.
 * Prompts Face ID / Touch ID first to guarantee local owner authorization,
 * then validates against StoreKit / RevenueCat and updates local cache.
 */
export async function restorePurchasesWithBiometrics(): Promise<RestoreResult> {
  // Step 1: Prompt instant biometric confirmation
  const biometricsPassed = await authenticateLocalOwner(
    'Verify identity with Face ID / Touch ID to restore Sovereign Pass'
  );

  if (!biometricsPassed) {
    return {
      success: false,
      restored: false,
      message: 'Biometric authorization cancelled or denied.',
    };
  }

  // Step 2: Query StoreKit / RevenueCat restoration
  try {
    const ready = await initializePurchases();

    if (!ready) {
      // Offline: honor only a previously RevenueCat-validated entitlement.
      // Synthesized dev-sandbox entitlements never unlock premium here.
      const trusted = await getTrustedOfflineEntitlement();
      if (trusted.isSovereign) {
        return {
          success: true,
          restored: true,
          message: 'Local Sovereign entitlement confirmed.',
          entitlement: trusted,
        };
      }
      return {
        success: true,
        restored: false,
        message: 'No previous Sovereign purchase found on this device or sandbox.',
      };
    }

    const customerInfo = await Purchases.restorePurchases();
    const entitlement = extractEntitlementFromCustomerInfo(customerInfo);

    if (entitlement.isSovereign) {
      await saveCachedEntitlement(entitlement);
      return {
        success: true,
        restored: true,
        message: 'Sovereign Pass successfully restored to terminal.',
        entitlement,
      };
    }

    return {
      success: true,
      restored: false,
      message: 'No active Sovereign purchase found for this Apple ID.',
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Purchases] Restore failure:', err);
    return {
      success: false,
      restored: false,
      message: err.message || 'Unable to communicate with App Store. Try again later.',
    };
  }
}

/**
 * Synchronizes entitlement with RevenueCat in the background if online.
 */
export async function syncCustomerEntitlements(): Promise<SovereignEntitlement> {
  try {
    const ready = await initializePurchases();
    if (!ready) {
      // Offline: honor only a previously RevenueCat-validated entitlement.
      return getTrustedOfflineEntitlement();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = extractEntitlementFromCustomerInfo(customerInfo);
    await saveCachedEntitlement(entitlement);
    return entitlement;
  } catch (error) {
    // If offline, silently keep the trusted cached entitlement (see trust rule
    // in getTrustedOfflineEntitlement — never a synthesized one in production).
    return getTrustedOfflineEntitlement();
  }
}
