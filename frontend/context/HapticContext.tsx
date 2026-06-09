import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "app_haptic_alerts";

interface HapticContextValue {
  hapticEnabled: boolean;
  setHapticEnabled: (v: boolean) => void;
  triggerCriticalAlert: () => void;
}

const HapticContext = createContext<HapticContextValue>({
  hapticEnabled: true,
  setHapticEnabled: () => {},
  triggerCriticalAlert: () => {},
});

export function HapticProvider({ children }: { children: React.ReactNode }) {
  const [hapticEnabled, setEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "false") setEnabledState(false);
    });
  }, []);

  const setHapticEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    AsyncStorage.setItem(STORAGE_KEY, String(v));
  }, []);

  const triggerCriticalAlert = useCallback(() => {
    if (!hapticEnabled || Platform.OS === "web") return;
    const fire = async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 350);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 700);
      } catch { /* device may not support haptics */ }
    };
    fire();
  }, [hapticEnabled]);

  return (
    <HapticContext.Provider value={{ hapticEnabled, setHapticEnabled, triggerCriticalAlert }}>
      {children}
    </HapticContext.Provider>
  );
}

export const useHaptic = () => useContext(HapticContext);
