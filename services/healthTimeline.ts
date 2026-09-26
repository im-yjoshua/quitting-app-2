/**
 * healthTimeline.ts — per-category body-recovery timelines for the Stats tab
 * (spec §2.5). Achieved state is driven by elapsed clean time, so the list
 * grows honestly with the streak. Custom categories get a generic timeline.
 *
 * These are well-known recovery windows (heart rate, nicotine clearance,
 * sleep, circulation…) — presented as encouragement, not medical claims.
 */
import { MS_PER_DAY } from './chronometerEngine';
import type { QuitCategory } from '../types/app';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export interface HealthMilestone {
  /** Elapsed clean time required to unlock. */
  atMs: number;
  label: string;
  detail: string;
}

function days(n: number): number {
  return n * MS_PER_DAY;
}

const GENERIC: HealthMilestone[] = [
  { atMs: days(1), label: 'First 24 hours', detail: 'The hardest day is behind you.' },
  { atMs: days(7), label: 'One week', detail: 'New routines are taking root.' },
  { atMs: days(30), label: 'One month', detail: 'Your body is visibly recovering.' },
  { atMs: days(90), label: 'Three months', detail: 'Cravings are rare visitors now.' },
  { atMs: days(180), label: 'Half a year', detail: 'This is who you are now.' },
  { atMs: days(365), label: 'One full year', detail: 'A completely new baseline.' },
];

export const HEALTH_TIMELINES: Record<QuitCategory, HealthMilestone[]> = {
  smoking: [
    { atMs: 20 * MIN, label: '20 minutes', detail: 'Heart rate and blood pressure drop.' },
    { atMs: 8 * HOUR, label: '8 hours', detail: 'Nicotine in your blood halves.' },
    { atMs: 48 * HOUR, label: '48 hours', detail: 'Nicotine is gone. Taste and smell sharpen.' },
    { atMs: days(14), label: '2 weeks', detail: 'Circulation improves; lungs start clearing.' },
    { atMs: days(30), label: '1 month', detail: 'Coughing fades. Breathing feels easier.' },
    { atMs: days(365), label: '1 year', detail: 'Heart disease risk is cut in half.' },
  ],
  weed: [
    { atMs: days(1), label: '24 hours', detail: 'THC levels start declining.' },
    { atMs: days(14), label: '2 weeks', detail: 'Vivid dreams return. Sleep deepens.' },
    { atMs: days(30), label: '1 month', detail: 'Brain fog lifts. Focus returns.' },
    { atMs: days(90), label: '3 months', detail: 'Memory and motivation sharpen.' },
    { atMs: days(180), label: '6 months', detail: 'Lungs clear. Endurance climbs.' },
    { atMs: days(365), label: '1 year', detail: 'Your baseline is fully restored.' },
  ],
  alcohol: [
    { atMs: days(1), label: '24 hours', detail: 'No hangover. Hydration returns.' },
    { atMs: days(7), label: '1 week', detail: 'Sleep quality noticeably improves.' },
    { atMs: days(14), label: '2 weeks', detail: 'Your liver is actively recovering.' },
    { atMs: days(30), label: '1 month', detail: 'Blood pressure drops. Skin glows.' },
    { atMs: days(180), label: '6 months', detail: 'Mental clarity at a new level.' },
    { atMs: days(365), label: '1 year', detail: 'Full-body recovery, sustained.' },
  ],
  porn: [
    { atMs: days(1), label: 'Day 1', detail: 'The dopamine reset begins.' },
    { atMs: days(7), label: '7 days', detail: 'Urges peak, then start to fade.' },
    { atMs: days(30), label: '30 days', detail: 'Sensitivity and drive returning.' },
    { atMs: days(90), label: '90 days', detail: 'Deep rewiring underway.' },
    { atMs: days(180), label: '180 days', detail: 'A new normal is settling in.' },
    { atMs: days(365), label: '1 year', detail: 'Full reboot. You did it.' },
  ],
  sugar: [
    { atMs: days(1), label: '24 hours', detail: 'Cravings peak — then weaken.' },
    { atMs: days(3), label: '3 days', detail: 'Taste buds reset; food tastes better.' },
    { atMs: days(7), label: '1 week', detail: 'Energy stops spiking and crashing.' },
    { atMs: days(14), label: '2 weeks', detail: 'Skin starts to clear.' },
    { atMs: days(30), label: '1 month', detail: 'Weight steadies. Cravings are quiet.' },
    { atMs: days(90), label: '3 months', detail: 'Metabolic reset, locked in.' },
  ],
  custom: GENERIC,
};

export function healthTimelineFor(category: QuitCategory): HealthMilestone[] {
  return HEALTH_TIMELINES[category] ?? GENERIC;
}
