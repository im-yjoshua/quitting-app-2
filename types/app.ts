export type HabitCategory =
  | 'digital_distraction'
  | 'substance_nicotine'
  | 'limbic_scrolling'
  | 'compulsive_gambling'
  | 'adult_content'
  | 'custom';

export type RelapseTrigger =
  | 'late_night_bed_scrolling'
  | 'boredom_isolation'
  | 'stress_cortisol'
  | 'fatigue_burnout'
  | 'alcohol_substance_cross_trigger'
  | 'other';

export type AuraTier = 'Initiate' | 'Sentinel' | 'Sovereign';

/**
 * Immutable record of a committed relapse/slip.
 * Stores forensic triggers, forfeited duration, attempt sequence, and user reflections.
 */
export interface RelapseRecord {
  /** Unique deterministic or UUID-like identifier for this relapse event */
  readonly id: string;
  /** Epoch ms timestamp when slip was committed */
  readonly timestamp: number;
  /** Forfeited clean streak duration in milliseconds */
  readonly cleanDurationMs: number;
  /** Forensic trigger classification */
  readonly trigger: RelapseTrigger;
  /** User reflections and contextual notes (legacy compatibility) */
  readonly notes?: string;
  /** In-depth user reflections and forensic introspection */
  readonly reflection?: string;
  /** Sequence number of the attempt (starting at 1) */
  readonly attemptNumber: number;
  /** Aura reputation penalty deducted upon relapse */
  readonly forfeitedAura: number;
}

/**
 * Core user profile and streak anchor data.
 * AIR-GAPPED CONSTRAINT: Biometric identifiers are never stored here.
 * Biometrics are authenticated strictly via the OS Secure Enclave.
 */
export interface UserProfile {
  /** Title or name of the sovereign habit to overcome */
  habitTitle: string;
  /** Categorization of the habit */
  habitCategory: HabitCategory;
  /** Epoch ms timestamp of current clean run start (Streak Anchor) */
  startDate: number;
  /** All-time highest clean streak duration achieved in milliseconds */
  bestRecordMs: number;
  /** Current attempt sequence number (starts at 1) */
  attemptCount: number;
  /** Estimated currency spent per week on the habit */
  weeklyCostEstimated: number;
  /** Estimated minutes lost per day to the habit */
  dailyMinutesWasted: number;
  /** Total reputation points (Reputation Aura) */
  auraScore: number;
  /** Current status tier derived from reputation Aura */
  tierStatus: AuraTier;
  /** Onboarding flow completion state */
  isOnboarded: boolean;
  /** Whether the hardware biometric gate is enabled (enclave-protected) */
  biometricsEnabled: boolean;
}

export type InterventionDrillType =
  | 'cold_splash'
  | 'pushups_15'
  | 'vagus_breath';

export interface UrgeInterventionState {
  /** Epoch ms timestamp of last completed drill */
  lastCompletedAt: number | null;
  /** Epoch ms timestamp until next attempt can claim Aura (10m window) */
  cooldownUntil: number | null;
}

/**
 * Circadian day record tracking morning (AM) and evening (PM) ritual completion.
 */
export interface CircadianDayRecord {
  /** Date key in format YYYY-MM-DD */
  dateString: string;
  /** Whether morning AM ritual is completed */
  amCompleted: boolean;
  /** Epoch ms timestamp of AM ritual completion */
  amCompletedAt: number | null;
  /** Whether evening PM ritual is completed */
  pmCompleted: boolean;
  /** Epoch ms timestamp of PM ritual completion */
  pmCompletedAt: number | null;
  /** Multiplier verification flag (true only when both AM & PM verified -> 1.25x streak multiplier) */
  multiplierActive: boolean;
}

/**
 * Circadian history mapping YYYY-MM-DD date keys to daily completion logs.
 */
export type CircadianHistory = Record<string, CircadianDayRecord>;

export interface TimedChallenge {
  id: string;
  title: string;
  subtitle: string;
  durationSeconds: number;
  auraReward: number;
  category: 'somatic' | 'mental' | 'environment';
  lastCompletedAt: number | null;
}

/**
 * Complete in-memory state snapshot of the Sovereign terminal.
 */
export interface AppStateData {
  profile: UserProfile;
  relapseHistory: RelapseRecord[];
  interventionState: UrgeInterventionState;
  circadianHistory: CircadianHistory;
  activeChallengeId: string | null;
}

export type PurchasePlan = 'annual' | 'lifetime';

export type PurchaseState = 'idle' | 'pending' | 'purchased' | 'cancelled' | 'error';

