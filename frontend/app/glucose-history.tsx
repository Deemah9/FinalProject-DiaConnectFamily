import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppHeader from "@/src/components/AppHeader";
import { getGlucoseReadings, deleteGlucose } from "@/services/api";

export default function GlucoseHistoryScreen() {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parseDate = (item: any) => {
    const raw = item?.measuredAt || item?.timestamp || item?.createdAt;
    if (!raw) return 0;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return 0;
    return d.getTime();
  };

  const loadReadings = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getGlucoseReadings();
      let result: any[] = [];
      if (Array.isArray(data)) result = data;
      else if (Array.isArray(data?.items)) result = data.items;
      else if (Array.isArray(data?.readings)) result = data.readings;
      const sorted = [...result]
        .filter((g) => Number(g?.value) > 0 && parseDate(g) > 0)
        .sort((a, b) => parseDate(b) - parseDate(a));
      setReadings(sorted);
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to load glucose history");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadReadings(); }, []));

  const handleDelete = (id: string) => {
    Alert.alert(
      t("deleteReading"),
      t("deleteReadingConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(id);
              await deleteGlucose(id);
              setReadings((prev) => prev.filter((r) => r.id !== id));
            } catch (e: any) {
              setErrorMsg(e?.message || "Failed to delete reading");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatus = (value: number) => {
    if (value < 70) return t("low");
    if (value > 180) return t("high");
    return t("normal");
  };

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

  const formatTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  // Group readings by calendar day
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of readings) {
      const raw = item?.measuredAt || item?.timestamp || item?.createdAt || "";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toDateString(); // "Mon Apr 07 2026"
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
<ScrollView contentContainerStyle={styles.content}>

        {/* Title row */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("glucoseHistory")}</Text>
            <Text style={styles.screenSub}>{t("trackReadingsTime")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={styles.statsBtn}
              onPress={() => router.push("/glucose-stats" as any)}
            >
              <Ionicons name="bar-chart-outline" size={16} color="#1A6FA8" />
              <Text style={styles.statsBtnText}>{t("stats")}</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={() => router.push("/add-glucose" as any)}>
              <Ionicons name="add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t("add")}</Text>
            </Pressable>
          </View>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* History grouped by date */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color="#1A6FA8" />
            <Text style={styles.cardTitle}>{t("readingHistory")}</Text>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>{t("loadingReadings")}</Text>
          ) : grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={30} color="#94A3B8" />
              <Text style={styles.emptyTitle}>{t("noReadingsYet")}</Text>
              <Text style={styles.emptySub}>{t("addFirstReading")}</Text>
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
                      <Text style={[styles.dayStatValue, { color: stats.min < 70 ? "#E07B00" : stats.min <= 180 ? "#0D9E6E" : "#D32F2F" }]}>{stats.min}</Text>
                    </View>
                    <View style={styles.dayStatDivider} />
                    <View style={styles.dayStatItem}>
                      <Text style={styles.dayStatLabel}>{t("max")}</Text>
                      <Text style={[styles.dayStatValue, { color: "#D32F2F" }]}>{stats.max}</Text>
                    </View>
                  </View>
                )}

                {/* Readings for that day */}
                {items.map((item, idx) => {
                  const value = Number(item?.value || 0);
                  const status = getStatus(value);
                  const color = getStatusColor(value);
                  const bg = getStatusBg(value);
                  const raw = item?.measuredAt || item?.timestamp || item?.createdAt || "";
                  return (
                    <View key={item?.id || item?._id || idx} style={styles.readingRow}>
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
                      <Pressable
                        onPress={() => handleDelete(item?.id)}
                        disabled={deletingId === item?.id}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={deletingId === item?.id ? "#B8D0E8" : "#94A3B8"}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );})
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    backgroundColor: "#1A6FA8",
  },
  menuBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  placeholder: { width: 40 },
  logoWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  logoTitle: { color: "#FFFFFF", fontSize: 16, lineHeight: 18, fontWeight: "600" },
  logoSub: { color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 16, fontWeight: "300" },

  heroRow: {
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  screenTitle: { color: "#0B1A2E", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  screenSub: { color: "#4A6480", fontSize: 14 },
  statsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E8F5",
  },
  statsBtnText: { color: "#1A6FA8", fontSize: 14, fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#1A6FA8",
  },
  addBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  errorBox: {
    marginBottom: 16,
    backgroundColor: "#FDEDED",
    borderWidth: 1,
    borderColor: "#F5C2C2",
    borderRadius: 14,
    padding: 12,
  },
  errorText: { color: "#B91C1C", fontSize: 13, fontWeight: "500" },

  // Per-day stats bar
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

  loadingText: { fontSize: 14, color: "#4A6480" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: "700", color: "#0B1A2E" },
  emptySub: { marginTop: 6, fontSize: 12, color: "#4A6480" },

  // Date group
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

  // Reading row
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
  deleteBtn: {
    marginLeft: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
