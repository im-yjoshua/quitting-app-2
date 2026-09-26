import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermissions,
  isNotificationScheduled,
  cancelScheduledNotification,
} from './notifications';

export const NOTIFICATIONS_SCHEDULE_KEY = '@sovereign/notifications_schedule';

/**
 * Deterministic identifiers for the three cadence slots. Scheduling is idempotent:
 * each slot is only scheduled when its identifier isn't already present, so enabling
 * the cadence (or re-running the scheduler) never duplicates or wipes other reminders.
 */
export const CADENCE_NOTIFICATION_IDENTIFIERS = {
  morning: 'sovereign_cadence_morning',
  midday: 'sovereign_cadence_midday',
  evening: 'sovereign_cadence_evening',
} as const;

const MORNING_MESSAGES = [
  "Morning Directive: 45 minutes of physical strain before sundown. Hold the standard.",
  "Morning Directive: Map your intent. Execute with precision today.",
  "Morning Directive: Protect your early hours. Clarity dictates victory.",
];

const MIDDAY_MESSAGES = [
  "Midday Anchor: Dopamine urges peak and pass in 10 minutes. Stay centered.",
  "Midday Anchor: Recalibrate your focus. The afternoon requires discipline.",
  "Midday Anchor: Do not negotiate with temporary cravings. Breathe.",
];

const EVENING_MESSAGES = [
  "Evening Audit: Close today's quests and log your daily voice reflection.",
  "Evening Audit: Screen-free time approaches. Disconnect and recover.",
  "Evening Audit: Review the day. What did you conquer? What needs tuning?",
];

function getRandomMessage(pool: string[]) {
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function scheduleDailyCadenceProtocol(): Promise<boolean> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  // Schedule only the slots that are missing — never cancelAll. The old
  // cancel-everything approach also wiped the 9 AM daily check-in; both
  // reminders now coexist and each scheduler owns only its own identifiers.
  const slots = [
    {
      identifier: CADENCE_NOTIFICATION_IDENTIFIERS.morning,
      title: 'Sovereign Morning',
      body: getRandomMessage(MORNING_MESSAGES),
      data: { type: 'cadence_morning' },
      hour: 8,
      minute: 0,
    },
    {
      identifier: CADENCE_NOTIFICATION_IDENTIFIERS.midday,
      title: 'Sovereign Midday',
      body: getRandomMessage(MIDDAY_MESSAGES),
      data: { type: 'cadence_midday' },
      hour: 14,
      minute: 0,
    },
    {
      identifier: CADENCE_NOTIFICATION_IDENTIFIERS.evening,
      title: 'Sovereign Evening',
      body: getRandomMessage(EVENING_MESSAGES),
      data: { type: 'cadence_evening' },
      hour: 20,
      minute: 30,
    },
  ];

  for (const slot of slots) {
    if (await isNotificationScheduled(slot.identifier)) {
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: slot.identifier,
      content: {
        title: slot.title,
        body: slot.body,
        sound: true,
        data: slot.data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
      },
    });
  }

  await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULE_KEY, 'true');
  return true;
}

export async function disableDailyCadenceProtocol(): Promise<void> {
  // Cancel only the cadence slots — the daily check-in is owned by the launch
  // scheduler and must survive toggling the cadence off.
  for (const identifier of Object.values(CADENCE_NOTIFICATION_IDENTIFIERS)) {
    await cancelScheduledNotification(identifier);
  }
  await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULE_KEY, 'false');
}

export async function checkDailyCadenceStatus(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(NOTIFICATIONS_SCHEDULE_KEY);
    return status === 'true';
  } catch {
    return false;
  }
}

export async function scheduleTestCheckpoint(): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'System Test',
      body: 'Diagnostics complete. Haptics and visual banners are active.',
      sound: true,
      data: { type: 'test_checkpoint' },
    },
    trigger: {
      seconds: 5,
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
    },
  });
}
