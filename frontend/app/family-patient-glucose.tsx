import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import GlucoseTrendChart from "@/src/components/GlucoseTrendChart";
import { getPatientGlucose, viewWithCode } from "@/services/api";

const SCREEN_WIDTH = Dimensions.get("window").width;

const getStatusColor = (value: number) => {
  if (value < 70) return "#E07B00";
  if (value > 180) return "#D32F2F";
  return "#0D9E6E";
};

const getStatusBg = (value: number) => {
  if (value < 70) return "#FEF3E2";
  if (value > 180) return "#FDEDED";
  return "#E6F7F2";
};

const dayStats = (items: any[]) => {
  const vals = items.map((r) => Number(r?.value || 0)).filter(Boolean);
  if (vals.length === 0) return null;
  return {
    avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
};

export default function FamilyPatientGlucoseScreen() {
  const { t } = useTranslation();
  const { patientId, patientName, familyCode } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    familyCode?: string;
  }>();

  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      load();
    }, [patientId])
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = familyCode
        ? await viewWithCode(familyCode).then((res) => res.readings ?? [])
        : await getPatientGlucose(patientId);
      let result: any[] = [];
      if (Array.isArray(data)) result = data;
      else if (Array.isArray(data?.items)) result = data.items;
      else if (Array.isArray(data?.readings)) result = data.readings;
      const parseDate = (item: any) => {
        const raw = item?.measuredAt || item?.timestamp || item?.createdAt;
        if (!raw) return 0;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
      };
      const sorted = [...result]
        .filter((g) => Number(g?.value) > 0 && parseDate(g) > 0)
        .sort((a, b) => parseDate(b) - parseDate(a));
      setReadings(sorted);
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of readings) {
      const raw = item?.measuredAt || item?.timestamp || item?.createdAt || "";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();

    return Array.from(map.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([key, items]) => {
        let label: string;
        if (key === todayStr) label = t("today");
        else if (key === yesterdayStr) label = t("yesterday");
        else {
          const d = new Date(key);
          label = d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
        }
        return { label, items };
      });
  }, [readings, t]);

  return (
    <View style={styles.container}>
      <AppHeader />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1A6FA8" />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Title */}
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>{patientName}</Text>
              <Text style={styles.screenSub}>{t("trackReadingsTime")}</Text>
            </View>
          </View>

          {/* Trend Chart */}
          {readings.length >= 2 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart-outline" size={18} color="#1A6FA8" />
                <Text style={styles.cardTitle}>{t("glucoseTrend")}</Text>
              </View>
              <GlucoseTrendChart readings={readings} width={SCREEN_WIDTH - 80} />
            </View>
          )}

          {/* History grouped by date */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={18} color="#1A6FA8" />
              <Text style={styles.cardTitle}>{t("readingHistory")}</Text>
            </View>

            {grouped.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={30} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{t("noReadingsYet")}</Text>
              </View>
            ) : (
              grouped.map(({ label, items }) => {
                const stats = dayStats(items);
                return (
                  <View key={label} style={styles.dateGroup}>
                    {/* Date header */}
                    <View style={styles.dateLabelRow}>
                      <View style={styles.dateLabelLine} />
                      <Text style={styles.dateLabelText}>{label}</Text>
                      <View style={styles.dateLabelLine} />
                      <View style={styles.dateCountBadge}>
                        <Text style={styles.dateCountText}>{items.length}</Text>
                      </View>
                    </View>

                    {/* Per-day stats */}
                    {stats && (
                      <View style={styles.dayStatsRow}>
                        <View style={styles.dayStatItem}>
                          <Text style={styles.dayStatLabel}>{t("average")}</Text>
                          <Text style={styles.dayStatValue}>{stats.avg}</Text>
                        </View>
                        <View style={styles.dayStatDivider} />
                        <View style={styles.dayStatItem}>
                          <Text style={styles.dayStatLabel}>{t("min")}</Text>
                          <Text style={[styles.dayStatValue, { color: getStatusColor(stats.min) }]}>{stats.min}</Text>
                        </View>
                        <View style={styles.dayStatDivider} />
                        <View style={styles.dayStatItem}>
                          <Text style={styles.dayStatLabel}>{t("max")}</Text>
                          <Text style={[styles.dayStatValue, { color: "#D32F2F" }]}>{stats.max}</Text>
                        </View>
                      </View>
                    )}

                    {/* Readings */}
                    {items.map((item: any, idx: number) => {
                      const value = Number(item?.value || 0);
                      const color = getStatusColor(value);
                      const bg    = getStatusBg(value);
                      const raw   = item?.measuredAt || item?.timestamp || item?.createdAt || "";
                      const status = value < 70 ? t("low") : value > 180 ? t("high") : t("normal");
                      return (
                        <View key={item?.id || idx} style={styles.readingRow}>
                          <View style={[styles.readingIndicator, { backgroundColor: color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.readingValue}>
                              {value}{" "}
                              <Text style={styles.readingUnit}>{t("mgdL")}</Text>
                            </Text>
                            <Text style={styles.readingTime}>{formatTime(raw)}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                            <Text style={[styles.statusText, { color }]}>{status}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },
  loader: { marginTop: 60 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  heroRow: {
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  screenTitle: { color: "#0B1A2E", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  screenSub: { color: "#4A6480", fontSize: 14 },

  errorBox: {
    margin: 24,
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B1A2E" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: "700", color: "#0B1A2E" },

  dateGroup: { marginBottom: 20 },
  dateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  dateLabelLine: { flex: 1, height: 1, backgroundColor: "#D6E8F5" },
  dateLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A6FA8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dateCountBadge: {
    backgroundColor: "#EBF3FA",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dateCountText: { fontSize: 11, fontWeight: "700", color: "#1A6FA8" },

  dayStatsRow: {
    flexDirection: "row",
    backgroundColor: "#EBF3FA",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dayStatItem: { flex: 1, alignItems: "center" },
  dayStatLabel: { fontSize: 11, color: "#4A6480", marginBottom: 2 },
  dayStatValue: { fontSize: 15, fontWeight: "700", color: "#0B1A2E" },
  dayStatDivider: { width: 1, backgroundColor: "#B8D0E8", marginVertical: 4 },

  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F9FD",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  readingIndicator: { width: 4, height: 36, borderRadius: 4 },
  readingValue: { fontSize: 18, fontWeight: "700", color: "#0B1A2E", marginBottom: 2 },
  readingUnit: { fontSize: 12, fontWeight: "400", color: "#4A6480" },
  readingTime: { fontSize: 12, color: "#7A96B0" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "700" },
});
