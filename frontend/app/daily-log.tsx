import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { getLogsByDate, deleteMeal, deleteActivity, deleteSleep } from "@/services/api";

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftDay = (dateStr: string, delta: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalDateStr(new Date(y, m - 1, d + delta));
};

const MEAL_COLOR    = "#EA580C";
const MEAL_BG       = "#FFF7ED";
const ACT_COLOR     = "#0D9E6E";
const ACT_BG        = "#ECFDF5";
const SLEEP_COLOR   = "#7C3AED";
const SLEEP_BG      = "#F5F3FF";

function formatTime(raw: string) {
  if (!raw) return "--";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getTimestamp(item: any) {
  const raw = item?.timestamp || item?.createdAt || item?.measuredAt || "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function DailyLogScreen() {
  const { t } = useTranslation();
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState<{ id: string; type: "meal" | "activity" | "sleep" } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isToday = selectedDate === todayStr;
  const canNext = selectedDate < todayStr;

  const loadDailyLogs = async (date: string) => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getLogsByDate(date);
      setLogs(data || {});
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to load daily logs");
      setLogs({});
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadDailyLogs(selectedDate); }, [selectedDate]));

  const meals      = Array.isArray(logs?.meals)      ? logs.meals      : [];
  const activities = Array.isArray(logs?.activities) ? logs.activities : [];
  const sleepLogs  = Array.isArray(logs?.sleep)      ? logs.sleep      : logs?.sleep ? [logs.sleep] : [];

  const totalCarbs   = meals.reduce((s: number, m: any) => s + Number(m?.carbs || 0), 0);
  const totalMinutes = activities.reduce((s: number, a: any) => s + Number(a?.duration_minutes || 0), 0);
  const totalSleep   = sleepLogs.reduce((s: number, sl: any) => s + Number(sl?.sleep_hours || 0), 0);

  const timeline = useMemo(() => {
    const items: any[] = [
      ...meals.map((m: any) => ({ ...m, _type: "meal" })),
      ...activities.map((a: any) => ({ ...a, _type: "activity" })),
      ...sleepLogs.map((s: any) => ({ ...s, _type: "sleep" })),
    ];
    return items.sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [meals, activities, sleepLogs]);

  const selectedLabel = (() => {
    if (isToday) return t("today");
    const yesterday = shiftDay(todayStr, -1);
    if (selectedDate === yesterday) return t("yesterday");
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  })();

  const confirmDelete = async () => {
    if (!confirmItem) return;
    const { id, type } = confirmItem;
    try {
      setDeletingId(id);
      setConfirmItem(null);
      if (type === "meal") await deleteMeal(id);
      else if (type === "activity") await deleteActivity(id);
      else await deleteSleep(id);
      await loadDailyLogs(selectedDate);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteTitle = confirmItem?.type === "meal"
    ? t("deleteMeal")
    : confirmItem?.type === "activity"
    ? t("deleteActivity")
    : t("deleteSleep");

  const deleteMsg = confirmItem?.type === "meal"
    ? t("deleteMealConfirm")
    : confirmItem?.type === "activity"
    ? t("deleteActivityConfirm")
    : t("deleteSleepConfirm");

  const FAB_ACTIONS = [
    { label: t("addMeal"),     icon: "restaurant-outline", color: MEAL_COLOR,  bg: MEAL_BG,  route: "/add-meal"      },
    { label: t("addActivity"), icon: "walk-outline",       color: ACT_COLOR,   bg: ACT_BG,   route: "/add-activity"  },
    { label: t("addSleep"),    icon: "moon-outline",       color: SLEEP_COLOR, bg: SLEEP_BG, route: "/add-sleep"     },
  ];

  return (
    <View style={styles.container}>
      <AppHeader />

      {/* Delete Confirmation Modal */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trash-outline" size={28} color="#D32F2F" />
            </View>
            <Text style={styles.modalTitle}>{deleteTitle}</Text>
            <Text style={styles.modalMsg}>{deleteMsg}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmItem(null)}>
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>{t("delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("dailyLog")}</Text>
        </View>

        {/* Day Navigator */}
        <View style={styles.dayNav}>
          <Pressable style={styles.navArrow} onPress={() => setSelectedDate(shiftDay(selectedDate, -1))}>
            <Ionicons name="chevron-back" size={20} color="#1A6FA8" />
          </Pressable>
          <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
          <Pressable
            style={[styles.navArrow, !canNext && { opacity: 0.3 }]}
            onPress={() => canNext && setSelectedDate(shiftDay(selectedDate, 1))}
            disabled={!canNext}
          >
            <Ionicons name="chevron-forward" size={20} color="#1A6FA8" />
          </Pressable>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Summary pills */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: MEAL_BG }]}>
            <Ionicons name="restaurant-outline" size={15} color={MEAL_COLOR} />
            <Text style={[styles.summaryVal, { color: MEAL_COLOR }]}>{loading ? "--" : totalCarbs}</Text>
            <Text style={[styles.summaryUnit, { color: MEAL_COLOR }]}>{t("carbsUnit")}</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: ACT_BG }]}>
            <Ionicons name="walk-outline" size={15} color={ACT_COLOR} />
            <Text style={[styles.summaryVal, { color: ACT_COLOR }]}>{loading ? "--" : totalMinutes}</Text>
            <Text style={[styles.summaryUnit, { color: ACT_COLOR }]}>{t("minUnit")}</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: SLEEP_BG }]}>
            <Ionicons name="moon-outline" size={15} color={SLEEP_COLOR} />
            <Text style={[styles.summaryVal, { color: SLEEP_COLOR }]}>{loading ? "--" : totalSleep || "--"}</Text>
            <Text style={[styles.summaryUnit, { color: SLEEP_COLOR }]}>{t("hoursUnit")}</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineWrap}>
          <Text style={styles.sectionLabel}>{t("todaysSummary")}</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#1A6FA8" style={{ marginTop: 32 }} />
          ) : timeline.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={44} color="#B8D0E8" />
              <Text style={styles.emptyTitle}>{t("noLogsToday")}</Text>
              <Text style={styles.emptySub}>{t("tapPlusToAdd")}</Text>
            </View>
          ) : (
            timeline.map((item, idx) => {
              const isMeal  = item._type === "meal";
              const isAct   = item._type === "activity";
              const color   = isMeal ? MEAL_COLOR : isAct ? ACT_COLOR : SLEEP_COLOR;
              const bg      = isMeal ? MEAL_BG    : isAct ? ACT_BG    : SLEEP_BG;
              const icon    = isMeal ? "restaurant-outline" : isAct ? "walk-outline" : "moon-outline";
              const title   = isMeal
                ? (item?.foods || item?.name || t("meal"))
                : isAct
                ? (item?.type || t("activity"))
                : `${item?.sleep_hours || 0} ${t("hoursUnit")}`;
              const sub     = isMeal
                ? `${item?.meal_type ? t(item.meal_type) + " · " : ""}${item?.carbs || 0} ${t("carbsUnit")}`
                : isAct
                ? `${item?.duration_minutes || 0} ${t("minUnit")}`
                : (item?.notes || "");
              const time    = formatTime(item?.timestamp || item?.createdAt);
              const isLast  = idx === timeline.length - 1;

              return (
                <View key={item?.id || item?._id || idx} style={styles.timelineItem}>
                  {/* Line */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: color }]}>
                      <Ionicons name={icon as any} size={14} color="#fff" />
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Card */}
                  <View style={[styles.timelineCard, { borderLeftColor: color }]}>
                    <View style={styles.timelineCardTop}>
                      <Text style={styles.timelineTitle}>{title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={[styles.timeBadge, { backgroundColor: bg }]}>
                          <Text style={[styles.timeBadgeText, { color }]}>{time}</Text>
                        </View>
                        <Pressable
                          onPress={() => setConfirmItem({ id: item.id, type: item._type as "meal" | "activity" | "sleep" })}
                          disabled={deletingId === item.id}
                          style={styles.deleteBtn}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={deletingId === item.id ? "#B8D0E8" : "#94A3B8"}
                          />
                        </Pressable>
                      </View>
                    </View>
                    {!!sub && <Text style={styles.timelineSub}>{sub}</Text>}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setFabOpen(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* FAB Modal */}
      <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={() => setFabOpen(false)}>
        <Pressable style={styles.fabBackdrop} onPress={() => setFabOpen(false)}>
          <View style={styles.fabSheet}>
            <Text style={styles.fabSheetTitle}>{t("quickAdd")}</Text>
            {FAB_ACTIONS.map(({ label, icon, color, bg, route }) => (
              <Pressable
                key={route}
                style={styles.fabAction}
                onPress={() => { setFabOpen(false); router.push(route as any); }}
              >
                <View style={[styles.fabActionIcon, { backgroundColor: bg }]}>
                  <Ionicons name={icon as any} size={22} color={color} />
                </View>
                <Text style={styles.fabActionLabel}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  hero: { marginTop: 20, marginBottom: 12 },
  screenTitle: { color: "#0B1A2E", fontSize: 28, fontWeight: "700" },

  dayNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 14,
    borderWidth: 1, borderColor: "#D6E8F5",
    paddingVertical: 10, paddingHorizontal: 8,
    marginBottom: 20,
  },
  navArrow: { padding: 6 },
  dayNavLabel: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#0B1A2E" },

  errorBox: {
    marginBottom: 16, backgroundColor: "#FDEDED",
    borderWidth: 1, borderColor: "#F5C2C2", borderRadius: 14, padding: 12,
  },
  errorText: { color: "#B91C1C", fontSize: 13, fontWeight: "500" },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  summaryPill: {
    flex: 1, borderRadius: 14, paddingVertical: 12,
    alignItems: "center", gap: 4,
  },
  summaryVal: { fontSize: 18, fontWeight: "800" },
  summaryUnit: { fontSize: 10, fontWeight: "600" },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#4A6480",
    letterSpacing: 1, marginBottom: 20, textTransform: "uppercase",
  },

  timelineWrap: { flex: 1 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0B1A2E" },
  emptySub: { fontSize: 13, color: "#4A6480" },

  timelineItem: { flexDirection: "row", marginBottom: 0 },

  timelineLeft: { width: 40, alignItems: "center" },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    zIndex: 1,
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#D6E8F5", marginVertical: 4 },

  timelineCard: {
    flex: 1, marginLeft: 12, marginBottom: 16,
    backgroundColor: "#FFFFFF", borderRadius: 16,
    borderLeftWidth: 3, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  timelineCardTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  timelineTitle: { fontSize: 15, fontWeight: "700", color: "#0B1A2E", flex: 1, marginRight: 8 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timeBadgeText: { fontSize: 11, fontWeight: "700" },
  timelineSub: { fontSize: 12, color: "#4A6480" },

  fab: {
    position: "absolute", bottom: 32, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#1A6FA8",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#1A6FA8", shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  fabBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  fabSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 4,
  },
  fabSheetTitle: {
    fontSize: 18, fontWeight: "700", color: "#0B1A2E", marginBottom: 16,
  },
  fabAction: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#EBF3FA",
  },
  fabActionIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  fabActionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0B1A2E" },

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
  deleteBtn: { padding: 4, alignItems: "center", justifyContent: "center" },
});
