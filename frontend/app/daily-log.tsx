import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import { getTodayLogs } from "@/services/api";

const ACCENT = {
  meal:     { icon: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
  activity: { icon: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
  sleep:    { icon: "#6366F1", bg: "#EEF2FF", border: "#A5B4FC" },
};

export default function DailyLogScreen() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadDailyLogs = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getTodayLogs();
      setLogs(data || {});
    } catch (error: any) {
      console.log("daily logs error:", error);
      setErrorMsg(error?.message || "Failed to load daily logs");
      setLogs({});
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDailyLogs();
    }, [])
  );

  const meals = Array.isArray(logs?.meals) ? logs.meals : [];
  const activities = Array.isArray(logs?.activities) ? logs.activities : [];
  const sleepLogs = Array.isArray(logs?.sleep)
    ? logs.sleep
    : logs?.sleep
    ? [logs.sleep]
    : [];

  const totalMeals = meals.length;
  const totalCarbs = meals.reduce(
    (sum: number, meal: any) => sum + Number(meal?.carbs || 0),
    0
  );
  const totalActivityMinutes = activities.reduce(
    (sum: number, activity: any) => sum + Number(activity?.duration_minutes || 0),
    0
  );
  const latestSleepHours =
    sleepLogs.length > 0 ? Number(sleepLogs[0]?.sleep_hours || 0) : 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.menuBtn}>
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color={Colors.gold} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
              <Text style={styles.logoSub}>{t("family")}</Text>
            </View>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("dailyLog")}</Text>
          <Text style={styles.screenSub}>{t("trackDailyLog")}</Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Quick Add */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("quickAdd")}</Text>

          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickCard}
              onPress={() => router.push("/add-meal" as any)}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: ACCENT.meal.bg }]}>
                <Ionicons name="restaurant-outline" size={22} color={ACCENT.meal.icon} />
              </View>
              <Text style={styles.quickTitle}>{t("addMeal")}</Text>
              <Text style={styles.quickSub}>{t("logFoodCarbs")}</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => router.push("/add-activity" as any)}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: ACCENT.activity.bg }]}>
                <Ionicons name="walk-outline" size={22} color={ACCENT.activity.icon} />
              </View>
              <Text style={styles.quickTitle}>{t("addActivity")}</Text>
              <Text style={styles.quickSub}>{t("trackMovement")}</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 10 }}>
            <Pressable
              style={styles.sleepCard}
              onPress={() => router.push("/add-sleep" as any)}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: ACCENT.sleep.bg }]}>
                <Ionicons name="moon-outline" size={22} color={ACCENT.sleep.icon} />
              </View>
              <Text style={styles.sleepCardText}>{t("addSleep")}</Text>
              <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("todaysSummary")}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="restaurant-outline" size={18} color={ACCENT.meal.icon} style={styles.statIcon} />
              <Text style={styles.statValue}>{loading ? "--" : totalMeals}</Text>
              <Text style={styles.statLabel}>{t("meals")}</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="leaf-outline" size={18} color="#16A34A" style={styles.statIcon} />
              <Text style={styles.statValue}>{loading ? "--" : `${totalCarbs}g`}</Text>
              <Text style={styles.statLabel}>{t("carbs")}</Text>
            </View>
          </View>

          <View style={[styles.statsGrid, { marginTop: 10 }]}>
            <View style={styles.statCard}>
              <Ionicons name="walk-outline" size={18} color={ACCENT.activity.icon} style={styles.statIcon} />
              <Text style={styles.statValue}>{loading ? "--" : `${totalActivityMinutes}m`}</Text>
              <Text style={styles.statLabel}>{t("activity")}</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="moon-outline" size={18} color={ACCENT.sleep.icon} style={styles.statIcon} />
              <Text style={styles.statValue}>{loading ? "--" : latestSleepHours || "--"}</Text>
              <Text style={styles.statLabel}>{t("sleepHours")}</Text>
            </View>
          </View>
        </View>

        {/* Meals */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("mealsSection")}</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="restaurant-outline" size={18} color={ACCENT.meal.icon} />
              <Text style={styles.cardTitle}>{t("mealLogs")}</Text>
            </View>

            {loading ? (
              <Text style={styles.loadingText}>{t("loadingMeals")}</Text>
            ) : meals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="restaurant-outline" size={30} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{t("noMealsToday")}</Text>
                <Text style={styles.emptySub}>{t("addFirstMeal")}</Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {meals.map((meal: any, index: number) => (
                  <View
                    key={meal?.id || meal?._id || index}
                    style={[styles.logRow, { borderLeftColor: ACCENT.meal.icon }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logMainText}>
                        {meal?.foods || meal?.name || t("meal")}
                      </Text>
                      <Text style={styles.logSubText}>
                        {`${t("carbs")}: ${meal?.carbs || 0} ${t("carbsUnit")}`}
                      </Text>
                      <Text style={styles.logDateText}>
                        {formatDate(meal?.timestamp || meal?.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: ACCENT.meal.bg, borderColor: ACCENT.meal.border }]}>
                      <Text style={[styles.badgeText, { color: ACCENT.meal.icon }]}>{t("meal")}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("activitiesSection")}</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="walk-outline" size={18} color={ACCENT.activity.icon} />
              <Text style={styles.cardTitle}>{t("activityLogs")}</Text>
            </View>

            {loading ? (
              <Text style={styles.loadingText}>{t("loadingActivities")}</Text>
            ) : activities.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="walk-outline" size={30} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{t("noActivitiesToday")}</Text>
                <Text style={styles.emptySub}>{t("addFirstActivity")}</Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {activities.map((activity: any, index: number) => (
                  <View
                    key={activity?.id || activity?._id || index}
                    style={[styles.logRow, { borderLeftColor: ACCENT.activity.icon }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logMainText}>
                        {activity?.type || t("activity")}
                      </Text>
                      <Text style={styles.logSubText}>
                        {`${activity?.duration_minutes || 0} ${t("minUnit")}`}
                      </Text>
                      <Text style={styles.logDateText}>
                        {formatDate(activity?.timestamp || activity?.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: ACCENT.activity.bg, borderColor: ACCENT.activity.border }]}>
                      <Text style={[styles.badgeText, { color: ACCENT.activity.icon }]}>{t("activity")}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Sleep */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("sleepSection")}</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="moon-outline" size={18} color={ACCENT.sleep.icon} />
              <Text style={styles.cardTitle}>{t("sleepLogs")}</Text>
            </View>

            {loading ? (
              <Text style={styles.loadingText}>{t("loadingSleep")}</Text>
            ) : sleepLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="moon-outline" size={30} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{t("noSleepToday")}</Text>
                <Text style={styles.emptySub}>{t("addSleepEntry")}</Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {sleepLogs.map((sleep: any, index: number) => (
                  <View
                    key={sleep?.id || sleep?._id || index}
                    style={[styles.logRow, { borderLeftColor: ACCENT.sleep.icon }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logMainText}>
                        {`${sleep?.sleep_hours || 0} ${t("hoursUnit")}`}
                      </Text>
                      <Text style={styles.logSubText}>
                        {sleep?.notes || t("noNotes")}
                      </Text>
                      <Text style={styles.logDateText}>
                        {formatDate(sleep?.timestamp || sleep?.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: ACCENT.sleep.bg, borderColor: ACCENT.sleep.border }]}>
                      <Text style={[styles.badgeText, { color: ACCENT.sleep.icon }]}>{t("sleep")}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  placeholder: {
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
    marginBottom: 22,
  },

  screenTitle: {
    color: "#1F2937",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  screenSub: {
    color: "#6B7280",
    fontSize: 14,
  },

  errorBox: {
    marginBottom: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "500",
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

  /* Quick add cards */
  quickGrid: {
    flexDirection: "row",
    gap: 14,
  },

  quickCard: {
    flex: 1,
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

  sleepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  sleepCardText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },

  /* Stats grid (2×2) */
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  statIcon: {
    marginBottom: 6,
  },

  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },

  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },

  /* Log cards */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },

  emptySub: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
  },

  listWrap: {
    gap: 12,
  },

  logRow: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderLeftWidth: 3,
  },

  logMainText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },

  logSubText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },

  logDateText: {
    fontSize: 11,
    color: "#9CA3AF",
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
