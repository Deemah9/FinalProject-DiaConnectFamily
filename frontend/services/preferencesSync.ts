import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPreferences } from "./api";

// Storage keys kept in sync with each preference context
const PREF_STORAGE_KEYS = [
  "app_theme_pref",
  "app_font_scale",
  "app_high_contrast",
  "app_haptic_alerts",
];

// null  → logout (reset everything to device default)
// {...} → always contains ALL fields with explicit values

type PrefsApplicator = (prefs: Record<string, any> | null) => void;
const _applicators = new Set<PrefsApplicator>();

export function registerPrefsApplicator(fn: PrefsApplicator): () => void {
  _applicators.add(fn);
  return () => _applicators.delete(fn);
}

/** Logout — every context resets to device/system default */
export function resetPreferencesToDefaults(): void {
  console.log('[PREFS] resetPreferencesToDefaults — applicators count:', _applicators.size);
  _applicators.forEach((fn) => { try { fn(null); } catch {} });
}

/**
 * Awaits removal of all preference keys from AsyncStorage.
 * Call this during logout so that a subsequent app restart never reads
 * the previous user's persisted settings.
 */
export async function clearPreferencesFromStorage(): Promise<void> {
  await Promise.allSettled(PREF_STORAGE_KEYS.map((k) => AsyncStorage.removeItem(k)));
  console.log('[PREFS] clearPreferencesFromStorage — done');
}

/**
 * Login / app restart — fetches this user's Firebase prefs and pushes
 * a COMPLETE object to every context (with explicit defaults for missing fields).
 * This guarantees User B never inherits User A's settings.
 */
export async function refreshPreferencesFromFirebase(): Promise<void> {
  console.log('[PREFS] refreshPreferencesFromFirebase — start, applicators:', _applicators.size);
  try {
    const raw = (await getPreferences()) as Record<string, any> | null;
    console.log('[PREFS] refreshPreferencesFromFirebase — raw from server:', raw);

    // Build a complete prefs object — every field has an explicit value
    const prefs: Record<string, any> = {
      theme:         raw?.theme         ?? null,
      fontScale:     raw?.fontScale     ?? 1.0,
      highContrast:  raw?.highContrast  ?? false,
      hapticEnabled: raw?.hapticEnabled ?? true,
    };

    console.log('[PREFS] refreshPreferencesFromFirebase — applying:', prefs);
    _applicators.forEach((fn) => { try { fn(prefs); } catch {} });
  } catch (e) {
    console.log('[PREFS] refreshPreferencesFromFirebase — ERROR (silent):', e);
  }
}
