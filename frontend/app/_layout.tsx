import i18n, { setupI18n } from "@/src/i18n";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { ActivityIndicator, Platform, View } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider } from "../context/AuthContext";
import { DrawerProvider } from "../context/DrawerContext";
import { ThemeProvider as AppThemeProvider, useTheme } from "../context/ThemeContext";
import { FontSizeProvider } from "../context/FontSizeContext";
import { HighContrastProvider } from "../context/HighContrastContext";
import { HapticProvider, useHaptic } from "../context/HapticContext";
import { logReminderFired } from "../services/api";
import { getReminders, getRemindersEnabled } from "../services/reminderScheduler";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Inner component so it can read isDark from ThemeContext
function AppShell() {
  const { isDark } = useTheme();
  const { triggerCriticalAlert } = useHaptic();
  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([setupI18n(), Font.loadAsync(Ionicons.font)])
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  // Trigger haptic + save reminder to Firestore when a notification arrives in foreground (mobile)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      const id = notification.request.identifier ?? "";

      if (title.includes("⚠️")) {
        triggerCriticalAlert();
      }

      // Local glucose reminders — save to Firestore so they appear in the notifications page
      if (id.startsWith("dia_glucose_reminder_")) {
        logReminderFired(title, body).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [triggerCriticalAlert]);

  // Web reminder poller — fires custom reminders on web (scheduleNotificationAsync doesn't work on web)
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const checkWebReminders = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const [reminders, enabled] = await Promise.all([
          getReminders(),
          getRemindersEnabled(),
        ]);
        if (!enabled || reminders.length === 0) return;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const todayKey = `remindersFiredToday_${now.toDateString()}`;
        const firedRaw = await AsyncStorage.getItem(todayKey);
        const fired: string[] = firedRaw ? JSON.parse(firedRaw) : [];

        for (const reminder of reminders) {
          const fireKey = `${reminder.time}|${reminder.name}`;
          if (reminder.time === currentTime && !fired.includes(fireKey)) {
            const title = reminder.name.trim() || "Glucose Reminder";
            await logReminderFired(title, "Time to measure your blood glucose 🩸").catch(() => {});
            fired.push(fireKey);
            await AsyncStorage.setItem(todayKey, JSON.stringify(fired));
          }
        }
      } catch {}
    };

    // Check immediately on mount, then every minute
    checkWebReminders();
    const id = setInterval(checkWebReminders, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <StatusBar style={isDark ? "light" : "dark"} />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <DrawerProvider>
          <ThemeProvider value={navTheme}>
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style={isDark ? "light" : "dark"} />
          </ThemeProvider>
        </DrawerProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FontSizeProvider>
        <HighContrastProvider>
          <HapticProvider>
            <AppThemeProvider>
              <AppShell />
            </AppThemeProvider>
          </HapticProvider>
        </HighContrastProvider>
      </FontSizeProvider>
    </GestureHandlerRootView>
  );
}
