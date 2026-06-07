import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "app_font_scale";
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.55;
const DEFAULT_SCALE = 1.0;

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      const parsed = parseFloat(val ?? "");
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        setScaleState(parsed);
      }
    });
  }, []);

  const setFontScale = useCallback((v: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v));
    setScaleState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, String(clamped));
  }, []);

  return (
    <FontSizeContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => useContext(FontSizeContext);
export { MIN_SCALE, MAX_SCALE, DEFAULT_SCALE };
