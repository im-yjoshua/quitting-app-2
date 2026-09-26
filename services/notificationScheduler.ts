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
  "Today is a new day. Pledge it. 🌅",
  "Your future self is counting on today.",
  "One pledge. One day. You've got this.",
];

const MIDDAY_MESSAGES = [
  "Urges peak and pass in ~20 minutes. Ride it out. 🌊",
  "Halfway through the day — it's still yours.",
  "Breathe. The craving will pass; the streak stays.",
];

const EVENING_MESSAGES = [
  "How was today? Log a check-in in your journal.",
  "End the day clean. You earned it.",
  "One honest day. That's all it ever takes.",
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
