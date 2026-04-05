import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { setAppLanguage } from "@/src/i18n";
import { getGlucoseReadings, getProfile } from "@/services/api";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState("");

  const [glucoseReadings, setGlucoseReadings] = useState<any[]>([]);
  const [loadingGlucose, setLoadingGlucose] = useState(true);
  const [errorGlucose, setErrorGlucose] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadGlucose();
    }, []),
  );

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      setErrorUser("");

      const data = await getProfile();
      setUser(data);
    } catch (error: any) {
      setErrorUser(error?.message || "Failed to load profile");
    } finally {
      setLoadingUser(false);
    }
  };

  const loadGlucose = async () => {
    try {
      setLoadingGlucose(true);
      setErrorGlucose("");

      const data = await getGlucoseReadings();

      if (Array.isArray(data)) {
        setGlucoseReadings(data);
      } else if (Array.isArray(data?.items)) {
        setGlucoseReadings(data.items);
      } else if (Array.isArray(data?.readings)) {
        setGlucoseReadings(data.readings);
      } else {
        setGlucoseReadings([]);
      }
    } catch (error: any) {
      console.log("glucose fetch error:", error);
      setErrorGlucose(error?.message || "Failed to load glucose readings");
      setGlucoseReadings([]);
    } finally {
      setLoadingGlucose(false);
    }
  };

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || t("user");

  const role = user?.role || t("patient");

  const values = glucoseReadings
    .map((g) => Number(g?.value || 0))
    .filter((v) => !Number.isNaN(v) && v > 0);

  const latest = values.length > 0 ? values[0] : "--";

  const avg =
    values.length > 0
      ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
      : "--";

  const min = values.length > 0 ? Math.min(...values) : "--";
  const max = values.length > 0 ? Math.max(...values) : "--";

  const latestStatus =
    typeof latest === "number"
      ? latest < 70
        ? t("low")
        : latest > 180
          ? t("high")
          : t("normal")
      : "--";

  return (
    <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu-outline" size={24} color="#374151" />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color="#D4AF37" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
              <Text style={styles.logoSub}>{t("family")}</Text>
            </View>
          </View>

          <View style={styles.iconPlaceholder} />
        </View>

        {/* Welcome */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loadingUser
              ? t("loading")
              : `${t("welcomeBack")}, ${fullName}!`}
          </Text>
          <Text style={styles.welcomeSub}>
            {errorUser ? errorUser : t("homeSubtitle")}
          </Text>
        </View>

        {/* Role Badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{role}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("quickActions")}</Text>

          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickCard}
              onPress={() => router.push("/glucose-history" as any)}
            >
              <View
                style={[styles.quickIconCircle, { backgroundColor: "#EFF6FF" }]}
              >
                <Ionicons name="flash-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.quickTitle}>{t("quickCheck")}</Text>
              <Text style={styles.quickSub}>{t("fastGlucoseReading")}</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => router.push("/add-glucose" as any)}
            >
              <View
                style={[styles.quickIconCircle, { backgroundColor: "#ECFDF5" }]}
              >
                <Ionicons name="add-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.quickTitle}>{t("newEntry")}</Text>
              <Text style={styles.quickSub}>{t("addMeasurement")}</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => router.push("/daily-log" as any)}
            >
              <View
                style={[styles.quickIconCircle, { backgroundColor: "#EEF2FF" }]}
              >
                <Ionicons name="calendar-outline" size={24} color="#4A7DC9" />
              </View>
              <Text style={styles.quickTitle}>{t("dailyLog")}</Text>
              <Text style={styles.quickSub}>{t("mealsActivitySleep")}</Text>
            </Pressable>
          </View>
        </View>

        {/* Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("alerts")}</Text>

          <View style={styles.alertCard}>
            <View
              style={[styles.alertIconCircle, { backgroundColor: "#FFFBEB" }]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#F59E0B"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.alertMainTitle}>{t("medicationReminder")}</Text>
              <Text style={styles.alertMainSub}>{t("eveningDose")}</Text>
            </View>
          </View>
        </View>

        {/* Today's Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("todaysOverview")}</Text>

          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>{t("bloodGlucose")}</Text>
            <Text style={styles.overviewSub}>
              {errorGlucose ? errorGlucose : t("trackReadings")}
            </Text>

            <View style={styles.latestWrap}>
              <Text style={styles.latestValue}>
                {loadingGlucose ? "--" : latest}
              </Text>
              <Text style={styles.latestUnit}>{t("mgdL")}</Text>
            </View>

            <View style={styles.latestStatusWrap}>
              <Text style={styles.latestStatusLabel}>{t("status")}</Text>
              <View
                style={[
                  styles.statusPill,
                  latestStatus === t("low")
                    ? { backgroundColor: "#FEF9C3" }
                    : latestStatus === t("high")
                    ? { backgroundColor: "#FEE2E2" }
                    : { backgroundColor: "#DCFCE7" },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    latestStatus === t("low")
                      ? { color: "#CA8A04" }
                      : latestStatus === t("high")
                      ? { color: "#DC2626" }
                      : { color: "#16A34A" },
                  ]}
                >
                  {latestStatus}
                </Text>
              </View>
            </View>

            <View style={styles.overviewGrid}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>{t("average")}</Text>
                <Text style={styles.overviewItemValue}>{avg}</Text>
              </View>

              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>{t("min")}</Text>
                <Text style={styles.overviewItemValue}>{min}</Text>
              </View>

              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>{t("max")}</Text>
                <Text style={styles.overviewItemValue}>{max}</Text>
              </View>
            </View>

            <View style={styles.glucoseButtonsRow}>
              <Pressable
                style={styles.glucosePrimaryBtn}
                onPress={() => router.push("/add-glucose" as any)}
              >
                <Text style={styles.glucosePrimaryText}>{t("addReading")}</Text>
              </Pressable>

              <Pressable
                style={styles.glucoseSecondaryBtn}
                onPress={() => router.push("/glucose-history" as any)}
              >
                <Text style={styles.glucoseSecondaryText}>{t("history")}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("recentAlerts")}</Text>

          <View style={styles.recentList}>
            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#FACC15" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{t("reminder")}</Text>
                <Text style={styles.recentSub}>{t("measureAfterLunch")}</Text>
                <Text style={styles.recentTime}>{t("twoHoursAgo")}</Text>
              </View>
            </View>

            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#60A5FA" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{t("tip")}</Text>
                <Text style={styles.recentSub}>{t("drinkWater")}</Text>
                <Text style={styles.recentTime}>{t("fiveHoursAgo")}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Top Menu Drawer */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.drawer} onPress={() => {}}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>{t("menu")}</Text>
              <Pressable onPress={() => setMenuOpen(false)}>
                <Ionicons name="close-outline" size={22} color="#374151" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSection}>{t("profileNavigation")}</Text>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/profile");
                }}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("openProfile")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/edit-profile" as any);
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("editProfile")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/medical-info" as any);
                }}
              >
                <Ionicons
                  name="pulse-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("medicalInfo")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/lifestyle-habits" as any);
                }}
              >
                <Ionicons
                  name="moon-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("lifestyleHabits")}</Text>
              </Pressable>

              <Text style={styles.drawerSection}>{t("glucoseNavigation")}</Text>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/glucose-history" as any);
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("glucoseHistory")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/add-glucose" as any);
                }}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("addGlucose")}</Text>
              </Pressable>

              <Text style={styles.drawerSection}>{t("dailyLogsSection")}</Text>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/daily-log" as any);
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("dailyLog")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/add-meal" as any);
                }}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("addMeal")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/add-activity" as any);
                }}
              >
                <Ionicons
                  name="walk-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("addActivity")}</Text>
              </Pressable>

              <Pressable
                style={styles.drawerItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/add-sleep" as any);
                }}
              >
                <Ionicons
                  name="moon-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.drawerItemText}>{t("addSleep")}</Text>
              </Pressable>

              <Text style={styles.drawerSection}>{t("languageSection")}</Text>

              {[
                { code: "en", label: "English" },
                { code: "ar", label: "العربية" },
                { code: "he", label: "עברית" },
              ].map(({ code, label }) => (
                <Pressable
                  key={code}
                  style={styles.drawerItem}
                  onPress={() => {
                    setMenuOpen(false);
                    setAppLanguage(code as "en" | "ar" | "he");
                  }}
                >
                  <Ionicons name="language-outline" size={18} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{label}</Text>
                </Pressable>
              ))}

              <Pressable
                style={[
                  styles.drawerItem,
                  {
                    marginTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: "#eee",
                    paddingTop: 16,
                  },
                ]}
                onPress={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#e53935" />
                <Text style={[styles.drawerItemText, { color: "#e53935" }]}>
                  {t("logout")}
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  iconPlaceholder: {
    width: 40,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoTitle: {
    color: "#1F2937",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "300",
  },

  hero: {
    marginTop: 28,
    marginBottom: 16,
  },

  welcomeTitle: {
    color: "#1F2937",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  welcomeSub: {
    color: "#6B7280",
    fontSize: 14,
  },

  roleBadge: {
    alignSelf: "flex-start",
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },

  roleBadgeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },

  section: {
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  quickGrid: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },

  quickCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    alignItems: "center",
  },

  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  quickTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },

  quickSub: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  alertMainTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  alertMainSub: {
    color: "#6B7280",
    fontSize: 12,
  },

  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  overviewTitle: {
    color: "#1F2937",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },

  overviewSub: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
  },

  latestWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },

  latestValue: {
    fontSize: 42,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 46,
  },

  latestUnit: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 6,
    marginBottom: 8,
  },

  latestStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  latestStatusLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 6,
  },

  latestStatusValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  overviewGrid: {
    flexDirection: "row",
    gap: 10,
  },

  overviewItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },

  overviewItemLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },

  overviewItemValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },

  glucoseButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  glucosePrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  glucosePrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  glucoseSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  glucoseSecondaryText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },

  recentList: {
    gap: 12,
  },

  recentItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },

  recentTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  recentSub: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 4,
  },

  recentTime: {
    color: "#9CA3AF",
    fontSize: 11,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },

  drawer: {
    marginTop: 78,
    marginLeft: 16,
    width: 240,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  drawerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  drawerSection: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
    letterSpacing: 1,
  },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },

  drawerItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
});
