import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import GlucoseTrendChart from "@/src/components/GlucoseTrendChart";
import { getPatientDailyLogs, getPatientGlucose, getPatientPrediction, viewWithCode } from "@/services/api";
import { useAppTheme } from "@/hooks/useAppTheme";

const SCREEN_WIDTH = Dimensions.get("window").width;

const getStatusColor = (value: number) => {
  if (value < 70) return "#E07B00";
  if (value > 170) return "#D32F2F";
  return "#0D9E6E";
};

const getStatusBg = (value: number) => {
  if (value < 70) return "#FEF3E2";
  if (value > 170) return "#FDEDED";
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
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const { patientId, patientName, familyCode } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    familyCode?: string;
  }>();

  const [activeTab, setActiveTab] = useState<"glucose" | "history" | "logs" | "a1c">("glucose");
  const [readings, setReadings] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<{ meals: any[]; activities: any[]; sleep: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [showAllReadings, setShowAllReadings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [patientId])
  );

  useEffect(() => {
    if (!patientId) return;
    loadPrediction();
    const id = setInterval(() => loadPrediction(), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [patientId]);

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
        const d = new Date(key);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        let label: string;
        if (key === todayStr) label = t("today");
        else if (key === yesterdayStr) label = t("yesterday");
        else {
          label = d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
        }
        return { label, dateStr, items };
      });
  }, [readings, t]);

  useEffect(() => {
    if (grouped.length > 0 && !selectedDateStr) {
      setSelectedDateStr(grouped[0].dateStr);
    }
  }, [grouped]);

  useEffect(() => {
    setShowAllReadings(false);
  }, [selectedDateStr]);

  const chartReadings = useMemo(() => {
    if (!selectedDateStr) return readings;
    return grouped.find((g) => g.dateStr === selectedDateStr)?.items ?? [];
  }, [selectedDateStr, grouped, readings]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    grouped.forEach(({ dateStr }) => {
      marks[dateStr] = {
        marked: true,
        dotColor: "#1A6FA8",
        selected: dateStr === selectedDateStr,
        selectedColor: "#1A6FA8",
      };
    });
    return marks;
  }, [grouped, selectedDateStr]);

  const selectedLabel = useMemo(() => {
    if (!selectedDateStr) return "";
    const match = grouped.find((g) => g.dateStr === selectedDateStr);
    if (match) return match.label;
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
    const d = new Date(selectedDateStr);
    if (d.toDateString() === todayStr) return t("today");
    if (d.toDateString() === yesterdayStr) return t("yesterday");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }, [selectedDateStr, grouped, t]);

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

  const hasLogs =
    (dailyLogs?.meals?.length ?? 0) +
    (dailyLogs?.activities?.length ?? 0) +
    (dailyLogs?.sleep?.length ?? 0) > 0;

  const logDays = useMemo(() => {
    const dates = new Set<string>();
    [...(dailyLogs?.meals ?? []), ...(dailyLogs?.activities ?? []), ...(dailyLogs?.sleep ?? [])].forEach((item) => {
      const raw = item?.timestamp || item?.createdAt || "";
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) dates.add(toLocalDateStr(d));
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [dailyLogs]);

  useEffect(() => {
    if (logDays.length > 0 && !selectedLogDate) setSelectedLogDate(logDays[0]);
  }, [logDays]);

  const logsForDay = useMemo(() => {
    if (!selectedLogDate) return { meals: [], activities: [], sleep: [] };
    const inDay = (ts: any) => {
      const d = new Date(ts || "");
      return !Number.isNaN(d.getTime()) && toLocalDateStr(d) === selectedLogDate;
    };
    return {
      meals:      (dailyLogs?.meals      ?? []).filter((m: any) => inDay(m.timestamp)),
      activities: (dailyLogs?.activities ?? []).filter((a: any) => inDay(a.timestamp)),
      sleep:      (dailyLogs?.sleep      ?? []).filter((s: any) => inDay(s.timestamp)),
    };
  }, [selectedLogDate, dailyLogs]);

  const logDayLabel = useMemo(() => {
    if (!selectedLogDate) return "";
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
    const d = new Date(selectedLogDate);
    if (d.toDateString() === todayStr) return t("today");
    if (d.toDateString() === yesterdayStr) return t("yesterday");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }, [selectedLogDate, t]);

  const formatLogTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const patternPP        = prediction?.pattern_prediction;
  const patternRisk      = patternPP?.risk_level ?? "normal";
  const patternRiskColor = patternRisk === "high" ? "#D32F2F" : patternRisk === "low" ? "#D97706" : patternRisk === "variable" ? "#7C3AED" : "#059669";
  const patternRiskBg    = patternRisk === "high" ? "#FEE2E2" : patternRisk === "low" ? "#FFFBEB" : patternRisk === "variable" ? "#F5F3FF" : "#D1FAE5";
  const patternRiskIcon  = patternRisk === "variable" ? "stats-chart" : patternRisk === "normal" ? "checkmark-circle" : "alert-circle";
  const patternRiskLabel = patternRisk === "high" ? t("high") : patternRisk === "low" ? t("low") : patternRisk === "variable" ? t("patternVariabilityUnstable") : t("normal");
  const patternConfLabel = patternPP?.confidence === "high" ? t("patternConfidenceHigh") : patternPP?.confidence === "medium" ? t("patternConfidenceMedium") : t("patternConfidenceLow");
  const patternAvg       = patternPP?.typical_avg ?? 0;
  const patternAdvStyle  = patternAvg > 170
    ? { bg: "#FDEDED", border: "#FECACA", color: "#991B1B", icon: "alert-circle",       iconClr: "#D32F2F" }
    : patternAvg < 70
    ? { bg: "#FFF7ED", border: "#FED7AA", color: "#92400E", icon: "alert-circle",       iconClr: "#E07B00" }
    : { bg: theme.primaryBg, border: theme.border, color: "#1A4A6B", icon: "information-circle", iconClr: "#1A6FA8" };

  const tabBar = !familyCode ? (
    <View style={styles.headerTabs}>
      {([
        { key: "glucose",  icon: "pulse-outline",         label: "glucoseTab" },
        { key: "history",  icon: "time-outline",          label: "readingHistory" },
        { key: "logs",     icon: "receipt-outline",       label: "dailyLogsTab" },
        { key: "a1c",      icon: "analytics-outline",     label: "estimatedA1C" },
      ] as const).map(({ key, icon, label }) => (
        <Pressable
          key={key}
          style={[styles.headerTab, activeTab === key && styles.headerTabActive]}
          onPress={() => setActiveTab(key)}
        >
          <Ionicons name={icon} size={16} color={activeTab === key ? "#1A6FA8" : theme.textLight} />
          <Text style={[styles.headerTabText, activeTab === key && styles.headerTabTextActive]}>
            {t(label)}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : undefined;

  return (
    <View style={styles.container}>
      <AppHeader bottom={tabBar} />

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
              <Text style={styles.screenSub}>
                {activeTab === "glucose"  && t("monitoringPatient", { name: patientName })}
                {activeTab === "history"  && t("patientReadingHistory", { name: patientName })}
                {activeTab === "logs"     && t("patientDailyLogs", { name: patientName })}
                {activeTab === "a1c"      && t("patientA1C", { name: patientName })}
              </Text>
            </View>
          </View>

          {/* AI Prediction Card — only on Glucose tab */}
          {!familyCode && activeTab === "glucose" && (
            <View style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <Ionicons
                  name={prediction?.prediction_mode === "pattern" ? "bar-chart-outline" : "analytics-outline"}
                  size={18} color="#1A6FA8"
                />
                <Text style={styles.predictionTitle}>
                  {prediction?.prediction_mode === "pattern" ? t("patternCardTitle") : t("predictionTitle")}
                </Text>
              </View>

              {loadingPrediction ? (
                <Text style={styles.predictionMuted}>{t("predictionLoading")}</Text>

              ) : prediction?.prediction_mode === "pattern" ? (
                <>
                  {(prediction.family_message || prediction.message) && (
                    <View style={styles.staleRow}>
                      <Ionicons name="time-outline" size={15} color="#D97706" />
                      <Text style={styles.staleText}>{prediction.family_message || prediction.message}</Text>
                    </View>
                  )}
                  {patternPP?.available ? (
                    <>
                      <View style={styles.predictionRow}>
                        <Text style={[styles.predictionValue, {
                          color: patternAvg > 170 ? "#D32F2F" : patternAvg < 70 ? "#D97706" : theme.text,
                        }]}>
                          {patternPP.typical_avg}
                          <Text style={styles.predictionUnit}> {t("mgdL")}</Text>
                        </Text>
                        <View style={[styles.trendBadge, { backgroundColor: patternRiskBg }]}>
                          <Ionicons name={patternRiskIcon as any} size={15} color={patternRiskColor} />
                          <Text style={[styles.trendBadgeText, { color: patternRiskColor }]}>{patternRiskLabel}</Text>
                        </View>
                      </View>
                      {patternPP.typical_min != null && patternPP.typical_max != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <Ionicons name="stats-chart-outline" size={14} color={theme.textMuted} />
                          <Text style={{ fontSize: 13, color: theme.textMuted }}>
                            {t("patternTypical")}{" "}
                            <Text style={{ fontWeight: "700", color: theme.text }}>{patternPP.typical_min} – {patternPP.typical_max}</Text>
                            {" "}{t("mgdL")}
                          </Text>
                        </View>
                      )}
                      {(prediction.advice?.family || patternPP.message) && (
                        <View style={[styles.adviceBox, { backgroundColor: patternAdvStyle.bg, borderColor: patternAdvStyle.border }]}>
                          <Ionicons name={patternAdvStyle.icon as any} size={16} color={patternAdvStyle.iconClr} />
                          <Text style={[styles.adviceText, { color: patternAdvStyle.color }]}>
                            {prediction.advice?.family || patternPP.message}
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                        <Ionicons name="people-outline" size={13} color={theme.textMuted} />
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>
                          {t("patternSamples", { count: patternPP.sample_count })}
                          {"  ·  "}
                          <Text style={{
                            fontWeight: "600",
                            color: patternPP.confidence === "high" ? "#16A34A" : patternPP.confidence === "medium" ? "#D97706" : "#6B7280",
                          }}>{patternConfLabel}</Text>
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.predictionMuted}>{t("patternNoData")}</Text>
                  )}
                </>

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

                  {prediction.probability != null && prediction.trend && prediction.alert_type !== "patch_error" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 2 }}>
                      <Ionicons name="stats-chart-outline" size={14} color={theme.textMuted} />
                      <Text style={{ fontSize: 13, color: theme.textMuted }}>
                        <Text style={{ fontWeight: "700", color: "#1A6FA8" }}>{prediction.probability}%</Text>
                        {"  "}{t(`prob_${prediction.trend}`)}
                      </Text>
                    </View>
                  )}

                  {(prediction.alert_type || prediction.advice?.family) && (
                    <View style={[
                      styles.adviceBox,
                      prediction.alert_type === "low"         && { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
                      prediction.alert_type === "high"        && { backgroundColor: "#FDEDED", borderColor: "#FECACA" },
                      prediction.alert_type === "patch_error" && { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
                      !prediction.alert_type                  && { backgroundColor: theme.primaryBg, borderColor: theme.border },
                    ]}>
                      <Ionicons
                        name={prediction.alert_type === "patch_error" ? "warning" : prediction.alert_type ? "people" : "information-circle"}
                        size={16}
                        color={prediction.alert_type === "low" ? "#E07B00" : prediction.alert_type === "high" ? "#D32F2F" : "#1A6FA8"}
                      />
                      <Text style={[
                        styles.adviceText,
                        prediction.alert_type === "low"         && { color: "#92400E" },
                        prediction.alert_type === "high"        && { color: "#991B1B" },
                        prediction.alert_type === "patch_error" && { color: "#374151" },
                        !prediction.alert_type                  && { color: "#1A4A6B" },
                      ]}>
                        {prediction.advice?.family || (prediction.alert_type ? t(`alert_${prediction.alert_type}`) : "")}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.predictionMuted}>{prediction?.message || t("predictionUnavailable")}</Text>
              )}
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

                  {/* Day picker with arrows */}
                  {(() => {
                    const todayDate = toLocalDateStr(new Date());
                    const canPrev = true;
                    const canNext = !!selectedDateStr && selectedDateStr < todayDate;
                    return (
                      <View style={styles.dayNav}>
                        <Pressable
                          onPress={() => selectedDateStr && setSelectedDateStr(shiftDay(selectedDateStr, -1))}
                          style={[styles.dayNavArrow, !canPrev && { opacity: 0.3 }]}
                          disabled={!canPrev}
                        >
                          <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
                        </Pressable>
                        <View style={styles.dayNavCenter}>
                          <Pressable onPress={() => setShowCalendar(true)}>
                            <Ionicons name="calendar-outline" size={18} color="#1A6FA8" />
                          </Pressable>
                          <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
                        </View>
                        <Pressable
                          onPress={() => selectedDateStr && setSelectedDateStr(shiftDay(selectedDateStr, 1))}
                          style={[styles.dayNavArrow, !canNext && { opacity: 0.3 }]}
                          disabled={!canNext}
                        >
                          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                        </Pressable>
                      </View>
                    );
                  })()}

                  {/* Calendar Modal */}
                  <Modal visible={showCalendar} transparent animationType="fade">
                    <Pressable style={styles.calModalBackdrop} onPress={() => setShowCalendar(false)}>
                      <Pressable style={styles.calModalBox} onPress={(e) => e.stopPropagation()}>
                        <Calendar
                          markedDates={markedDates}
                          onDayPress={(day: any) => {
                            const match = grouped.find((g) => g.dateStr === day.dateString);
                            if (match) {
                              setSelectedDateStr(day.dateString);
                              setShowCalendar(false);
                            }
                          }}
                          theme={{
                            selectedDayBackgroundColor: "#1A6FA8",
                            todayTextColor: "#1A6FA8",
                            arrowColor: "#1A6FA8",
                            dotColor: "#1A6FA8",
                          }}
                        />
                        <Pressable style={styles.calCloseBtn} onPress={() => setShowCalendar(false)}>
                          <Text style={styles.calCloseTxt}>{t("close")}</Text>
                        </Pressable>
                      </Pressable>
                    </Pressable>
                  </Modal>

                  {chartReadings.length >= 2 ? (
                    <GlucoseTrendChart readings={chartReadings} width={SCREEN_WIDTH - 88} />
                  ) : (
                    <View style={styles.emptyChart}>
                      <Ionicons name="analytics-outline" size={36} color={theme.border} />
                      <Text style={styles.emptyChartText}>{t("noReadingsThisDay")}</Text>
                    </View>
                  )}
                </View>
              )}

            </>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && !familyCode && (
            <View style={styles.card}>
              {/* Day navigator */}
              <View style={styles.logDayNav}>
                <Pressable
                  onPress={() => selectedDateStr && setSelectedDateStr(shiftDay(selectedDateStr, -1))}
                  style={styles.dayNavArrow}
                >
                  <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
                </Pressable>
                <View style={styles.dayNavCenter}>
                  <Ionicons name="calendar-outline" size={16} color="#1A6FA8" />
                  <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
                </View>
                <Pressable
                  onPress={() => selectedDateStr && selectedDateStr < toLocalDateStr(new Date()) && setSelectedDateStr(shiftDay(selectedDateStr, 1))}
                  style={[styles.dayNavArrow, selectedDateStr === toLocalDateStr(new Date()) && { opacity: 0.3 }]}
                  disabled={selectedDateStr === toLocalDateStr(new Date())}
                >
                  <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </Pressable>
              </View>

              {chartReadings.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={30} color={theme.inactive} />
                  <Text style={styles.emptyTitle}>{t("noReadingsThisDay")}</Text>
                </View>
              ) : (
                <>
                  {(() => {
                    const stats = dayStats(chartReadings);
                    return stats ? (
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
                    ) : null;
                  })()}
                  {(showAllReadings ? chartReadings : chartReadings.slice(0, 5)).map((item: any, idx: number) => {
                    const value = Number(item?.value || 0);
                    const color = getStatusColor(value);
                    const bg    = getStatusBg(value);
                    const raw   = item?.measuredAt || item?.timestamp || item?.createdAt || "";
                    const statusLabel = value < 70 ? t("low") : value > 170 ? t("high") : t("normal");
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
                          <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                  {chartReadings.length > 5 && (
                    <Pressable style={styles.readMoreBtn} onPress={() => setShowAllReadings(prev => !prev)}>
                      <Text style={styles.readMoreText}>
                        {showAllReadings ? t("showLess") : `${t("showMore")} (${chartReadings.length - 5})`}
                      </Text>
                      <Ionicons name={showAllReadings ? "chevron-up" : "chevron-down"} size={14} color="#1A6FA8" />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}

          {/* ── DAILY LOGS TAB ── */}
          {activeTab === "logs" && !familyCode && (
            <>
              {!hasLogs ? (
                <View style={styles.card}>
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={32} color={theme.inactive} />
                    <Text style={styles.emptyTitle}>{t("noLogsThisWeek")}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.card}>
                    {/* Day navigator inside card */}
                    <View style={styles.logDayNav}>
                      <Pressable
                        onPress={() => selectedLogDate && setSelectedLogDate(shiftDay(selectedLogDate, -1))}
                        style={styles.dayNavArrow}
                      >
                        <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
                      </Pressable>
                      <View style={styles.dayNavCenter}>
                        <Ionicons name="calendar-outline" size={16} color="#1A6FA8" />
                        <Text style={styles.dayNavLabel}>{logDayLabel}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          const todayDate = toLocalDateStr(new Date());
                          if (selectedLogDate && selectedLogDate < todayDate)
                            setSelectedLogDate(shiftDay(selectedLogDate, 1));
                        }}
                        style={[styles.dayNavArrow, selectedLogDate === toLocalDateStr(new Date()) && { opacity: 0.3 }]}
                        disabled={selectedLogDate === toLocalDateStr(new Date())}
                      >
                        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                      </Pressable>
                    </View>

                    {logsForDay.meals.length === 0 && logsForDay.activities.length === 0 && logsForDay.sleep.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={32} color={theme.inactive} />
                        <Text style={styles.emptyTitle}>{t("noLogsThisWeek")}</Text>
                      </View>
                    ) : (
                      <>
                        {/* Meals */}
                        {logsForDay.meals.length > 0 && (
                          <View style={styles.logSection}>
                            <View style={styles.logSectionHeader}>
                              <Ionicons name="restaurant-outline" size={15} color="#F59E0B" />
                              <Text style={styles.logSectionTitle}>{t("meals")}</Text>
                              <View style={styles.countPill}><Text style={styles.countPillText}>{logsForDay.meals.length}</Text></View>
                            </View>
                            {logsForDay.meals.map((m: any, i: number) => (
                              <View key={m.id || i} style={styles.logRow}>
                                <View style={[styles.logDot, { backgroundColor: "#F59E0B" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.logPrimary}>
                                    {m.foods || t("meal")}
                                    {m.carbs != null && <Text style={styles.logMeta}>{"  "}{m.carbs}{t("carbsUnit")} {t("carbs")}</Text>}
                                  </Text>
                                  <Text style={styles.logTime}>
                                    {m.meal_type ? `${t(m.meal_type)}  ·  ` : ""}{formatLogTime(m.timestamp)}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Activities */}
                        {logsForDay.activities.length > 0 && (
                          <View style={styles.logSection}>
                            <View style={styles.logSectionHeader}>
                              <Ionicons name="walk-outline" size={15} color="#10B981" />
                              <Text style={styles.logSectionTitle}>{t("activity")}</Text>
                              <View style={[styles.countPill, { backgroundColor: "#ECFDF5" }]}><Text style={[styles.countPillText, { color: "#10B981" }]}>{logsForDay.activities.length}</Text></View>
                            </View>
                            {logsForDay.activities.map((a: any, i: number) => (
                              <View key={a.id || i} style={styles.logRow}>
                                <View style={[styles.logDot, { backgroundColor: "#10B981" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.logPrimary}>
                                    {a.type || t("activity")}
                                    {a.duration_minutes != null && <Text style={styles.logMeta}>{"  "}{t("minutesDuration", { min: a.duration_minutes })}</Text>}
                                  </Text>
                                  <Text style={styles.logTime}>{formatLogTime(a.timestamp)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Sleep */}
                        {logsForDay.sleep.length > 0 && (
                          <View style={styles.logSection}>
                            <View style={styles.logSectionHeader}>
                              <Ionicons name="moon-outline" size={15} color="#8B5CF6" />
                              <Text style={styles.logSectionTitle}>{t("sleep")}</Text>
                              <View style={[styles.countPill, { backgroundColor: "#F5F3FF" }]}><Text style={[styles.countPillText, { color: "#8B5CF6" }]}>{logsForDay.sleep.length}</Text></View>
                            </View>
                            {logsForDay.sleep.map((s: any, i: number) => (
                              <View key={s.id || i} style={styles.logRow}>
                                <View style={[styles.logDot, { backgroundColor: "#8B5CF6" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.logPrimary}>
                                    {t("hoursSlept", { hours: s.sleep_hours })}
                                    {s.notes && <Text style={styles.logMeta}>{"  "}{s.notes}</Text>}
                                  </Text>
                                  <Text style={styles.logTime}>{formatLogTime(s.timestamp)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {/* ── A1C TAB ── */}
          {activeTab === "a1c" && !familyCode && (() => {
            const vals = readings.map((r) => Number(r?.value || 0)).filter(Boolean);
            if (vals.length === 0) return (
              <View style={styles.card}>
                <View style={styles.emptyState}>
                  <Ionicons name="analytics-outline" size={30} color={theme.inactive} />
                  <Text style={styles.emptyTitle}>{t("noReadings")}</Text>
                </View>
              </View>
            );
            const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
            const a1c = ((avg + 46.7) / 28.7).toFixed(1);
            const a1cNum = parseFloat(a1c);
            const a1cColor = a1cNum >= 8 ? "#D32F2F" : a1cNum >= 6.5 ? "#E07B00" : "#0D9E6E";
            const a1cBg    = a1cNum >= 8 ? "#FDEDED"  : a1cNum >= 6.5 ? "#FEF3E2"  : "#E6F7F2";
            const a1cLabel = a1cNum >= 8 ? t("diabetes") : a1cNum >= 5.7 ? t("preDiabetes") : t("normal");
            const inRange = vals.filter((v) => v >= 70 && v <= 180).length;
            const tir = Math.round((inRange / vals.length) * 100);
            return (
              <View>
                <View style={[styles.card, { backgroundColor: a1cBg, alignItems: "center", paddingVertical: 28 }]}>
                  <Text style={styles.cardTitle}>{t("yourEstimatedA1C")}</Text>
                  <View style={[styles.a1cCircle, { borderColor: a1cColor }]}>
                    <Text style={[styles.a1cValue, { color: a1cColor }]}>{a1c}%</Text>
                  </View>
                  <View style={[styles.a1cBadge, { backgroundColor: a1cColor }]}>
                    <Text style={styles.a1cBadgeText}>{a1cLabel}</Text>
                  </View>
                </View>
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, { backgroundColor: "#DBEAFE", borderWidth: 1, borderColor: "#BFDBFE" }]}>
                    <Text style={styles.statLabel}>{t("average")}</Text>
                    <Text style={[styles.statValue, { color: "#1A6FA8" }]}>{Math.round(avg)}</Text>
                    <Text style={styles.statUnit}>{t("mgdL")}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: "#E6F7F2" }]}>
                    <Text style={styles.statLabel}>{t("timeInRange")}</Text>
                    <Text style={[styles.statValue, { color: "#0D9E6E" }]}>{tir}%</Text>
                    <Text style={styles.statUnit}>{inRange}/{vals.length}</Text>
                  </View>
                </View>
                <Text style={styles.statFooter}>{t("basedOnReadings", { count: vals.length })}</Text>
              </View>
            );
          })()}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  loader: { marginTop: 60 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  heroRow: {
    marginTop: 12,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  screenTitle: { color: theme.text, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  screenSub: { color: theme.textMuted, fontSize: 14 },

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
    backgroundColor: theme.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    padding: 20,
    marginBottom: 18,
    shadowColor: theme.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.text },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: "700", color: theme.text },

  dateGroup: { marginBottom: 20 },
  dateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  dateLabelLine: { flex: 1, height: 1, backgroundColor: theme.bgSoft },
  dateLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A6FA8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dateCountBadge: {
    backgroundColor: theme.bg,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dateCountText: { fontSize: 11, fontWeight: "700", color: "#1A6FA8" },

  dayStatsRow: {
    flexDirection: "row",
    backgroundColor: theme.bg,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dayStatItem: { flex: 1, alignItems: "center" },
  dayStatLabel: { fontSize: 11, color: theme.textMuted, marginBottom: 2 },
  dayStatValue: { fontSize: 15, fontWeight: "700", color: theme.text },
  dayStatDivider: { width: 1, backgroundColor: theme.border, marginVertical: 4 },

  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.bgAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  readingIndicator: { width: 4, height: 36, borderRadius: 4 },
  readingValue: { fontSize: 18, fontWeight: "700", color: theme.text, marginBottom: 2 },
  readingUnit: { fontSize: 12, fontWeight: "400", color: theme.textMuted },
  readingTime: { fontSize: 12, color: theme.textLight },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "700" },

  // Tab switcher
  tabRow: {
    flexDirection: "row",
    backgroundColor: theme.bg,
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
    backgroundColor: theme.bgCard,
    shadowColor: theme.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.textLight },
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
    borderBottomColor: theme.bg,
  },
  logDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  logPrimary: { fontSize: 14, fontWeight: "600", color: theme.text },
  logMeta: { fontSize: 13, fontWeight: "400", color: theme.textLight },
  logTime: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  predictionCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  predictionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  predictionTitle: { fontSize: 14, fontWeight: "600", color: "#1A6FA8" },
  predictionMuted: { fontSize: 13, color: theme.textLight, textAlign: "center", paddingVertical: 6 },
  predictionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  predictionValue: { fontSize: 36, fontWeight: "700", color: theme.text },
  predictionUnit: { fontSize: 13, color: theme.textLight, fontWeight: "400" },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  trendBadgeText: { fontSize: 12, fontWeight: "600" },
  adviceBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 10, borderWidth: 1 },
  adviceText: { fontSize: 13, flex: 1, lineHeight: 19 },
  staleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#FED7AA", marginBottom: 12 },
  staleText: { fontSize: 12, color: "#92400E", flex: 1, lineHeight: 18 },

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
  alertValue: { fontSize: 17, fontWeight: "700", color: theme.text, marginTop: 2 },
  alertUnit: { fontSize: 12, fontWeight: "400", color: theme.textLight },
  alertTime: { fontSize: 11, color: theme.textLight, textAlign: "right" },
  alertUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#1A6FA8" },
  alertReadBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.bg },
  alertReadBtnText: { fontSize: 11, color: "#1A6FA8", fontWeight: "600" },
  alertReadAllBtn: { marginLeft: "auto" as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: theme.bg },
  alertReadAllText: { fontSize: 12, color: "#1A6FA8", fontWeight: "600" },
  showMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, marginTop: 4 },
  showMoreText: { fontSize: 13, color: "#1A6FA8", fontWeight: "600" },

  dayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.bgSoft,
  },
  dayBtnActive: {
    backgroundColor: "#1A6FA8",
    borderColor: "#1A6FA8",
  },
  dayBtnText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
  dayBtnTextActive: { color: "#FFFFFF" },

  dayNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.bg,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 10,
    alignSelf: "center",
    width: "70%",
  },
  dayNavArrow: { padding: 4 },
  dayNavCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dayNavLabel: { fontSize: 12, fontWeight: "600", color: theme.text },
  calModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  calModalBox: {
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    padding: 16,
    width: SCREEN_WIDTH - 48,
    shadowColor: theme.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calCloseBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: theme.bg,
    borderRadius: 10,
  },
  calCloseTxt: { fontSize: 14, fontWeight: "600", color: "#1A6FA8" },
  emptyChart: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8 },
  emptyChartText: { fontSize: 13, color: theme.textLight, fontWeight: "500" },

  accordionItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    marginBottom: 10,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.bgAlt,
    gap: 8,
  },
  accordionLabel: { fontSize: 13, fontWeight: "700", color: theme.text },
  accordionSub: { fontSize: 11, color: theme.textLight, marginTop: 2 },

  headerTabs: {
    flexDirection: "row",
    backgroundColor: theme.bgSoft,
    paddingHorizontal: 12,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  headerTabActive: {
    borderBottomColor: "#1A6FA8",
    backgroundColor: "transparent",
  },
  headerTabText: { fontSize: 12, fontWeight: "600", color: theme.textLight },
  headerTabTextActive: { color: "#1A6FA8", fontWeight: "700" },

  logDayNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.bg,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  logSection: {
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.bg,
    paddingTop: 12,
  },
  logSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  logSectionTitle: { fontSize: 13, fontWeight: "700", color: theme.text, flex: 1 },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.bg,
  },
  readMoreText: { fontSize: 13, fontWeight: "600", color: "#1A6FA8" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  statLabel: { fontSize: 11, fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  statUnit:  { fontSize: 11, color: theme.textLight, marginTop: 2 },
  statFooter: { fontSize: 12, color: theme.inactive, textAlign: "center", marginTop: 12 },

  a1cCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 5, backgroundColor: theme.bgCard,
    alignItems: "center", justifyContent: "center",
    marginVertical: 16,
  },
  a1cValue: { fontSize: 38, fontWeight: "800" },
  a1cBadge: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, marginTop: 4,
  },
  a1cBadgeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  });
}
