import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { StyleSheet } from "react-native";
import { registerPrefsApplicator } from "../services/preferencesSync";
import { savePreferences } from "../services/api";

const STORAGE_KEY = "app_font_scale";
export const MIN_SCALE     = 0.85;
export const MAX_SCALE     = 1.55;
export const DEFAULT_SCALE = 1.0;

// ── Global scale tracker (module-level so StyleSheet.create can read it) ──
let _fontScale = DEFAULT_SCALE;

// ── Patch StyleSheet.create once, at module load time ────────────────────
const _origCreate = StyleSheet.create.bind(StyleSheet);

function applyScale(styles: Record<string, any>, scale: number) {
  if (scale === 1.0) return styles;
  const out: Record<string, any> = {};
  for (const key in styles) {
    const s = styles[key];
    if (s && typeof s === "object" && typeof s.fontSize === "number") {
      out[key] = { ...s, fontSize: Math.round(s.fontSize * scale) };
    } else {
      out[key] = s;
    }
  }
  return out;
}

(StyleSheet as any).create = function (styles: any) {
  return _origCreate(applyScale(styles, _fontScale));
};
// ─────────────────────────────────────────────────────────────────────────

interface FontSizeContextValue {
  fontScale: number;
  setFontScale: (v: number) => void;
}

const FontSizeContext = createContext<FontSizeContextValue>({
  fontScale: DEFAULT_SCALE,
  setFontScale: () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setScaleState] = useState(DEFAULT_SCALE);

  // Fast local load on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      const parsed = parseFloat(val ?? "");
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        _fontScale = parsed;
        setScaleState(parsed);
      }
    });
  }, []);

  // Sync with backend on login/logout
  useEffect(() => {
    const unregister = registerPrefsApplicator((prefs) => {
      if (prefs === null) {
        _fontScale = DEFAULT_SCALE;
        setScaleState(DEFAULT_SCALE);
        AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        const scale = prefs.fontScale ?? DEFAULT_SCALE;
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        _fontScale = clamped;
        setScaleState(clamped);
        AsyncStorage.setItem(STORAGE_KEY, String(clamped));
      }
    });
    return unregister;
  }, []);

  const setFontScale = useCallback((v: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v));
    _fontScale = clamped;
    setScaleState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, String(clamped));
    savePreferences({ fontScale: clamped }).catch(() => {});
  }, []);

  return (
    <FontSizeContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => useContext(FontSizeContext);
