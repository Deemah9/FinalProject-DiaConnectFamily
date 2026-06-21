import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { registerPrefsApplicator } from "../services/preferencesSync";
import { savePreferences } from "../services/api";

const STORAGE_KEY = "app_theme_pref";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === "dark");
  const [loaded, setLoaded] = useState(false);

  // Fast local load on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "dark") setIsDark(true);
      else if (saved === "light") setIsDark(false);
      else setIsDark(systemScheme === "dark");
      setLoaded(true);
    });
  }, []);

  // Sync with backend on login/logout
  useEffect(() => {
    const unregister = registerPrefsApplicator((prefs) => {
      if (prefs === null) {
        setIsDark(systemScheme === "dark");
        AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        const dark = prefs.theme === "dark";
        setIsDark(dark);
        AsyncStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
      }
    });
    return unregister;
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    savePreferences({ theme: next ? "dark" : "light" }).catch(() => {});
  }, [isDark]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
