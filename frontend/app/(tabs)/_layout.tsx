import { HapticTab } from "@/components/haptic-tab";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const tabStyles = StyleSheet.create({
  sosButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E53E3E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#E53E3E",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sosLabel: {
    color: "#E53E3E",
    fontSize: 11,
    fontWeight: "800",
  },
});

export default function TabLayout() {
  const theme = useAppTheme();
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.inactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: theme.tabBorder,
          backgroundColor: theme.tabBar,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("aria.tabHome"),
          tabBarAccessibilityLabel: t("aria.tabHome"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: "SOS",
          tabBarAccessibilityLabel: t("aria.tabSOS"),
          tabBarLabel: () => <Text style={tabStyles.sosLabel}>SOS</Text>,
          tabBarIcon: () => (
            <View style={tabStyles.sosButton}>
              <Ionicons name="call" size={26} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("aria.tabProfile"),
          tabBarAccessibilityLabel: t("aria.tabProfile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs — authenticated screens with tab bar */}
      <Tabs.Screen name="stats"                   options={{ href: null }} />
      <Tabs.Screen name="explore"                 options={{ href: null }} />
      <Tabs.Screen name="reminder-settings"       options={{ href: null }} />
      <Tabs.Screen name="a1c"                     options={{ href: null }} />
      <Tabs.Screen name="add-activity"            options={{ href: null }} />
      <Tabs.Screen name="add-glucose"             options={{ href: null }} />
      <Tabs.Screen name="add-insulin"             options={{ href: null }} />
      <Tabs.Screen name="add-meal"                options={{ href: null }} />
      <Tabs.Screen name="add-sleep"               options={{ href: null }} />
      <Tabs.Screen name="change-password"         options={{ href: null }} />
      <Tabs.Screen name="daily-log"               options={{ href: null }} />
      <Tabs.Screen name="edit-profile"            options={{ href: null }} />
      <Tabs.Screen name="family-access"           options={{ href: null }} />
      <Tabs.Screen name="family-home"             options={{ href: null }} />
      <Tabs.Screen name="family-invite"           options={{ href: null }} />
      <Tabs.Screen name="family-join"             options={{ href: null }} />
      <Tabs.Screen name="family-patient-glucose"  options={{ href: null }} />
      <Tabs.Screen name="family-patients"         options={{ href: null }} />
      <Tabs.Screen name="family-profile"          options={{ href: null }} />
      <Tabs.Screen name="glucose-history"         options={{ href: null }} />
      <Tabs.Screen name="glucose-stats"           options={{ href: null }} />
      <Tabs.Screen name="lifestyle-habits"        options={{ href: null }} />
      <Tabs.Screen name="medical-info"            options={{ href: null }} />
      <Tabs.Screen name="notifications"           options={{ href: null }} />
    </Tabs>
  );
}
