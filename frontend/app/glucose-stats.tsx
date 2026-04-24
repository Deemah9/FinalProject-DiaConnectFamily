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

import AppHeader from "@/src/components/AppHeader";
import { getGlucoseStats } from "@/services/api";

const DAY_OPTIONS = [7, 14, 30] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

export default function GlucoseStatsScreen() {
  const { t } = useTranslation();
  const [days, setDays] = useState<DayOption>(7);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadStats = useCallback(
    async (d: DayOption) => {
      try {
        setLoading(true);
        setErrorMsg("");
        const data = await getGlucoseStats(d);
        setStats(data);
      } catch (e: any) {
        setErrorMsg(e?.message || "Failed to load stats");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useFocusEffect(useCallback(() => { loadStats(days); }, [days]));

  const handleDayChange = (d: DayOption) => {
    setDays(d);
  };

  const hasData = stats && stats.count > 0;

  const timeInRangeColor = (pct: number) => {
    if (pct >= 70) return "#0D9E6E";
    if (pct >= 50) return "#E07B00";
    return "#D32F2F";
  };

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Title row */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("glucoseStats")}</Text>
            <Text style={styles.screenSub}>{t("glucoseStatsSub")}</Text>
          </View>
        </View>

        {/* Day filter */}
        <View style={styles.filterRow}>
          {DAY_OPTIONS.map((d) => (
            <Pressable
              key={d}
              style={[styles.filterBtn, days === d && styles.filterBtnActive]}
              onPress={() => handleDayChange(d)}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  days === d && styles.filterBtnTextActive,
                ]}
              >
                {d}d
              </Text>
            </Pressable>
          ))}
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.card}>
            <Text style={styles.loadingText}>{t("loadingStats")}</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <Ionicons
                name="bar-chart-outline"
                size={32}
                color="#94A3B8"
              />
              <Text style={styles.emptyTitle}>{t("noDataForPeriod")}</Text>
              <Text style={styles.emptySub}>
                {t("noDataForPeriodSub")}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Time in range — hero card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={18} color="#1A6FA8" />
                <Text style={styles.cardTitle}>{t("timeInRange")}</Text>
              </View>
              <View style={styles.tirRow}>
                <Text
                  style={[
                    styles.tirValue,
                    { color: timeInRangeColor(stats.time_in_range) },
                  ]}
                >
                  {stats.time_in_range}%
                </Text>
                <Text style={styles.tirLabel}>{t("timeInRangeDesc")}</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(stats.time_in_range, 100)}%` as any,
                      backgroundColor: timeInRangeColor(
                        stats.time_in_range
                      ),
                    },
                  ]}
                />
              </View>
              <Text style={styles.tirNote}>{t("timeInRangeNote")}</Text>
            </View>

            {/* Average / Min / Max */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color="#1A6FA8"
                />
                <Text style={styles.cardTitle}>{t("statistics")}</Text>
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t("average")}</Text>
                  <Text style={styles.statValue}>
                    {stats.average}
                    <Text style={styles.statUnit}> mg/dL</Text>
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t("min")}</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          stats.min < 70
                            ? "#E07B00"
                            : "#0D9E6E",
                      },
                    ]}
                  >
                    {stats.min}
                    <Text style={styles.statUnit}> mg/dL</Text>
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t("max")}</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          stats.max > 180 ? "#D32F2F" : "#0D9E6E",
                      },
                    ]}
                  >
                    {stats.max}
                    <Text style={styles.statUnit}> mg/dL</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Reading count */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#1A6FA8"
                />
                <Text style={styles.cardTitle}>{t("totalReadings")}</Text>
              </View>
              <Text style={styles.countValue}>{stats.count}</Text>
              <Text style={styles.countSub}>
                {t("readingsInPeriod", { days: stats.days })}
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  heroRow: {
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  screenTitle: {
    color: "#0B1A2E",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  screenSub: { color: "#4A6480", fontSize: 14 },

  // Day filter
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E8F5",
  },
  filterBtnActive: {
    backgroundColor: "#1A6FA8",
    borderColor: "#1A6FA8",
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4A6480",
  },
  filterBtnTextActive: { color: "#FFFFFF" },

  errorBox: {
    marginBottom: 16,
    backgroundColor: "#FDEDED",
    borderWidth: 1,
    borderColor: "#F5C2C2",
    borderRadius: 14,
    padding: 12,
  },
  errorText: { color: "#B91C1C", fontSize: 13, fontWeight: "500" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 20,
    marginBottom: 18,
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
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B1A2E" },
  loadingText: { fontSize: 14, color: "#4A6480" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1A2E",
  },
  emptySub: { marginTop: 6, fontSize: 12, color: "#4A6480" },

  // Time in range
  tirRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 14,
  },
  tirValue: { fontSize: 42, fontWeight: "800" },
  tirLabel: { fontSize: 13, color: "#4A6480", flex: 1 },
  progressBg: {
    height: 10,
    backgroundColor: "#EBF3FA",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: 10, borderRadius: 99 },
  tirNote: { fontSize: 11, color: "#7A96B0" },

  // Stats grid
  statGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 8 },
  statLabel: { fontSize: 12, color: "#4A6480", marginBottom: 4 },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0B1A2E",
  },
  statUnit: { fontSize: 11, fontWeight: "400", color: "#4A6480" },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#D6E8F5",
  },

  // Count
  countValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1A6FA8",
    marginBottom: 4,
  },
  countSub: { fontSize: 13, color: "#4A6480" },
});
