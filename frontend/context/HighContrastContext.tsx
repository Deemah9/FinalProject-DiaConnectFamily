import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { registerPrefsApplicator } from "../services/preferencesSync";
import { savePreferences } from "../services/api";

const STORAGE_KEY = "app_high_contrast";

interface HighContrastContextValue {
  isHighContrast: boolean;
  toggleHighContrast: () => void;
}

const HighContrastContext = createContext<HighContrastContextValue>({
  isHighContrast: false,
  toggleHighContrast: () => {},
});

export function HighContrastProvider({ children }: { children: React.ReactNode }) {
  const [isHighContrast, setIsHighContrast] = useState(false);

  // Fast local load on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "true") setIsHighContrast(true);
    });
  }, []);

  // Sync with backend on login/logout
  useEffect(() => {
    const unregister = registerPrefsApplicator((prefs) => {
      if (prefs === null) {
        setIsHighContrast(false);
        AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        const hc = !!prefs.highContrast;
        setIsHighContrast(hc);
        AsyncStorage.setItem(STORAGE_KEY, String(hc));
      }
    });
    return unregister;
  }, []);

  const toggleHighContrast = useCallback(() => {
    const next = !isHighContrast;
    setIsHighContrast(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next));
    savePreferences({ highContrast: next }).catch(() => {});
  }, [isHighContrast]);

  return (
    <HighContrastContext.Provider value={{ isHighContrast, toggleHighContrast }}>
      {children}
    </HighContrastContext.Provider>
  );
}

export const useHighContrast = () => useContext(HighContrastContext);
