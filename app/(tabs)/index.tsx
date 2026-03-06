import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";

export default function HomeScreen() {
  const { t } = useTranslation();

  const userName = "Wagdi";
  const role: "patient" | "family" = "patient";

  const latest = {
    value: 135,
    unit: "mg/dL",
    time: "10:20 AM",
    status: "Normal",
  };

  const alerts = [
    { id: "1", title: "Reminder", body: "Measure glucose after lunch" },
    { id: "2", title: "Tip", body: "Drink water and stay active" },
  ];

  const roleLabel =
    role === "patient"
      ? t("patient", { defaultValue: "Patient" })
      : t("familyMember", { defaultValue: "Family" });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Brand */}
        <View style={styles.brand}>
          <Ionicons name="heart-outline" size={34} color={Colors.gold} />
          <View style={{ marginLeft: Spacing.sm }}>
            <Text style={styles.brandTitle}>
              {t("appName1", { defaultValue: "DiaConnect" })}
            </Text>
            <Text style={styles.brandSub}>
              {t("appName2", { defaultValue: "Family" })}
            </Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeSmall}>
              {t("welcomeBack", { defaultValue: "Welcome back" })}
            </Text>
            <Text style={styles.welcomeName}>{userName}</Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Latest reading */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons
                name="pulse-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.cardTitle}>
                {t("latestReading", { defaultValue: "Latest reading" })}
              </Text>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {t(latest.status.toLowerCase(), { defaultValue: latest.status })}
              </Text>
            </View>
          </View>

          <View style={styles.readingRow}>
            <Text style={styles.readingValue}>{latest.value}</Text>
            <Text style={styles.readingUnit}>{latest.unit}</Text>
          </View>

          <Text style={styles.muted}>
            {t("lastUpdate", { defaultValue: "Last update" })}: {latest.time}
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons
                name="flash-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.cardTitle}>
                {t("quickActions", { defaultValue: "Quick actions" })}
              </Text>
            </View>
          </View>

          <View style={styles.actionsGrid}>
            <Pressable style={styles.actionBtn}>
              <Ionicons
                name="notifications-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.actionText}>
                {t("alerts", { defaultValue: "Alerts" })}
              </Text>
            </Pressable>

            <Pressable style={styles.actionBtn}>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.actionText}>
                {t("addReading", { defaultValue: "Add reading" })}
              </Text>
            </Pressable>

            <Pressable style={[styles.actionBtn, styles.actionBtnWide]}>
              <Ionicons
                name="people-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.actionText}>
                {t("family", { defaultValue: "Family" })}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>
              {t("createNewEntry", { defaultValue: "Create new entry" })}
            </Text>
          </Pressable>
        </View>

        {/* Profile navigation */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons
                name="person-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.cardTitle}>Profile Navigation</Text>
            </View>
          </View>

          <View style={styles.profileButtonsColumn}>
            <Pressable
              style={styles.navBtn}
              onPress={() => router.push("/profile")}
            >
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.navBtnText}>Open Profile</Text>
            </Pressable>

            <Pressable
              style={styles.navBtn}
              onPress={() => router.push("/edit-profile" as any)}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.navBtnText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent alerts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons
                name="time-outline"
                size={18}
                color={stylesVars.primary}
              />
              <Text style={styles.cardTitle}>
                {t("recentAlerts", { defaultValue: "Recent alerts" })}
              </Text>
            </View>
          </View>

          <View style={{ gap: Spacing.md }}>
            {alerts.map((a) => (
              <View key={a.id} style={styles.alertRow}>
                <View style={styles.alertDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{a.title}</Text>
                  <Text style={styles.alertBody}>{a.body}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={stylesVars.muted}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  primary: Colors.primary,
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stylesVars.bg },

  content: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  brandTitle: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },

  brandSub: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 22,
  },

  welcomeRow: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  welcomeSmall: { color: stylesVars.muted, fontSize: 12 },

  welcomeName: {
    color: stylesVars.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },

  roleBadge: {
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  roleText: { color: stylesVars.text, fontSize: 12, fontWeight: "700" },

  card: {
    marginTop: Spacing.lg,
    borderRadius: 16,
    backgroundColor: stylesVars.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: stylesVars.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  cardTitle: { color: stylesVars.text, fontSize: 14, fontWeight: "800" },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#F8FAFC",
  },

  statusText: { color: stylesVars.text, fontSize: 12, fontWeight: "700" },

  readingRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },

  readingValue: {
    color: stylesVars.text,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 46,
  },

  readingUnit: {
    color: stylesVars.muted,
    fontSize: 14,
    paddingBottom: 6,
  },

  muted: { marginTop: Spacing.sm, color: stylesVars.muted, fontSize: 12 },

  actionsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    flexWrap: "wrap",
  },

  actionBtn: {
    flexGrow: 1,
    flexBasis: "48%",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  actionBtnWide: { flexBasis: "100%" },

  actionText: {
    color: stylesVars.text,
    fontSize: 12,
    fontWeight: "700",
  },

  primaryBtn: {
    marginTop: Spacing.lg,
    height: 54,
    borderRadius: 14,
    backgroundColor: stylesVars.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    ...Typography.button,
  },

  profileButtonsColumn: {
    gap: Spacing.md,
  },

  navBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  navBtnText: {
    color: stylesVars.text,
    fontSize: 13,
    fontWeight: "700",
  },

  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.gold,
  },

  alertTitle: {
    color: stylesVars.text,
    fontSize: 13,
    fontWeight: "800",
  },

  alertBody: {
    color: stylesVars.muted,
    fontSize: 12,
    marginTop: 2,
  },
});