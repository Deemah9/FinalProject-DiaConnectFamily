import { useAuth } from "@/context/AuthContext";
import {
  getGlucosePrediction,
  getGlucoseReadings,
  getProfile,
  getUnreadCount,
  importGlucoseCSV,
  registerPushToken,
} from "@/services/api";
import AppHeader from "@/src/components/AppHeader";
import GlucoseTrendChart from "@/src/components/GlucoseTrendChart";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { checkAndClearPredictionStale } from "@/services/predictionFlag";
import { getReminderTimes, getRemindersEnabled } from "@/services/reminderScheduler";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Dimensions,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { useHaptic } from "@/context/HapticContext";
import { Calendar } from "react-native-calendars";
import { useAppTheme } from "@/hooks/useAppTheme";

// ── Catmull-Rom → cubic bezier smooth path ─────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
const isRTL = I18nManager.isRTL;
const DISMISS_KEY = "reminder_dismissed_at";

async function shouldShowReminderPopup(dismissedAtMs: number): Promise<boolean> {
  const times = await getReminderTimes();
  const enabled = await getRemindersEnabled();
  const now = Date.now();

  if (!enabled || times.length === 0) {
    return now - dismissedAtMs >= 4 * 60 * 60 * 1000;
  }

  const dismissedDate = new Date(dismissedAtMs);
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const time of times) {
      const [h, m] = time.split(":").map(Number);
      const reminderDate = new Date(dismissedDate);
      reminderDate.setDate(reminderDate.getDate() + dayOffset);
      reminderDate.setHours(h, m, 0, 0);
      if (reminderDate.getTime() > dismissedAtMs && reminderDate.getTime() <= now) {
        return true;
      }
    }
  }
  return false;
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { user: authUser } = useAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { triggerCriticalAlert } = useHaptic();
  const isFirstFocus = useRef(true);
  const lastHapticValue = useRef<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);


  // Register push token for patient notifications
  useEffect(() => {
    const registerPush = async () => {
      if (Platform.OS === "web") return;
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: "7f5f1128-2316-49d4-9446-aa05edb735d8",
        });
        await registerPushToken(tokenData.data);
      } catch (e) {
        console.log("[Push] Error:", e);
      }
    };
    registerPush();
  }, []);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState("");

  const [glucoseReadings, setGlucoseReadings] = useState<any[]>([]);
  const [loadingGlucose, setLoadingGlucose] = useState(true);
  const [errorGlucose, setErrorGlucose] = useState("");

  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const pickingRef = useRef(false);
  const [importToast, setImportToast] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadGlucose();
      getUnreadCount().then((d: any) => setUnreadCount(d?.unread_count ?? 0)).catch(() => {});

      // Run on first open OR when new data was saved from another screen
      if (isFirstFocus.current || checkAndClearPredictionStale()) {
        loadPrediction();
        isFirstFocus.current = false;
      }

      // Auto-refresh every hour while this screen is in focus
      const interval = setInterval(loadPrediction, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, []),
  );

  const loadPrediction = async () => {
    try {
      setLoadingPrediction(true);
      const data = await getGlucosePrediction(1, i18n.language);
      setPrediction(data);
    } catch {
      setPrediction(null);
    } finally {
      setLoadingPrediction(false);
    }
  };

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

  const loadGlucose = async (): Promise<any[]> => {
    try {
      setLoadingGlucose(true);
      setErrorGlucose("");

      const data = await getGlucoseReadings();

      let readings: any[] = [];
      if (Array.isArray(data)) readings = data;
      else if (Array.isArray(data?.items)) readings = data.items;
      else if (Array.isArray(data?.readings)) readings = data.readings;
      setGlucoseReadings(readings);

      // Show welcome modal once for new users with no readings
      if (readings.length === 0) {
        const seen = await AsyncStorage.getItem("welcome_shown");
        if (!seen) setShowWelcome(true);
      }

      // Haptic alert for critical glucose values (only once per unique value)
      if (readings.length > 0) {
        const latestVal = Number(readings
          .slice()
          .sort((a: any, b: any) =>
            new Date(b?.measuredAt || b?.timestamp || b?.createdAt || 0).getTime() -
            new Date(a?.measuredAt || a?.timestamp || a?.createdAt || 0).getTime()
          )[0]?.value || 0);
        if ((latestVal < 70 || latestVal > 170) && latestVal !== lastHapticValue.current) {
          lastHapticValue.current = latestVal;
          triggerCriticalAlert();
        }
      }

      // Check if last reading was 6+ hours ago
      if (readings.length > 0) {
        const latest = readings
          .map((r: any) =>
            new Date(
              r?.measuredAt || r?.timestamp || r?.createdAt || 0,
            ).getTime(),
          )
          .filter((t: number) => t > 0)
          .sort((a: number, b: number) => b - a)[0];
        const hoursElapsed = (Date.now() - latest) / (1000 * 60 * 60);
        if (hoursElapsed >= 6) {
          const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
          const show = !dismissedAt || await shouldShowReminderPopup(parseInt(dismissedAt, 10));
          if (show) setShowReminder(true);
        }
      }

      return readings;
    } catch (error: any) {
      console.log("glucose fetch error:", error);
      setErrorGlucose(error?.message || "Failed to load glucose readings");
      setGlucoseReadings([]);
      return [];
    } finally {
      setLoadingGlucose(false);
    }
  };

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || t("user");

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? t("goodMorning") : t("goodEvening");
  };

  const speakGlucose = () => {
    if (typeof latest !== "number") return;
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const text = t("speakGlucoseText", {
      value: latest,
      status: latestStatus,
    });
    setSpeaking(true);
    Speech.speak(text, {
      language: i18n.language === "ar" ? "ar" : i18n.language === "he" ? "he-IL" : "en-US",
      rate: 0.9,
      onDone:  () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const shiftDay = (dateStr: string, delta: number) => {
    const [y, m, day] = dateStr.split("-").map(Number);
    return toLocalDateStr(new Date(y, m - 1, day + delta));
  };

  const todayStr = toLocalDateStr(new Date());
  const canNext = selectedDateStr < todayStr;

  const chartReadings = useMemo(() => {
    return [...glucoseReadings]
      .filter((g) => {
        if (Number(g?.value) <= 0) return false;
        const raw = g?.measuredAt || g?.timestamp || g?.createdAt || "";
        const d = new Date(raw);
        return (
          !Number.isNaN(d.getTime()) && toLocalDateStr(d) === selectedDateStr
        );
      })
      .sort((a, b) => {
        const ta = new Date(
          a?.measuredAt || a?.timestamp || a?.createdAt || "",
        ).getTime();
        const tb = new Date(
          b?.measuredAt || b?.timestamp || b?.createdAt || "",
        ).getTime();
        return ta - tb;
      });
  }, [glucoseReadings, selectedDateStr]);

  const selectedLabel = useMemo(() => {
    if (selectedDateStr === todayStr) return t("today");
    const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000));
    if (selectedDateStr === yesterday) return t("yesterday");
    const [y, m, day] = selectedDateStr.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [selectedDateStr, t]);

  const datesWithReadings = useMemo(() => {
    const dates = new Set<string>();
    for (const g of glucoseReadings) {
      const raw = g?.measuredAt || g?.timestamp || g?.createdAt || "";
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) dates.add(toLocalDateStr(d));
    }
    return dates;
  }, [glucoseReadings]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    datesWithReadings.forEach((dateStr) => {
      marks[dateStr] = {
        marked: true,
        dotColor: "#1A6FA8",
        selected: dateStr === selectedDateStr,
        selectedColor: "#1A6FA8",
      };
    });
    return marks;
  }, [datesWithReadings, selectedDateStr]);

  const latest =
    chartReadings.length > 0
      ? Number(chartReadings[chartReadings.length - 1]?.value || 0)
      : "--";
  const chartWidth = Dimensions.get("window").width - 64;

  const latestStatus =
    typeof latest === "number"
      ? latest < 70
        ? t("low")
        : latest > 170
          ? t("high")
          : t("normal")
      : "--";

  const pickAndImportCSV = async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/csv",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      setShowAddModal(false);
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      setImporting(true);
      // On web, asset.file is the native File object; on native, use { uri, name, type }
      const filePayload = (asset as any).file ?? {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "text/csv",
      };
      const data = await importGlucoseCSV(
        filePayload,
        asset.name,
        asset.mimeType ?? "text/csv",
      );
      const freshReadings = await loadGlucose();
      setShowReminder(false); // don't show stale reminder right after an import
      loadPrediction();

      // Navigate chart to the date of the most recent imported reading
      if (freshReadings.length > 0) {
        const latestTs = freshReadings
          .map((r: any) =>
            new Date(
              r?.measuredAt || r?.timestamp || r?.createdAt || 0,
            ).getTime(),
          )
          .filter((t: number) => t > 0)
          .sort((a: number, b: number) => b - a)[0];
        if (latestTs > 0) {
          setSelectedDateStr(toLocalDateStr(new Date(latestTs)));
        }
      }

      if (data.imported_count === 0 && data.skipped_count > 0) {
        Alert.alert(t("importAlreadyTitle"), t("importAlreadyMessage"));
      } else {
        Alert.alert(
          t("importSuccessTitle"),
          `${t("importSuccess", { count: data.imported_count })}\n${t("importSkipped", { count: data.skipped_count })}`,
          [{ text: t("close"), onPress: () => router.push("/glucose-history" as any) }],
        );
      }
    } catch (e: any) {
      Alert.alert(t("importCSV"), e?.message || t("importFailed"));
    } finally {
      setImporting(false);
      pickingRef.current = false;
    }
  };

  if (authUser?.role === "family_member") {
    return <Redirect href={"/family-home" as any} />;
  }

  return (
    <LinearGradient colors={[theme.bgCard, theme.bg]} style={styles.container}>
      <AppHeader left={null} unreadCount={unreadCount} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Welcome */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loadingUser ? t("loading") : `${getGreeting()} ${fullName}`}
          </Text>
          <Text style={styles.welcomeSub}>
            {errorUser
              ? errorUser
              : user?.role === "family_member"
                ? t("familyWelcomeSubtitle")
                : t("homeSubtitle")}
          </Text>
        </View>

        {/* AI Prediction Card */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("predictionTitle")}</Text>
          <View style={styles.predictionCard}>
            <View style={styles.predictionHeader}>
              <Ionicons
                name="analytics-outline"
                size={20}
                color={theme.primary}
              />
              <Text style={styles.predictionLabel}>
                {t("predictionSubtitle")}
              </Text>
            </View>

            {loadingPrediction ? (
              <Text style={styles.predictionLoading}>
                {t("predictionLoading")}
              </Text>
            ) : prediction?.data_stale &&
              prediction?.predicted_value == null ? (
              <View style={styles.staleWarningCard}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
                <Text style={styles.staleWarningText}>
                  {prediction.message || t("predictionStale")}
                </Text>
              </View>
            ) : prediction?.predicted_value != null ? (
              <>
                {/* Stale data soft warning */}
                {prediction?.data_stale && (
                  <View style={styles.staleBanner}>
                    <Ionicons name="time-outline" size={14} color="#D97706" />
                    <Text style={styles.staleBannerText}>
                      {prediction.message}
                    </Text>
                  </View>
                )}

                {/* Value + Trend Badge Row */}
                <View style={styles.predictionValueRow}>
                  <View>
                    <Text style={styles.predictionValue}>
                      {Math.round(prediction.predicted_value)}
                      <Text style={styles.predictionUnit}> {t("mgdL")}</Text>
                    </Text>
                  </View>

                  {(prediction.trend ||
                    prediction.alert_type === "patch_error") && (
                    <View
                      style={[
                        styles.trendBadge,
                        prediction.alert_type === "patch_error"
                          ? { backgroundColor: "#FEF3C7" }
                          : prediction.trend === "rising"
                            ? { backgroundColor: "#FEE2E2" }
                            : prediction.trend === "falling"
                              ? { backgroundColor: "#FEF3C7" }
                              : { backgroundColor: "#D1FAE5" },
                      ]}
                    >
                      <Ionicons
                        name={
                          prediction.alert_type === "patch_error"
                            ? "warning"
                            : prediction.trend === "rising"
                              ? "trending-up"
                              : prediction.trend === "falling"
                                ? "trending-down"
                                : "remove"
                        }
                        size={18}
                        color={
                          prediction.alert_type === "patch_error"
                            ? "#D97706"
                            : prediction.trend === "rising"
                              ? "#DC2626"
                              : prediction.trend === "falling"
                                ? "#D97706"
                                : "#059669"
                        }
                      />
                      <Text
                        style={[
                          styles.trendBadgeText,
                          prediction.alert_type === "patch_error"
                            ? { color: "#92400E" }
                            : prediction.trend === "rising"
                              ? { color: "#DC2626" }
                              : prediction.trend === "falling"
                                ? { color: "#D97706" }
                                : { color: "#059669" },
                        ]}
                      >
                        {prediction.alert_type === "patch_error"
                          ? t("alert_patch_error_short")
                          : t(`trend_${prediction.trend}`)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Probability Row */}
                {prediction.probability != null &&
                  prediction.trend &&
                  prediction.alert_type !== "patch_error" && (
                    <View style={styles.probRow}>
                      <Ionicons
                        name="stats-chart-outline"
                        size={14}
                        color="#4A6480"
                      />
                      <Text style={styles.probText}>
                        <Text style={styles.probValue}>
                          {prediction.probability}%
                        </Text>
                        {"  "}
                        {prediction.alert_type === "high" &&
                        prediction.trend === "falling"
                          ? t("prob_falling_high")
                          : t(`prob_${prediction.trend}`)}
                      </Text>
                    </View>
                  )}

                {/* Alert + AI Advice */}
                {(prediction.alert_type || prediction.advice?.patient) && (
                  <View
                    style={[
                      styles.predictionAlert,
                      prediction.alert_type === "low" && {
                        backgroundColor: "#FFF7ED",
                        borderColor: "#FED7AA",
                      },
                      prediction.alert_type === "high" && {
                        backgroundColor: "#FDEDED",
                        borderColor: "#FECACA",
                      },
                      prediction.alert_type === "patch_error" && {
                        backgroundColor: "#F3F4F6",
                        borderColor: "#E5E7EB",
                      },
                      !prediction.alert_type && {
                        backgroundColor: "#EBF3FA",
                        borderColor: "#B8D0E8",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        prediction.alert_type === "patch_error"
                          ? "warning"
                          : prediction.alert_type
                            ? "alert-circle"
                            : "information-circle"
                      }
                      size={18}
                      color={
                        prediction.alert_type === "low"
                          ? "#E07B00"
                          : prediction.alert_type === "high"
                            ? "#D32F2F"
                            : prediction.alert_type === "patch_error"
                              ? "#6B7280"
                              : "#1A6FA8"
                      }
                    />
                    <Text
                      style={[
                        styles.predictionAlertText,
                        prediction.alert_type === "low" && { color: "#92400E" },
                        prediction.alert_type === "high" && {
                          color: "#991B1B",
                        },
                        prediction.alert_type === "patch_error" && {
                          color: "#374151",
                        },
                        !prediction.alert_type && { color: "#1A4A6B" },
                      ]}
                    >
                      {prediction.advice?.patient ||
                        (prediction.alert_type
                          ? t(`alert_${prediction.alert_type}`)
                          : "")}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.predictionInsufficient}>
                {t("predictionUnavailable")}
              </Text>
            )}
          </View>
        </View>

        {/* Historical Pattern Card — shown only when prediction_mode = "pattern" */}
        {prediction?.prediction_mode === "pattern" &&
          (() => {
            const pp = prediction.pattern_prediction;
            const risk = pp?.risk_level ?? "normal";

            const riskColor =
              risk === "high"
                ? "#D32F2F"
                : risk === "low"
                  ? "#D97706"
                  : risk === "variable"
                    ? "#7C3AED"
                    : "#059669";
            const riskBg =
              risk === "high"
                ? "#FEE2E2"
                : risk === "low"
                  ? "#FFFBEB"
                  : risk === "variable"
                    ? "#F5F3FF"
                    : "#D1FAE5";
            const riskIcon =
              risk === "variable"
                ? "stats-chart"
                : risk === "normal"
                  ? "checkmark-circle"
                  : "alert-circle";
            const riskLabel =
              risk === "high"
                ? t("high")
                : risk === "low"
                  ? t("low")
                  : risk === "variable"
                    ? t("patternVariabilityUnstable")
                    : t("normal");

            const confLabel =
              pp?.confidence === "high"
                ? t("patternConfidenceHigh")
                : pp?.confidence === "medium"
                  ? t("patternConfidenceMedium")
                  : t("patternConfidenceLow");

            const avgVal = pp?.typical_avg ?? 0;
            const adviceStyle =
              avgVal > 170
                ? {
                    bg: "#FDEDED",
                    border: "#FECACA",
                    color: "#991B1B",
                    icon: "alert-circle",
                    iconClr: "#D32F2F",
                  }
                : avgVal < 70
                  ? {
                      bg: "#FFF7ED",
                      border: "#FED7AA",
                      color: "#92400E",
                      icon: "alert-circle",
                      iconClr: "#E07B00",
                    }
                  : {
                      bg: "#EBF3FA",
                      border: "#B8D0E8",
                      color: "#1A4A6B",
                      icon: "information-circle",
                      iconClr: "#1A6FA8",
                    };

            return (
              <View style={styles.section} key="pattern-card">
                <Text style={styles.sectionLabel}>{t("patternCardTitle")}</Text>
                <View style={styles.predictionCard}>
                  {/* Header — mirrors prediction card */}
                  <View style={styles.predictionHeader}>
                    <Ionicons
                      name="bar-chart-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={styles.predictionLabel}>
                      {t("patternCardSubtitle")}
                    </Text>
                  </View>

                  {pp?.available ? (
                    <>
                      {/* Value row + risk badge */}
                      <View style={styles.predictionValueRow}>
                        <View>
                          <Text
                            style={[
                              styles.predictionValue,
                              {
                                color:
                                  avgVal > 170
                                    ? "#D32F2F"
                                    : avgVal < 70
                                      ? "#D97706"
                                      : theme.text,
                              },
                            ]}
                          >
                            {pp.typical_avg}
                            <Text style={styles.predictionUnit}>
                              {" "}
                              {t("mgdL")}
                            </Text>
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.trendBadge,
                            { backgroundColor: riskBg },
                          ]}
                        >
                          <Ionicons
                            name={riskIcon as any}
                            size={18}
                            color={riskColor}
                          />
                          <Text
                            style={[
                              styles.trendBadgeText,
                              { color: riskColor },
                            ]}
                          >
                            {riskLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Typical range */}
                      {pp.typical_min != null && pp.typical_max != null && (
                        <View style={[styles.probRow, { marginBottom: 12 }]}>
                          <Ionicons
                            name="stats-chart-outline"
                            size={14}
                            color="#4A6480"
                          />
                          <Text style={styles.probText}>
                            {t("patternTypical")}{" "}
                            <Text style={styles.probValue}>
                              {pp.typical_min} – {pp.typical_max}
                            </Text>{" "}
                            {t("mgdL")}
                          </Text>
                        </View>
                      )}

                      {/* Advice — identical style to prediction card */}
                      {(prediction.advice?.patient || pp.message) && (
                        <View
                          style={[
                            styles.predictionAlert,
                            {
                              backgroundColor: adviceStyle.bg,
                              borderColor: adviceStyle.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={adviceStyle.icon as any}
                            size={18}
                            color={adviceStyle.iconClr}
                          />
                          <Text
                            style={[
                              styles.predictionAlertText,
                              { color: adviceStyle.color },
                            ]}
                          >
                            {prediction.advice?.patient || pp.message}
                          </Text>
                        </View>
                      )}

                      {/* Footer: samples + confidence */}
                      <View
                        style={[
                          styles.probRow,
                          { marginTop: 10, marginBottom: 0 },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color="#4A6480"
                        />
                        <Text style={styles.probText}>
                          {t("patternSamples", { count: pp.sample_count })}
                          {"  ·  "}
                          <Text
                            style={{
                              fontWeight: "600",
                              color:
                                pp?.confidence === "high"
                                  ? "#16A34A"
                                  : pp?.confidence === "medium"
                                    ? "#D97706"
                                    : "#6B7280",
                            }}
                          >
                            {confLabel}
                          </Text>
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.predictionInsufficient}>
                      {t("patternNoData")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

        {/* Glucose Trend — chart with day navigator */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("todaysOverview")}</Text>

          <View style={styles.overviewCard}>
            <View style={styles.latestRow}>
              <View>
                <Text style={styles.overviewTitle}>{t("bloodGlucose")}</Text>
                <Text style={styles.overviewSub}>
                  {errorGlucose ? errorGlucose : t("trackReadings")}
                </Text>
              </View>
              <View
                style={styles.latestPill}
                accessible={typeof latest === "number"}
                accessibilityLabel={
                  typeof latest === "number"
                    ? t("aria.glucoseValue", { value: latest, status: latestStatus })
                    : undefined
                }
              >
                <Text style={styles.latestValue}>
                  {loadingGlucose ? "--" : latest}
                </Text>
                <Text style={styles.latestUnit}>{t("mgdL")}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    typeof latest === "number" &&
                      latest < 70 && { backgroundColor: "#FEF3E2" },
                    typeof latest === "number" &&
                      latest >= 70 &&
                      latest <= 170 && { backgroundColor: "#E6F7F2" },
                    typeof latest === "number" &&
                      latest > 170 && { backgroundColor: "#FDEDED" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      typeof latest === "number" &&
                        latest < 70 && { color: "#E07B00" },
                      typeof latest === "number" &&
                        latest >= 70 &&
                        latest <= 170 && { color: "#0D9E6E" },
                      typeof latest === "number" &&
                        latest > 170 && { color: "#D32F2F" },
                    ]}
                  >
                    {latestStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* TTS Listen button */}
            {typeof latest === "number" && (
              <Pressable
                style={[styles.speakBtn, speaking && styles.speakBtnActive]}
                onPress={speakGlucose}
                accessibilityLabel={speaking ? t("aria.stopListening") : t("aria.listenGlucose")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={speaking ? "stop-circle-outline" : "volume-high-outline"}
                  size={16}
                  color={speaking ? "#D32F2F" : "#1A6FA8"}
                />
                <Text style={[styles.speakBtnText, speaking && { color: "#D32F2F" }]}>
                  {speaking ? t("close", "Stop") : t("speakBtn", "Listen")}
                </Text>
              </Pressable>
            )}

            {/* Day Navigator */}
            <View style={styles.dayNav}>
              <Pressable
                style={styles.navArrow}
                onPress={() => setSelectedDateStr((d) => shiftDay(d, -1))}
                accessibilityLabel={t("aria.prevDay")}
                accessibilityRole="button"
              >
                <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={20} color="#1A6FA8" />
              </Pressable>
              <Pressable
                style={styles.dayNavCenter}
                onPress={() => setShowCalendar(true)}
                accessibilityLabel={t("aria.selectDate")}
                accessibilityRole="button"
              >
                <Ionicons name="calendar-outline" size={14} color="#1A6FA8" />
                <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
              </Pressable>
              <Pressable
                style={[styles.navArrow, !canNext && { opacity: 0.3 }]}
                onPress={() =>
                  canNext && setSelectedDateStr((d) => shiftDay(d, 1))
                }
                disabled={!canNext}
                accessibilityLabel={t("aria.nextDay")}
                accessibilityRole="button"
              >
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#1A6FA8" />
              </Pressable>
            </View>

            {/* Calendar Modal */}
            <Modal visible={showCalendar} transparent animationType="fade">
              <Pressable
                style={styles.calBackdrop}
                onPress={() => setShowCalendar(false)}
              >
                <Pressable
                  style={styles.calBox}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Calendar
                    markedDates={markedDates}
                    onDayPress={(day: any) => {
                      setSelectedDateStr(day.dateString);
                      setShowCalendar(false);
                    }}
                    theme={{
                      selectedDayBackgroundColor: "#1A6FA8",
                      todayTextColor: "#1A6FA8",
                      arrowColor: "#1A6FA8",
                      dotColor: "#1A6FA8",
                    }}
                  />
                  <Pressable
                    style={styles.calCloseBtn}
                    onPress={() => setShowCalendar(false)}
                  >
                    <Text style={styles.calCloseTxt}>{t("close")}</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>

            {chartReadings.length > 0 ? (
              <View style={styles.trendWrap}>
                <GlucoseTrendChart
                  readings={chartReadings}
                  width={chartWidth}
                />
                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#F59E0B" }]}
                    />
                    <Text style={styles.legendText}>{t("low")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#22C55E" }]}
                    />
                    <Text style={styles.legendText}>{t("normal")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
                    />
                    <Text style={[styles.legendText, { color: "#EF4444" }]}>
                      {t("high")}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.trendEmpty}>
                <Ionicons
                  name="stats-chart-outline"
                  size={32}
                  color={theme.border}
                />
                <Text style={styles.trendEmptyText}>{t("noReadingsYet")}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Welcome Modal — shown once for new users */}
      <Modal
        visible={showWelcome}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWelcome(false)}
      >
        <View style={styles.welcomeBackdrop}>
          <View style={styles.welcomeBox}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="heart" size={32} color="#1A6FA8" />
            </View>
            <Text style={styles.welcomeModalTitle}>{t("welcomeModalTitle")}</Text>
            <Text style={styles.welcomeBody}>{t("welcomeModalBody")}</Text>
            <Pressable
              style={styles.welcomePrimaryBtn}
              onPress={async () => {
                await AsyncStorage.setItem("welcome_shown", "1");
                setShowWelcome(false);
                router.push("/add-glucose" as any);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.welcomePrimaryText}>
                {t("welcomeModalAddBtn")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.welcomeSkipBtn}
              onPress={async () => {
                await AsyncStorage.setItem("welcome_shown", "1");
                setShowWelcome(false);
              }}
            >
              <Text style={styles.welcomeSkipText}>
                {t("welcomeModalSkip")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* FAB — Add / Import Glucose (patients only) */}
      {authUser?.role !== "family_member" && (
        <Pressable
          style={styles.fab}
          onPress={() => !importing && setShowAddModal(true)}
          accessibilityLabel={t("aria.addReading")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Add Options Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          style={styles.addModalBackdrop}
          onPress={() => setShowAddModal(false)}
        >
          <View style={styles.addModalSheet}>
            <View style={styles.addModalHandle} />

            {/* Title */}
            <View style={styles.addModalTitleRow}>
              <View style={styles.addModalTitleBadge}>
                <Ionicons name="pulse-outline" size={18} color="#1A6FA8" />
              </View>
              <Text style={styles.addModalTitle}>{t("importCSVTitle")}</Text>
            </View>

            {/* Manual Entry Card — Blue */}
            <Pressable
              style={styles.addCardBlue}
              onPress={() => {
                setShowAddModal(false);
                router.push("/add-glucose" as any);
              }}
            >
              <View style={styles.addCardIconBlue}>
                <Ionicons name="pencil" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.addOptionText}>
                <Text style={styles.addCardLabelBlue}>{t("manualEntry")}</Text>
                <Text style={styles.addCardSubBlue}>{t("manualEntrySub")}</Text>
              </View>
              <View style={styles.addCardArrowBlue}>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color="#1A6FA8" />
              </View>
            </Pressable>

            {/* CSV Import Card — Green */}
            <Pressable
              style={[styles.addCardGreen, importing && { opacity: 0.6 }]}
              onPress={importing ? undefined : pickAndImportCSV}
            >
              <View style={styles.addCardIconGreen}>
                <Ionicons
                  name={importing ? "cloud-upload" : "document-text"}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.addOptionText}>
                <Text style={styles.addCardLabelGreen}>
                  {importing ? t("importing") : t("importCSVOption")}
                </Text>
                <Text style={styles.addCardSubGreen}>
                  {t("importCSVOptionSub")}
                </Text>
              </View>
              {!importing && (
                <View style={styles.addCardArrowGreen}>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color="#16A34A" />
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.addModalCancel}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.addModalCancelText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Glucose Reminder Modal */}
      <Modal
        visible={showReminder}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReminder(false)}
      >
        <View style={styles.reminderBackdrop}>
          <View style={styles.reminderBox}>
            <View style={styles.reminderIconWrap}>
              <Ionicons name="time-outline" size={30} color="#1A6FA8" />
            </View>
            <Text style={styles.reminderModalTitle}>{t("reminderTitle")}</Text>
            <Text style={styles.reminderModalMsg}>{t("reminderMsg")}</Text>
            <Pressable
              style={styles.reminderAddBtn}
              onPress={() => {
                setShowReminder(false);
                setShowAddModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.reminderAddText}>{t("addReading")}</Text>
            </Pressable>
            <Pressable
              style={styles.reminderDismiss}
              onPress={() => {
                setShowReminder(false);
                AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
              }}
            >
              <Text style={styles.reminderDismissText}>{t("remindLater")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


    </LinearGradient>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    importToast: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: "#1A6FA8",
      zIndex: 100,
    },
    importToastSuccess: { backgroundColor: "#16A34A" },
    importToastError: { backgroundColor: "#B91C1C" },
    importToastText: {
      flex: 1,
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "500",
    },

    content: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 80,
    },

    hero: {
      marginTop: 12,
      marginBottom: 16,
    },

    welcomeTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 8,
    },

    welcomeSub: {
      color: theme.textMuted,
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
      color: theme.primary,
      fontWeight: "600",
    },

    section: {
      marginBottom: 24,
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.textMuted,
      marginBottom: 12,
      letterSpacing: 1,
    },

    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: "#1A6FA8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#1A6FA8",
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },

    alertCard: {
      backgroundColor: "#FFFBEB",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderColor: "#FDE68A",
      borderLeftColor: "#F59E0B",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    alertIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: "#FEF3C7",
      alignItems: "center",
      justifyContent: "center",
    },

    alertMainTitle: {
      color: "#92400E",
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },

    alertMainSub: {
      color: "#B45309",
      fontSize: 12,
    },

    overviewCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    overviewTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 6,
    },

    overviewSub: {
      color: theme.textMuted,
      fontSize: 13,
      marginBottom: 16,
    },

    latestRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    latestPill: {
      alignItems: "flex-end",
      gap: 4,
    },

    latestWrap: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 4,
    },

    latestValue: {
      fontSize: 42,
      fontWeight: "700",
      color: theme.text,
      lineHeight: 46,
    },

    latestUnit: {
      fontSize: 14,
      color: theme.textMuted,
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
      color: theme.textMuted,
      marginRight: 6,
    },

    latestStatusValue: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: "#E6F7F2",
    },

    statusBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#0D9E6E",
    },

    trendWrap: {
      marginTop: 8,
      minHeight: 200,
      justifyContent: "center",
    },

    trendLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    trendChart: {
      borderRadius: 12,
      marginLeft: -8,
    },

    trendLegend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginTop: 10,
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    legendText: {
      fontSize: 11,
      color: theme.textMuted,
    },

    trendEmpty: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 200,
      gap: 8,
    },

    trendEmptyText: {
      fontSize: 13,
      color: theme.border,
    },

    glucoseButtonsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    glucosePrimaryBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      backgroundColor: "#1A6FA8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#1A6FA8",
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },

    glucosePrimaryText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.3,
    },

    glucoseSecondaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },

    glucoseSecondaryText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },

    recentList: {
      gap: 12,
    },

    reminderCard: {
      backgroundColor: "#F0FDF4",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderColor: "#BBF7D0",
      borderLeftColor: "#22C55E",
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
    },

    reminderIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: "#DCFCE7",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    reminderTitle: {
      color: "#14532D",
      fontSize: 14,
      fontWeight: "600" as const,
      marginBottom: 2,
    },

    reminderSub: {
      color: "#15803D",
      fontSize: 12,
    },

    tipCard: {
      backgroundColor: "#EFF6FF",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderColor: "#BFDBFE",
      borderLeftColor: "#3B82F6",
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
    },

    tipIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: "#DBEAFE",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    tipTitle: {
      color: "#1E3A8A",
      fontSize: 14,
      fontWeight: "600" as const,
      marginBottom: 2,
    },

    tipSub: {
      color: "#1D4ED8",
      fontSize: 12,
    },

    recentItem: {
      backgroundColor: theme.bgCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.bgSoft,
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
      color: theme.text,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },

    recentSub: {
      color: theme.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },

    recentTime: {
      color: theme.textLight,
      fontSize: 11,
    },

    // Prediction Card
    predictionCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    predictionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    predictionLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    predictionLoading: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      paddingVertical: 8,
    },
    predictionInsufficient: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: "center",
      paddingVertical: 8,
      lineHeight: 20,
    },
    predictionValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    predictionValue: {
      fontSize: 40,
      fontWeight: "700",
      color: theme.text,
    },
    predictionUnit: {
      fontSize: 14,
      color: theme.textMuted,
      fontWeight: "400",
    },
    trendBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    probRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      marginBottom: 2,
      paddingHorizontal: 2,
    },
    probText: {
      fontSize: 13,
      color: "#4A6480",
    },
    probValue: {
      fontSize: 13,
      fontWeight: "700",
      color: "#1A6FA8",
    },
    trendBadgeText: {
      fontSize: 13,
      fontWeight: "600",
    },
    predictionAlert: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
    },
    speakBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: "#1A6FA8",
      marginBottom: 10,
    },
    speakBtnActive: {
      borderColor: "#D32F2F",
      backgroundColor: "#FFF1F1",
    },
    speakBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#1A6FA8",
    },
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
    navArrow: { padding: 4 },
    dayNavCenter: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    dayNavLabel: { fontSize: 12, fontWeight: "600", color: theme.text },
    calBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    calBox: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      padding: 16,
      width: Dimensions.get("window").width - 48,
      shadowColor: "#000",
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
    predictionAlertText: {
      fontSize: 13,
      flex: 1,
      lineHeight: 20,
    },

    // Pattern card — new design
    patternStatusStrip: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: theme.bgAlt,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    patternStatusText: {
      fontSize: 12,
      color: "#6B7280",
      flex: 1,
      lineHeight: 17,
    },
    patternMainRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    patternMainLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.inactive,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    patternBigValue: {
      fontSize: 46,
      fontWeight: "800",
      lineHeight: 52,
    },
    patternBigUnit: {
      fontSize: 15,
      fontWeight: "400",
      color: theme.inactive,
    },
    patternRangeText: {
      fontSize: 12,
      color: "#64748B",
      marginTop: 4,
      fontWeight: "500",
    },
    patternRiskPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    patternRiskPillText: {
      fontSize: 13,
      fontWeight: "700",
    },
    patternAlertBox: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    patternAlertText: {
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 20,
    },
    patternFooterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    patternSamplesText: {
      fontSize: 11,
      color: theme.inactive,
    },
    patternConfRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    patternDots: {
      fontSize: 10,
      letterSpacing: 2,
    },
    patternConfLabel: {
      fontSize: 11,
      color: theme.inactive,
    },

    staleBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#FEF9EC",
      borderWidth: 1,
      borderColor: "#FDE68A",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    staleBannerText: {
      fontSize: 12,
      color: "#92400E",
      flex: 1,
      lineHeight: 18,
    },

    staleWarningCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: "#FEF9EC",
      borderWidth: 1,
      borderColor: "#FDE68A",
      borderRadius: 12,
      padding: 14,
      marginTop: 4,
    },
    staleWarningText: {
      fontSize: 13,
      color: "#92400E",
      flex: 1,
      lineHeight: 20,
    },

    addModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    addModalSheet: {
      backgroundColor: theme.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: 28,
      paddingTop: 10,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
    },
    addModalHandle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderLight,
      alignSelf: "center",
      marginBottom: 12,
    },
    addModalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 14,
    },
    addModalTitleBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    addModalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },

    // Blue card — Manual Entry
    addCardBlue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: "#EFF6FF",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#BFDBFE",
      borderLeftWidth: 5,
      borderLeftColor: "#1A6FA8",
    },
    addCardIconBlue: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: "#1A6FA8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#1A6FA8",
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    addCardLabelBlue: {
      fontSize: 16,
      fontWeight: "700",
      color: "#1E3A5F",
      marginBottom: 2,
    },
    addCardSubBlue: {
      fontSize: 12,
      color: "#3B82F6",
    },
    addCardArrowBlue: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: "#DBEAFE",
      alignItems: "center",
      justifyContent: "center",
    },

    // Green card — CSV Import
    addCardGreen: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: "#F0FDF4",
      marginBottom: 8,
      borderWidth: 1,
      borderColor: "#BBF7D0",
      borderLeftWidth: 5,
      borderLeftColor: "#16A34A",
    },
    addCardIconGreen: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: "#16A34A",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#16A34A",
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    addCardLabelGreen: {
      fontSize: 16,
      fontWeight: "700",
      color: "#14532D",
      marginBottom: 2,
    },
    addCardSubGreen: {
      fontSize: 12,
      color: "#16A34A",
      marginBottom: 4,
    },
    addCardInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    addCardInfoText: {
      fontSize: 10,
      color: "#15803D",
      flex: 1,
      lineHeight: 14,
      opacity: 0.85,
    },
    addCardArrowGreen: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: "#DCFCE7",
      alignItems: "center",
      justifyContent: "center",
    },

    addOptionText: { flex: 1 },
    addModalCancel: {
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: "#F1F5F9",
    },
    addModalCancelText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.inactive,
    },

    // kept for any legacy references
    addOptionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.bg,
      marginBottom: 12,
    },
    addOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },
    addOptionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 2,
    },
    addOptionSub: { fontSize: 12, color: theme.textMuted },
    importInfoBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    importInfoText: { fontSize: 12, color: "#1A6FA8", flex: 1, lineHeight: 17 },

    reminderBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    reminderBox: {
      backgroundColor: theme.bgCard,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    reminderIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    reminderModalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 10,
      textAlign: "center",
    },
    reminderModalMsg: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    reminderAddBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#1A6FA8",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 24,
      width: "100%",
      justifyContent: "center",
      marginBottom: 12,
    },
    reminderAddText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
    reminderDismiss: { paddingVertical: 8 },
    reminderDismissText: { fontSize: 13, color: theme.inactive, fontWeight: "500" },

    welcomeBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    welcomeBox: {
      backgroundColor: theme.bgCard,
      borderRadius: 28,
      padding: 28,
      width: "100%",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    welcomeIconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    welcomeModalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
      marginBottom: 12,
    },
    welcomeBody: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    welcomePrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#1A6FA8",
      paddingVertical: 14,
      borderRadius: 16,
      width: "100%",
      marginBottom: 10,
    },
    welcomePrimaryText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
    welcomeSkipBtn: { paddingVertical: 8 },
    welcomeSkipText: { fontSize: 13, color: theme.inactive, fontWeight: "500" },
  });
}
