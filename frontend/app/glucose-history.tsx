import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppHeader from "@/src/components/AppHeader";
import { getGlucoseReadings, deleteGlucose } from "@/services/api";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftDay = (dateStr: string, delta: number) => {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day + delta);
  return toLocalDateStr(d);
};

export default function GlucoseHistoryScreen() {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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

  // Group by local date
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of readings) {
      const raw = item?.measuredAt || item?.timestamp || item?.createdAt || "";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = toLocalDateStr(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [readings]);

  const allDates = useMemo(() => grouped.map(([dateStr]) => dateStr), [grouped]);

  useEffect(() => {
    if (allDates.length > 0 && !selectedDateStr) {
      setSelectedDateStr(allDates[0]);
    }
  }, [allDates]);

  useEffect(() => { setShowAll(false); }, [selectedDateStr]);

  const selectedLabel = useMemo(() => {
    if (!selectedDateStr) return "";
    const todayStr = toLocalDateStr(new Date());
    const yesterdayStr = toLocalDateStr(new Date(Date.now() - 86_400_000));
    if (selectedDateStr === todayStr) return t("today");
    if (selectedDateStr === yesterdayStr) return t("yesterday");
    const [y, m, day] = selectedDateStr.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }, [selectedDateStr, t]);

  const dayReadings = useMemo(() => {
    if (!selectedDateStr) return [];
    return grouped.find(([d]) => d === selectedDateStr)?.[1] ?? [];
  }, [selectedDateStr, grouped]);

  const stats = useMemo(() => {
    const vals = dayReadings.map((r) => Number(r?.value || 0)).filter(Boolean);
    if (!vals.length) return null;
    return {
      avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [dayReadings]);

  const todayStr = toLocalDateStr(new Date());
  const canPrev = !!selectedDateStr;
  const canNext = selectedDateStr ? selectedDateStr < todayStr : false;

  const getStatusColor = (v: number) => v < 70 ? "#E07B00" : v > 180 ? "#D32F2F" : "#0D9E6E";
  const getStatusBg   = (v: number) => v < 70 ? "#FEF3E2" : v > 180 ? "#FDEDED" : "#E6F7F2";
  const getStatus     = (v: number) => v < 70 ? t("low") : v > 180 ? t("high") : t("normal");

  const formatTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleDelete = (id: string) => setConfirmId(id);

  const confirmDelete = async () => {
    if (!confirmId) return;
    try {
      setDeletingId(confirmId);
      setConfirmId(null);
      await deleteGlucose(confirmId);
      setReadings((prev) => prev.filter((r) => r.id !== confirmId));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to delete reading");
    } finally {
      setDeletingId(null);
    }
  };

  const visible = showAll ? dayReadings : dayReadings.slice(0, 5);

  return (
    <View style={styles.container}>
      <AppHeader />

      {/* Delete Confirmation Modal */}
      <Modal visible={!!confirmId} transparent animationType="fade" onRequestClose={() => setConfirmId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trash-outline" size={28} color="#D32F2F" />
            </View>
            <Text style={styles.modalTitle}>{t("deleteReading")}</Text>
            <Text style={styles.modalMsg}>{t("deleteReadingConfirm")}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmId(null)}>
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>{t("delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("glucoseHistory")}</Text>
            <Text style={styles.screenSub}>{t("trackReadingsTime")}</Text>
          </View>
          <Pressable style={styles.statsBtn} onPress={() => router.push("/glucose-stats" as any)}>
            <Ionicons name="bar-chart-outline" size={16} color="#1A6FA8" />
            <Text style={styles.statsBtnText}>{t("stats")}</Text>
          </Pressable>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color="#1A6FA8" />
            <Text style={styles.cardTitle}>{t("readingHistory")}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#1A6FA8" style={{ marginVertical: 16 }} />
          ) : grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={30} color="#94A3B8" />
              <Text style={styles.emptyTitle}>{t("noReadingsYet")}</Text>
              <Text style={styles.emptySub}>{t("addFirstReading")}</Text>
            </View>
          ) : (
            <>
              {/* Day Navigator */}
              <View style={styles.dayNav}>
                <Pressable
                  onPress={() => selectedDateStr && setSelectedDateStr(shiftDay(selectedDateStr, -1))}
                  disabled={!canPrev}
                  style={[styles.navArrow, !canPrev && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-back" size={20} color="#1A6FA8" />
                </Pressable>
                <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
                <Pressable
                  onPress={() => selectedDateStr && setSelectedDateStr(shiftDay(selectedDateStr, 1))}
                  disabled={!canNext}
                  style={[styles.navArrow, !canNext && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-forward" size={20} color="#1A6FA8" />
                </Pressable>
              </View>

              {/* Day Stats */}
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
              {dayReadings.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptySub}>{t("noReadingsThisDay")}</Text>
                </View>
              ) : (
                <>
                  {visible.map((item, idx) => {
                    const value = Number(item?.value || 0);
                    const color = getStatusColor(value);
                    const bg    = getStatusBg(value);
                    const raw   = item?.measuredAt || item?.timestamp || item?.createdAt || "";
                    return (
                      <View key={item?.id || idx} style={styles.readingRow}>
                        <View style={[styles.readingIndicator, { backgroundColor: color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.readingValue}>
                            {value} <Text style={styles.readingUnit}>{t("mgdL")}</Text>
                          </Text>
                          <Text style={styles.readingTime}>{formatTime(raw)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                          <Text style={[styles.statusText, { color }]}>{getStatus(value)}</Text>
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

                  {dayReadings.length > 5 && (
                    <Pressable style={styles.showMoreBtn} onPress={() => setShowAll((v) => !v)}>
                      <Text style={styles.showMoreText}>
                        {showAll ? t("showLess") : t("showMore")}
                      </Text>
                      <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color="#1A6FA8" />
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push("/add-glucose" as any)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  heroRow: {
    marginTop: 28, marginBottom: 20,
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: 12,
  },
  screenTitle: { color: "#0B1A2E", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  screenSub: { color: "#4A6480", fontSize: 14 },
  statsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#D6E8F5",
  },
  statsBtnText: { color: "#1A6FA8", fontSize: 14, fontWeight: "600" },
  fab: {
    position: "absolute", bottom: 32, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#1A6FA8",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#1A6FA8", shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  errorBox: {
    marginBottom: 16, backgroundColor: "#FDEDED",
    borderWidth: 1, borderColor: "#F5C2C2",
    borderRadius: 14, padding: 12,
  },
  errorText: { color: "#B91C1C", fontSize: 13, fontWeight: "500" },

  card: {
    backgroundColor: "#FFFFFF", borderRadius: 24,
    borderWidth: 1, borderColor: "#D6E8F5",
    padding: 20, marginBottom: 18,
    shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B1A2E" },

  dayNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EBF3FA", borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 8,
    marginBottom: 14,
  },
  navArrow: { padding: 6 },
  dayNavLabel: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#0B1A2E" },

  dayStatsRow: {
    flexDirection: "row", backgroundColor: "#F4F9FD",
    borderRadius: 12, paddingVertical: 10, marginBottom: 14,
  },
  dayStatItem: { flex: 1, alignItems: "center" },
  dayStatLabel: { fontSize: 11, color: "#4A6480", marginBottom: 2 },
  dayStatValue: { fontSize: 15, fontWeight: "700", color: "#0B1A2E" },
  dayStatDivider: { width: 1, backgroundColor: "#B8D0E8", marginVertical: 4 },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: "700", color: "#0B1A2E" },
  emptySub: { marginTop: 6, fontSize: 12, color: "#4A6480" },

  readingRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F4F9FD", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, gap: 12,
  },
  readingIndicator: { width: 4, height: 36, borderRadius: 4 },
  readingValue: { fontSize: 18, fontWeight: "700", color: "#0B1A2E", marginBottom: 2 },
  readingUnit: { fontSize: 12, fontWeight: "400", color: "#4A6480" },
  readingTime: { fontSize: 12, color: "#7A96B0" },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "700" },
  deleteBtn: { marginLeft: 4, padding: 4, alignItems: "center", justifyContent: "center" },

  showMoreBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4,
    paddingVertical: 10, marginTop: 4,
  },
  showMoreText: { fontSize: 13, color: "#1A6FA8", fontWeight: "600" },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: "#FFFFFF", borderRadius: 24,
    padding: 24, width: "100%", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#FDEDED", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0B1A2E", marginBottom: 8 },
  modalMsg: { fontSize: 14, color: "#4A6480", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  modalBtns: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: "#D6E8F5",
    alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: "#4A6480" },
  modalDeleteBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: "#D32F2F",
    alignItems: "center", justifyContent: "center",
  },
  modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