export interface SovereignEntitlement {
  isSovereign: boolean;
  activePlan: PurchasePlan | null;
  expirationDate: number | null; // epoch ms or null if lifetime
  latestPurchaseDate: number | null;
  originalPurchaseDate: number | null;
  source: 'revenuecat' | 'restored' | 'offline_cache';
  lastVerifiedAt: number;
}

/**
 * Current schema version for versioned migrations.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Result returned by safe serialization gates.
 */
export type SerializationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

/**
 * Storage envelope for corruption-proof atomic writes and checksum verification.
 */
export interface StorageEnvelope<T = AppStateData> {
  readonly schemaVersion: number;
  readonly savedAt: number;
  readonly checksum: string;
  readonly data: T;
}

/**
 * Air-gapped local telemetry export payload.
 * Encapsulates telemetry for offline JSON backup and restore without cloud services.
 */
export interface TelemetryExportPayload {
  readonly exportVersion: number;
  readonly exportedAt: number;
  readonly schemaVersion: number;
  readonly checksum: string;
  readonly deviceMetadata: {
    readonly airGapped: true;
    readonly platform: string;
  };
  readonly state: AppStateData;
}

// -----------------------------------------------------------------------------
// RUNTIME TYPE GUARDS
// -----------------------------------------------------------------------------

export function isUserProfile(raw: unknown): raw is UserProfile {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<UserProfile>;
  return (
    typeof p.habitTitle === 'string' &&
    typeof p.habitCategory === 'string' &&
    typeof p.startDate === 'number' &&
    !isNaN(p.startDate) &&
    typeof p.bestRecordMs === 'number' &&
    !isNaN(p.bestRecordMs) &&
    typeof p.attemptCount === 'number' &&
    !isNaN(p.attemptCount) &&
    typeof p.weeklyCostEstimated === 'number' &&
    !isNaN(p.weeklyCostEstimated) &&
    typeof p.dailyMinutesWasted === 'number' &&
    !isNaN(p.dailyMinutesWasted) &&
    typeof p.auraScore === 'number' &&
    !isNaN(p.auraScore) &&
    (p.tierStatus === 'Initiate' || p.tierStatus === 'Sentinel' || p.tierStatus === 'Sovereign') &&
    typeof p.isOnboarded === 'boolean' &&
    typeof p.biometricsEnabled === 'boolean'
  );
}

export function isRelapseRecord(raw: unknown): raw is RelapseRecord {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Partial<RelapseRecord>;
  return (
    typeof r.id === 'string' &&
    typeof r.timestamp === 'number' &&
    !isNaN(r.timestamp) &&
    typeof r.cleanDurationMs === 'number' &&
    !isNaN(r.cleanDurationMs) &&
    typeof r.trigger === 'string' &&
    typeof r.attemptNumber === 'number' &&
    !isNaN(r.attemptNumber) &&
    typeof r.forfeitedAura === 'number' &&
    !isNaN(r.forfeitedAura)
  );
}

export function isCircadianDayRecord(raw: unknown): raw is CircadianDayRecord {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as Partial<CircadianDayRecord>;
  return (
    typeof c.dateString === 'string' &&
    typeof c.amCompleted === 'boolean' &&
    (c.amCompletedAt === null || (typeof c.amCompletedAt === 'number' && !isNaN(c.amCompletedAt))) &&
    typeof c.pmCompleted === 'boolean' &&
    (c.pmCompletedAt === null || (typeof c.pmCompletedAt === 'number' && !isNaN(c.pmCompletedAt))) &&
    typeof c.multiplierActive === 'boolean'
  );
}

export function isCircadianHistory(raw: unknown): raw is CircadianHistory {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !isCircadianDayRecord(value)) {
      return false;
    }
  }
  return true;
}

export function isStorageEnvelope<T = AppStateData>(raw: unknown): raw is StorageEnvelope<T> {
  if (!raw || typeof raw !== 'object') return false;
  const env = raw as Partial<StorageEnvelope<T>>;
  return (
    typeof env.schemaVersion === 'number' &&
    !isNaN(env.schemaVersion) &&
    typeof env.savedAt === 'number' &&
    !isNaN(env.savedAt) &&
    typeof env.checksum === 'string' &&
    'data' in env
  );
}

export function isTelemetryExportPayload(raw: unknown): raw is TelemetryExportPayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<TelemetryExportPayload>;
  return (
    typeof p.exportVersion === 'number' &&
    typeof p.exportedAt === 'number' &&
    typeof p.schemaVersion === 'number' &&
    typeof p.checksum === 'string' &&
    Boolean(p.deviceMetadata && p.deviceMetadata.airGapped === true) &&
    Boolean(p.state && typeof p.state === 'object')
  );
}