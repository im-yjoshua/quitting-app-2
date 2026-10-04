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

/**
 * The 3-tier Sovereign pricing (Day 5). All three products unlock the single
 * `sovereign_tier` entitlement; the plan only records WHICH tier it came from
 * for copy/renewal copy. Lifetime was dropped: recurring keeps the habit
 * loop honest.
 */
export type PurchasePlan = 'weekly' | 'monthly' | 'yearly';

export type PurchaseState = 'idle' | 'pending' | 'purchased' | 'cancelled' | 'error';

export interface SovereignEntitlement {
  isSovereign: boolean;
  activePlan: PurchasePlan | null;
  expirationDate: number | null; // epoch ms or null if not yet synced
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
// -----------------------------------------------------------------------------
// SOVEREIGN V2 — quit-tracking data model (spec §1)
// -----------------------------------------------------------------------------

export type QuitCategory =
  | 'smoking'
  | 'weed'
  | 'alcohol'
  | 'porn'
  | 'sugar'
  | 'custom';

export interface Quit {
  /** Unique id for this quit attempt series */
  id: string;
  category: QuitCategory;
  /** Free text when category === 'custom' */
  customName?: string;
  /** ISO timestamp of the current streak start */
  startDate: string;
  /** 1–3 personal reasons, onboarding-captured, rotated on Home */
  reasons: string[];
  /** Money/day spent before quitting (0 if unknown) */
  dailyCost: number;
  /** Minutes/day reclaimed (0 if unknown) */
  dailyMinutes: number;
  /** "07:00" local — daily pledge reminder time */
  pledgeTime: string;
  /** All-time best, survives relapses */
  longestStreakDays: number;
  totalRelapses: number;
}

export interface PledgeState {
  /** Local YYYY-MM-DD of the last pledge, null if never */
  lastPledgeDayKey: string | null;
  /** Consecutive pledged days. A miss resets to 0; NEVER touches the clean streak */
  pledgeStreak: number;
}

export interface RelapseEntry {
  /** ISO timestamp of the slip */
  date: string;
  daysCleanBefore: number;
  note?: string;
}

export interface JournalEntry {
  id: string;
  /** Local YYYY-MM-DD */
  dayKey: string;
  craving: 1 | 2 | 3 | 4 | 5 | null;
  note: string;
  voiceUri?: string;
  /** ISO timestamp */
  createdAt: string;
}

export type OrbTheme = 'dawn' | 'ember' | 'tide';
export type ShareCardStyle = 'classic' | 'noir';
/** Light / Dark / System appearance switcher (redesign phase 1). */
export type AppearanceSetting = 'light' | 'dark' | 'system';

export interface AppSettings {
  pledgeReminder: boolean;
  milestoneAlerts: boolean;
  /** premium unlocks ember/tide */
  orbTheme: OrbTheme;
  /** premium unlocks noir */
  shareCardStyle: ShareCardStyle;
  /** UI appearance — 'system' follows the device. */
  appearance: AppearanceSetting;
}

export interface AppState {
  schemaVersion: 2;
  /** null = onboarding not completed → route guard sends to /onboarding */
  quit: Quit | null;
  pledge: PledgeState;
  relapseLog: RelapseEntry[];
  journal: JournalEntry[];
  /** Celebrated milestone day-counts */
  milestonesSeen: number[];
  /** ISO timestamps of completed urge-surf sessions */
  urgeSurfs: string[];
  settings: AppSettings;
}

export const QUIT_CATEGORIES: readonly QuitCategory[] = [
  'smoking',
  'weed',
  'alcohol',
  'porn',
  'sugar',
  'custom',
] as const;

export const QUIT_CATEGORY_LABELS: Record<QuitCategory, string> = {
  smoking: 'Smoking',
  weed: 'Weed',
  alcohol: 'Alcohol',
  porn: 'Porn',
  sugar: 'Sugar',
  custom: 'Something else',
};

export function isQuitCategory(raw: unknown): raw is QuitCategory {
  return (
    typeof raw === 'string' &&
    (QUIT_CATEGORIES as readonly string[]).includes(raw)
  );
}

function isNonNegativeNumber(raw: unknown): raw is number {
  return typeof raw === 'number' && !isNaN(raw) && raw >= 0;
}

function isNonNegativeInt(raw: unknown): raw is number {
  return isNonNegativeNumber(raw) && Number.isInteger(raw);
}

export function isQuit(raw: unknown): raw is Quit {
  if (!raw || typeof raw !== 'object') return false;
  const q = raw as Partial<Quit>;
  return (
    typeof q.id === 'string' &&
    q.id.length > 0 &&
    isQuitCategory(q.category) &&
    (q.customName === undefined || typeof q.customName === 'string') &&
    typeof q.startDate === 'string' &&
    !isNaN(Date.parse(q.startDate)) &&
    Array.isArray(q.reasons) &&
    q.reasons.length >= 1 &&
    q.reasons.length <= 3 &&
    q.reasons.every((r) => typeof r === 'string' && r.length > 0) &&
    isNonNegativeNumber(q.dailyCost) &&
    isNonNegativeNumber(q.dailyMinutes) &&
    typeof q.pledgeTime === 'string' &&
    /^\d{2}:\d{2}$/.test(q.pledgeTime) &&
    isNonNegativeInt(q.longestStreakDays) &&
    isNonNegativeInt(q.totalRelapses)
  );
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isPledgeState(raw: unknown): raw is PledgeState {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<PledgeState>;
  return (
    (p.lastPledgeDayKey === null ||
      (typeof p.lastPledgeDayKey === 'string' &&
        DAY_KEY_RE.test(p.lastPledgeDayKey))) &&
    isNonNegativeInt(p.pledgeStreak)
  );
}

export function isRelapseEntry(raw: unknown): raw is RelapseEntry {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Partial<RelapseEntry>;
  return (
    typeof r.date === 'string' &&
    !isNaN(Date.parse(r.date)) &&
    isNonNegativeNumber(r.daysCleanBefore) &&
    (r.note === undefined || typeof r.note === 'string')
  );
}

export function isJournalEntry(raw: unknown): raw is JournalEntry {
  if (!raw || typeof raw !== 'object') return false;
  const j = raw as Partial<JournalEntry>;
  return (
    typeof j.id === 'string' &&
    typeof j.dayKey === 'string' &&
    DAY_KEY_RE.test(j.dayKey) &&
    (j.craving === null ||
      (typeof j.craving === 'number' &&
        Number.isInteger(j.craving) &&
        j.craving >= 1 &&
        j.craving <= 5)) &&
    typeof j.note === 'string' &&
    (j.voiceUri === undefined || typeof j.voiceUri === 'string') &&
    typeof j.createdAt === 'string' &&
    !isNaN(Date.parse(j.createdAt))
  );
}

export function isAppState(raw: unknown): raw is AppState {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<AppState>;
  const settings = s.settings as Partial<AppSettings> | undefined;
  return (
    s.schemaVersion === 2 &&
    (s.quit === null || isQuit(s.quit)) &&
    isPledgeState(s.pledge) &&
    Array.isArray(s.relapseLog) &&
    s.relapseLog.every(isRelapseEntry) &&
    Array.isArray(s.journal) &&
    s.journal.every(isJournalEntry) &&
    Array.isArray(s.milestonesSeen) &&
    s.milestonesSeen.every(isNonNegativeInt) &&
    Array.isArray(s.urgeSurfs) &&
    s.urgeSurfs.every(
      (u) => typeof u === 'string' && !isNaN(Date.parse(u))
    ) &&
    Boolean(settings) &&
    typeof settings!.pledgeReminder === 'boolean' &&
    typeof settings!.milestoneAlerts === 'boolean' &&
    (settings!.orbTheme === 'dawn' ||
      settings!.orbTheme === 'ember' ||
      settings!.orbTheme === 'tide') &&
    (settings!.shareCardStyle === 'classic' ||
      settings!.shareCardStyle === 'noir') &&
    // appearance is optional for forward-compat: pre-redesign persisted
    // states lack it and are normalized to 'system' on load.
    (settings!.appearance === undefined ||
      settings!.appearance === 'light' ||
      settings!.appearance === 'dark' ||
      settings!.appearance === 'system')
  );
}
