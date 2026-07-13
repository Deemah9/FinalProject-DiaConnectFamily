import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getReminderSettingsRemote, saveReminderSettingsRemote } from "./api";

const REMINDERS_KEY = "custom_reminders";       // JSON array of {name, time}
const ENABLED_KEY   = "custom_reminders_enabled"; // "true" | "false"
const ID_PREFIX     = "dia_glucose_reminder_";

export interface Reminder {
  name: string;
  time: string; // "HH:MM" 24h
}

export async function getReminders(): Promise<Reminder[]> {
  const val = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export async function getRemindersEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ENABLED_KEY);
  return val !== "false";
}

export async function getReminderTimes(): Promise<string[]> {
  const reminders = await getReminders();
  return reminders.map((r) => r.time);
}

/** Fetch from backend, write to AsyncStorage, fall back to local on error */
export async function loadReminderSettings(): Promise<{ reminders: Reminder[]; enabled: boolean }> {
  try {
    const remote = await getReminderSettingsRemote();
    const reminders: Reminder[] = remote?.reminders ?? [];
    const enabled: boolean = remote?.enabled ?? true;
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
    return { reminders, enabled };
  } catch {
    return {
      reminders: await getReminders(),
      enabled:   await getRemindersEnabled(),
    };
  }
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

/** Schedule a daily local notification for each reminder, using its name as title */
export async function applyReminderSchedule(
  reminders: Reminder[],
  enabled: boolean,
  defaultTitle: string,
  defaultBody: string
): Promise<void> {
  await cancelAll();
  if (!enabled || reminders.length === 0) return;

  for (const reminder of reminders) {
    const [h, m] = reminder.time.split(":").map(Number);
    const title = reminder.name.trim() || defaultTitle;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${reminder.time}`,
        content: { title, body: defaultBody, sound: true },
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

/** Save preferences locally, reschedule notifications, and sync to backend */
export async function saveReminderPreferences(
  reminders: Reminder[],
  enabled: boolean,
  defaultTitle: string,
  defaultBody: string
): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  await applyReminderSchedule(reminders, enabled, defaultTitle, defaultBody);
  try {
    await saveReminderSettingsRemote(enabled, reminders);
  } catch { /* local schedule is set — backend sync is best-effort */ }
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
