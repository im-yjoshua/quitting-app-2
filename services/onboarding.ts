/**
 * Onboarding — pure state construction from the 4-step answers.
 * No storage, no side effects: persistence lives in appStateStore.
 */
import type { AppState, Quit, QuitCategory } from '../types/app';
import { INITIAL_PLEDGE_STATE } from './pledge';

export interface OnboardingAnswers {
  category: QuitCategory;
  /** Free text, only used when category === 'custom' */
  customName?: string;
  /** 1–3 reasons; trimmed and validated here */
  reasons: string[];
  /** 0 when skipped/unknown */
  dailyCost: number;
  /** 0 when skipped/unknown */
  dailyMinutes: number;
  /** Local "HH:MM" 24h */
  pledgeTime: string;
}

/**
 * Builds the Quit record from onboarding answers. Throws when fewer than
 * one reason is provided (step 2 requires min 1).
 */
export function createQuitFromAnswers(
  answers: OnboardingAnswers,
  nowMs: number
): Quit {
  const reasons = answers.reasons
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .slice(0, 3);
  if (reasons.length === 0) {
    throw new Error('At least one reason is required to start.');
  }
  return {
    id: `quit_${nowMs}`,
    category: answers.category,
    customName:
      answers.category === 'custom'
        ? (answers.customName ?? '').trim()
        : undefined,
    startDate: new Date(nowMs).toISOString(),
    reasons,
    dailyCost: Math.max(0, answers.dailyCost),
    dailyMinutes: Math.max(0, answers.dailyMinutes),
    pledgeTime: answers.pledgeTime,
    longestStreakDays: 0,
    totalRelapses: 0,
  };
}

/** Wraps a fresh Quit in the default v2 AppState. */
export function createAppStateFromQuit(quit: Quit): AppState {
  return {
    schemaVersion: 2,
    quit,
    pledge: { ...INITIAL_PLEDGE_STATE },
    relapseLog: [],
    journal: [],
    milestonesSeen: [],
    urgeSurfs: [],
    settings: {
      pledgeReminder: true,
      milestoneAlerts: true,
      orbTheme: 'dawn',
      shareCardStyle: 'classic',
    },
  };
}
