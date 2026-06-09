import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const TIMES_KEY   = "custom_reminder_times";    // string[] of "HH:MM" (24h)
const ENABLED_KEY = "custom_reminders_enabled"; // "true" | "false"
const ID_PREFIX   = "dia_glucose_reminder_";

export async function getReminderTimes(): Promise<string[]> {
  const val = await AsyncStorage.getItem(TIMES_KEY);
  return val ? JSON.parse(val) : [];
}

export async function getRemindersEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ENABLED_KEY);
  return val !== "false";
}

/** Cancel all scheduled glucose reminder notifications */
async function cancelAll() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch { /* web may not support this */ }
}

/** Schedule a daily local notification for each "HH:MM" time */
export async function applyReminderSchedule(
  times: string[],
  enabled: boolean,
  title: string,
  body: string
): Promise<void> {
  await cancelAll();
  if (!enabled || times.length === 0) return;

  for (const time of times) {
    const [h, m] = time.split(":").map(Number);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${time}`,
        content: { title, body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: h,
          minute: m,
        } as any,
      });
    } catch {
      /* ignore — web doesn't support scheduled notifications */
    }
  }
}

/** Save preferences and reschedule */
export async function saveReminderPreferences(
  times: string[],
  enabled: boolean,
  title: string,
  body: string
): Promise<void> {
  await AsyncStorage.setItem(TIMES_KEY, JSON.stringify(times));
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  await applyReminderSchedule(times, enabled, title, body);
}

/** Convert 12h picker values → 24h "HH:MM" */
export function to24h(hour12: string, minute: string, isPM: boolean): string {
  let h = parseInt(hour12, 10);
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Convert 24h "HH:MM" → 12h picker values */
export function from24h(time: string): { hour12: string; minute: string; isPM: boolean } {
  const [h, m] = time.split(":").map(Number);
  const isPM = h >= 12;
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    hour12: String(hour12).padStart(2, "0"),
    minute: String(m).padStart(2, "0"),
    isPM,
  };
}

/** Format "HH:MM" for display (e.g. "08:30 ص" in Arabic) */
export function formatTime(time: string, amLabel: string, pmLabel: string): string {
  const { hour12, minute, isPM } = from24h(time);
  return `${hour12}:${minute} ${isPM ? pmLabel : amLabel}`;
}
