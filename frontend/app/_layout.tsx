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
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../context/AuthContext";
import { DrawerProvider } from "../context/DrawerContext";
import { ThemeProvider as AppThemeProvider, useTheme } from "../context/ThemeContext";

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
  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([setupI18n(), Font.loadAsync(Ionicons.font)])
      .then(() => setReady(true))
      .catch(() => setReady(true));
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
      <AppThemeProvider>
        <AppShell />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
