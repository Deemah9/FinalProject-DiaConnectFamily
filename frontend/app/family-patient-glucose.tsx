import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import GlucoseTrendChart from "@/src/components/GlucoseTrendChart";
import { getPatientAlerts, getPatientDailyLogs, getPatientGlucose, getPatientPrediction, viewWithCode } from "@/services/api";

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
  const { t, i18n } = useTranslation();
  const { patientId, patientName, familyCode } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    familyCode?: string;
  }>();

  const [activeTab, setActiveTab] = useState<"glucose" | "logs" | "alerts">("glucose");
  const [readings, setReadings] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<{ meals: any[]; activities: any[]; sleep: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [patientId])
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      // Always fetch glucose (works for both code-based and authenticated)
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

      // Daily logs only available for authenticated (linked) family members
      if (!familyCode && patientId) {
        try {
          const logs = await getPatientDailyLogs(patientId);
          setDailyLogs(logs);
        } catch {
          setDailyLogs({ meals: [], activities: [], sleep: [] });
        }
        loadPrediction();
        loadAlerts();
      }
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const loadPrediction = async () => {
    if (!patientId) return;
    try {
      setLoadingPrediction(true);
      const data = await getPatientPrediction(patientId, 1, i18n.language);
      setPrediction(data);
    } catch {
      setPrediction(null);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const loadAlerts = async () => {
    if (!patientId) return;
    try {
      setLoadingAlerts(true);
      const data = await getPatientAlerts(patientId, 20);
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    } finally {
      setLoadingAlerts(false);
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

  const hasLogs =
    (dailyLogs?.meals?.length ?? 0) +
    (dailyLogs?.activities?.length ?? 0) +
    (dailyLogs?.sleep?.length ?? 0) > 0;

  const formatLogTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

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

          {/* AI Prediction Card — only for authenticated family members */}
          {!familyCode && (
            <View style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <Ionicons name="analytics-outline" size={18} color="#1A6FA8" />
                <Text style={styles.predictionTitle}>{t("predictionTitle")}</Text>
              </View>

              {loadingPrediction ? (
                <Text style={styles.predictionMuted}>{t("predictionLoading")}</Text>
              ) : prediction?.message ? (
                <Text style={styles.predictionMuted}>{prediction.message}</Text>
              ) : prediction?.predicted_value != null ? (
                <>
                  <View style={styles.predictionRow}>
                    <Text style={styles.predictionValue}>
                      {Math.round(prediction.predicted_value)}
                      <Text style={styles.predictionUnit}> {t("mgdL")}</Text>
                    </Text>
                    {prediction.alert_type === "patch_error" ? (
                      <View style={[styles.trendBadge, { backgroundColor: "#FEF3C7" }]}>
                        <Ionicons name="warning" size={15} color="#D97706" />
                        <Text style={[styles.trendBadgeText, { color: "#92400E" }]}>{t("alert_patch_error_short")}</Text>
                      </View>
                    ) : prediction.trend ? (
                      <View style={[
                        styles.trendBadge,
                        prediction.trend === "rising"  ? { backgroundColor: "#FEE2E2" } :
                        prediction.trend === "falling" ? { backgroundColor: "#FEF3C7" } :
                                                         { backgroundColor: "#D1FAE5" },
                      ]}>
                        <Ionicons
                          name={prediction.trend === "rising" ? "trending-up" : prediction.trend === "falling" ? "trending-down" : "remove"}
                          size={15}
                          color={prediction.trend === "rising" ? "#DC2626" : prediction.trend === "falling" ? "#D97706" : "#059669"}
                        />
                        <Text style={[
                          styles.trendBadgeText,
                          prediction.trend === "rising"  ? { color: "#DC2626" } :
                          prediction.trend === "falling" ? { color: "#D97706" } :
                                                           { color: "#059669" },
                        ]}>
                          {t(`trend_${prediction.trend}`)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {prediction.alert_type && (
                    <View style={[
                      styles.adviceBox,
                      prediction.alert_type === "low"         && { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
                      prediction.alert_type === "high"        && { backgroundColor: "#FDEDED", borderColor: "#FECACA" },
                      prediction.alert_type === "patch_error" && { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
                    ]}>
                      <Ionicons
                        name={prediction.alert_type === "patch_error" ? "warning" : "people"}
                        size={16}
                        color={prediction.alert_type === "low" ? "#E07B00" : prediction.alert_type === "high" ? "#D32F2F" : "#6B7280"}
                      />
                      <Text style={[
                        styles.adviceText,
                        prediction.alert_type === "low"         && { color: "#92400E" },
                        prediction.alert_type === "high"        && { color: "#991B1B" },
                        prediction.alert_type === "patch_error" && { color: "#374151" },
                      ]}>
                        {prediction.advice?.family || t(`alert_${prediction.alert_type}`)}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.predictionMuted}>{t("predictionUnavailable")}</Text>
              )}
            </View>
          )}

          {/* Tab switcher — only show daily logs tab for authenticated family members */}
          {!familyCode && (
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabBtn, activeTab === "glucose" && styles.tabBtnActive]}
                onPress={() => setActiveTab("glucose")}
              >
                <Ionicons
                  name="pulse-outline"
                  size={14}
                  color={activeTab === "glucose" ? "#1A6FA8" : "#7A96B0"}
                />
                <Text style={[styles.tabText, activeTab === "glucose" && styles.tabTextActive]}>
                  {t("glucoseTab")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === "logs" && styles.tabBtnActive]}
                onPress={() => setActiveTab("logs")}
              >
                <Ionicons
                  name="receipt-outline"
                  size={14}
                  color={activeTab === "logs" ? "#1A6FA8" : "#7A96B0"}
                />
                <Text style={[styles.tabText, activeTab === "logs" && styles.tabTextActive]}>
                  {t("dailyLogsTab")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === "alerts" && styles.tabBtnActive]}
                onPress={() => setActiveTab("alerts")}
              >
                <Ionicons
                  name="notifications-outline"
                  size={14}
                  color={activeTab === "alerts" ? "#1A6FA8" : "#7A96B0"}
                />
                <Text style={[styles.tabText, activeTab === "alerts" && styles.tabTextActive]}>
                  {t("glucoseAlerts")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── GLUCOSE TAB ── */}
          {(activeTab === "glucose" || !!familyCode) && (
            <>
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
                        <View style={styles.dateLabelRow}>
                          <View style={styles.dateLabelLine} />
                          <Text style={styles.dateLabelText}>{label}</Text>
                          <View style={styles.dateLabelLine} />
                          <View style={styles.dateCountBadge}>
                            <Text style={styles.dateCountText}>{items.length}</Text>
                          </View>
                        </View>

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

                        {items.map((item: any, idx: number) => {
                          const value = Number(item?.value || 0);
                          const color = getStatusColor(value);
                          const bg    = getStatusBg(value);
                          const raw   = item?.measuredAt || item?.timestamp || item?.createdAt || "";
                          const statusLabel = value < 70 ? t("low") : value > 180 ? t("high") : t("normal");
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
                                <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}

          {/* ── DAILY LOGS TAB ── */}
          {activeTab === "logs" && !familyCode && (
            <>
              {!hasLogs ? (
                <View style={styles.card}>
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>{t("noLogsThisWeek")}</Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* Meals */}
                  {(dailyLogs?.meals?.length ?? 0) > 0 && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Ionicons name="restaurant-outline" size={18} color="#F59E0B" />
                        <Text style={styles.cardTitle}>{t("meals")}</Text>
                        <View style={styles.countPill}>
                          <Text style={styles.countPillText}>{dailyLogs!.meals.length}</Text>
                        </View>
                      </View>
                      {dailyLogs!.meals.map((m: any, i: number) => (
                        <View key={m.id || i} style={styles.logRow}>
                          <View style={[styles.logDot, { backgroundColor: "#F59E0B" }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.logPrimary}>
                              {m.foods || t("meal")}
                              {m.carbs != null && (
                                <Text style={styles.logMeta}>{"  "}{m.carbs}{t("carbsUnit")} {t("carbs")}</Text>
                              )}
                            </Text>
                            <Text style={styles.logTime}>{formatLogTime(m.timestamp)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Activities */}
                  {(dailyLogs?.activities?.length ?? 0) > 0 && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Ionicons name="walk-outline" size={18} color="#10B981" />
                        <Text style={styles.cardTitle}>{t("activity")}</Text>
                        <View style={[styles.countPill, { backgroundColor: "#ECFDF5" }]}>
                          <Text style={[styles.countPillText, { color: "#10B981" }]}>{dailyLogs!.activities.length}</Text>
                        </View>
                      </View>
                      {dailyLogs!.activities.map((a: any, i: number) => (
                        <View key={a.id || i} style={styles.logRow}>
                          <View style={[styles.logDot, { backgroundColor: "#10B981" }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.logPrimary}>
                              {a.type || t("activity")}
                              {a.duration_minutes != null && (
                                <Text style={styles.logMeta}>
                                  {"  "}{t("minutesDuration", { min: a.duration_minutes })}
                                </Text>
                              )}
                            </Text>
                            <Text style={styles.logTime}>{formatLogTime(a.timestamp)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Sleep */}
                  {(dailyLogs?.sleep?.length ?? 0) > 0 && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Ionicons name="moon-outline" size={18} color="#8B5CF6" />
                        <Text style={styles.cardTitle}>{t("sleep")}</Text>
                        <View style={[styles.countPill, { backgroundColor: "#F5F3FF" }]}>
                          <Text style={[styles.countPillText, { color: "#8B5CF6" }]}>{dailyLogs!.sleep.length}</Text>
                        </View>
                      </View>
                      {dailyLogs!.sleep.map((s: any, i: number) => (
                        <View key={s.id || i} style={styles.logRow}>
                          <View style={[styles.logDot, { backgroundColor: "#8B5CF6" }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.logPrimary}>
                              {t("hoursSlept", { hours: s.sleep_hours })}
                              {s.notes && (
                                <Text style={styles.logMeta}>{"  "}{s.notes}</Text>
                              )}
                            </Text>
                            <Text style={styles.logTime}>{formatLogTime(s.timestamp)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* ── ALERTS TAB ── */}
          {activeTab === "alerts" && !familyCode && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="notifications-outline" size={18} color="#1A6FA8" />
                <Text style={styles.cardTitle}>{t("glucoseAlerts")}</Text>
              </View>

              {loadingAlerts ? (
                <ActivityIndicator size="small" color="#1A6FA8" style={{ marginVertical: 16 }} />
              ) : alerts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={30} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>{t("noAlerts")}</Text>
                  <Text style={{ color: "#7A96B0", fontSize: 13, marginTop: 4 }}>{t("noAlertsSub")}</Text>
                </View>
              ) : (
                alerts.map((alert: any, idx: number) => {
                  const isHigh = alert.type === "high";
                  const color = isHigh ? "#D32F2F" : "#E07B00";
                  const bg    = isHigh ? "#FDEDED" : "#FEF3E2";
                  const label = isHigh ? t("highGlucose") : t("lowGlucose");
                  const raw   = alert.createdAt || "";
                  const time  = raw ? new Date(raw).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "--";
                  return (
                    <View key={alert.id || idx} style={[styles.alertRow, { backgroundColor: bg }]}>
                      <Ionicons
                        name={isHigh ? "arrow-up-circle" : "arrow-down-circle"}
                        size={22}
                        color={color}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.alertLabel, { color }]}>{label}</Text>
                        <Text style={styles.alertValue}>
                          {alert.value} <Text style={styles.alertUnit}>{t("mgdL")}</Text>
                        </Text>
                      </View>
                      <Text style={styles.alertTime}>{time}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

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

  // Tab switcher
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#EBF3FA",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: "#7A96B0" },
  tabTextActive: { color: "#1A6FA8" },

  // Daily logs
  countPill: {
    marginLeft: "auto" as any,
    backgroundColor: "#FEF3C7",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countPillText: { fontSize: 11, fontWeight: "700", color: "#D97706" },

  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EBF3FA",
  },
  logDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  logPrimary: { fontSize: 14, fontWeight: "600", color: "#0B1A2E" },
  logMeta: { fontSize: 13, fontWeight: "400", color: "#7A96B0" },
  logTime: { fontSize: 12, color: "#7A96B0", marginTop: 2 },
  predictionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  predictionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  predictionTitle: { fontSize: 14, fontWeight: "600", color: "#1A6FA8" },
  predictionMuted: { fontSize: 13, color: "#7A96B0", textAlign: "center", paddingVertical: 6 },
  predictionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  predictionValue: { fontSize: 36, fontWeight: "700", color: "#0B1A2E" },
  predictionUnit: { fontSize: 13, color: "#7A96B0", fontWeight: "400" },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  trendBadgeText: { fontSize: 12, fontWeight: "600" },
  adviceBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 10, borderWidth: 1 },
  adviceText: { fontSize: 13, flex: 1, lineHeight: 19 },

  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  alertLabel: { fontSize: 13, fontWeight: "700" },
  alertValue: { fontSize: 17, fontWeight: "700", color: "#0B1A2E", marginTop: 2 },
  alertUnit: { fontSize: 12, fontWeight: "400", color: "#7A96B0" },
  alertTime: { fontSize: 11, color: "#7A96B0", textAlign: "right" },
});
