import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "@/src/components/AppHeader";
import GlucoseTrendChart from "@/src/components/GlucoseTrendChart";
import { applyRtlIfNeeded } from "@/src/i18n/rtl";
import { getGlucoseReadings, getGlucosePrediction, getProfile, updateProfile } from "@/services/api";

// ── Catmull-Rom → cubic bezier smooth path ─────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { logout, user: authUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Redirect family members to their own home screen
  useEffect(() => {
    if (authUser?.role === "family_member") {
      router.replace("/family-home" as any);
    }
  }, [authUser?.role]);

  const DRAWER_W = 270;
  const isRTL = I18nManager.isRTL;
  const slideAnim = useRef(new Animated.Value(isRTL ? DRAWER_W : -DRAWER_W)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: isRTL ? DRAWER_W : -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => { setMenuOpen(false); cb?.(); });
  };

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState("");

  const [glucoseReadings, setGlucoseReadings] = useState<any[]>([]);
  const [loadingGlucose, setLoadingGlucose] = useState(true);
  const [errorGlucose, setErrorGlucose] = useState("");

  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadGlucose();
      loadPrediction();
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

  const loadGlucose = async () => {
    try {
      setLoadingGlucose(true);
      setErrorGlucose("");

      const data = await getGlucoseReadings();

      let readings: any[] = [];
      if (Array.isArray(data)) readings = data;
      else if (Array.isArray(data?.items)) readings = data.items;
      else if (Array.isArray(data?.readings)) readings = data.readings;
      setGlucoseReadings(readings);

      // Check if last reading was 6+ hours ago
      if (readings.length > 0) {
        const latest = readings
          .map((r: any) => new Date(r?.measuredAt || r?.timestamp || r?.createdAt || 0).getTime())
          .filter((t: number) => t > 0)
          .sort((a: number, b: number) => b - a)[0];
        const hoursElapsed = (Date.now() - latest) / (1000 * 60 * 60);
        if (hoursElapsed >= 6) setShowReminder(true);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? t("goodMorning") : t("goodEvening");
  };

  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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
        return !Number.isNaN(d.getTime()) && toLocalDateStr(d) === selectedDateStr;
      })
      .sort((a, b) => {
        const ta = new Date(a?.measuredAt || a?.timestamp || a?.createdAt || "").getTime();
        const tb = new Date(b?.measuredAt || b?.timestamp || b?.createdAt || "").getTime();
        return ta - tb;
      });
  }, [glucoseReadings, selectedDateStr]);

  const selectedLabel = useMemo(() => {
    if (selectedDateStr === todayStr) return t("today");
    const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000));
    if (selectedDateStr === yesterday) return t("yesterday");
    const [y, m, day] = selectedDateStr.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }, [selectedDateStr, t]);

  const values = glucoseReadings
    .map((g) => Number(g?.value || 0))
    .filter((v) => !Number.isNaN(v) && v > 0);

  const latest = values.length > 0 ? values[0] : "--";
  const chartWidth = Dimensions.get("window").width - 64;

  const latestStatus =
    typeof latest === "number"
      ? latest < 70 ? t("low") : latest > 170 ? t("high") : t("normal")
      : "--";

  return (
    <LinearGradient colors={["#FFFFFF", "#EBF3FA"]} style={styles.container}>
      <AppHeader
        left={null}
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable style={styles.topBarBtn} onPress={() => setLangOpen((v) => !v)}>
              <Ionicons name="earth-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.topBarBtn} onPress={openDrawer}>
              <Ionicons name="menu-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Welcome */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loadingUser
              ? t("loading")
              : `${getGreeting()} ${fullName}`}
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
              <Ionicons name="analytics-outline" size={20} color={Colors.primary} />
              <Text style={styles.predictionLabel}>{t("predictionSubtitle")}</Text>
            </View>

            {loadingPrediction ? (
              <Text style={styles.predictionLoading}>{t("predictionLoading")}</Text>
            ) : prediction?.message ? (
              <Text style={styles.predictionInsufficient}>{prediction.message}</Text>
            ) : prediction?.predicted_value != null ? (
              <>
                {/* Value + Trend Badge Row */}
                <View style={styles.predictionValueRow}>
                  <View>
                    <Text style={styles.predictionValue}>
                      {Math.round(prediction.predicted_value)}
                      <Text style={styles.predictionUnit}> {t("mgdL")}</Text>
                    </Text>
                  </View>

                  {(prediction.trend || prediction.alert_type === "patch_error") && (
                    <View style={[
                      styles.trendBadge,
                      prediction.alert_type === "patch_error" ? { backgroundColor: "#FEF3C7" } :
                      prediction.trend === "rising"  ? { backgroundColor: "#FEE2E2" } :
                      prediction.trend === "falling" ? { backgroundColor: "#FEF3C7" } :
                                                       { backgroundColor: "#D1FAE5" },
                    ]}>
                      <Ionicons
                        name={
                          prediction.alert_type === "patch_error" ? "warning"       :
                          prediction.trend === "rising"            ? "trending-up"   :
                          prediction.trend === "falling"           ? "trending-down" : "remove"
                        }
                        size={18}
                        color={
                          prediction.alert_type === "patch_error" ? "#D97706" :
                          prediction.trend === "rising"            ? "#DC2626" :
                          prediction.trend === "falling"           ? "#D97706" : "#059669"
                        }
                      />
                      <Text style={[
                        styles.trendBadgeText,
                        prediction.alert_type === "patch_error" ? { color: "#92400E" } :
                        prediction.trend === "rising"            ? { color: "#DC2626" } :
                        prediction.trend === "falling"           ? { color: "#D97706" } :
                                                                   { color: "#059669" },
                      ]}>
                        {prediction.alert_type === "patch_error"
                          ? t("alert_patch_error_short")
                          : t(`trend_${prediction.trend}`)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Probability Row */}
                {prediction.probability != null && prediction.trend && prediction.alert_type !== "patch_error" && (
                  <View style={styles.probRow}>
                    <Ionicons name="stats-chart-outline" size={14} color="#4A6480" />
                    <Text style={styles.probText}>
                      <Text style={styles.probValue}>{prediction.probability}%</Text>
                      {"  "}{t(`prob_${prediction.trend}`)}
                    </Text>
                  </View>
                )}

                {/* Alert + AI Advice */}
                {(prediction.alert_type || prediction.advice?.patient) && (
                  <View style={[
                    styles.predictionAlert,
                    prediction.alert_type === "low"         && { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
                    prediction.alert_type === "high"        && { backgroundColor: "#FDEDED", borderColor: "#FECACA" },
                    prediction.alert_type === "patch_error" && { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
                    !prediction.alert_type                  && { backgroundColor: "#EBF3FA", borderColor: "#B8D0E8" },
                  ]}>
                    <Ionicons
                      name={
                        prediction.alert_type === "patch_error" ? "warning" :
                        prediction.alert_type               ? "alert-circle" : "information-circle"
                      }
                      size={18}
                      color={
                        prediction.alert_type === "low"  ? "#E07B00" :
                        prediction.alert_type === "high" ? "#D32F2F" :
                        prediction.alert_type === "patch_error" ? "#6B7280" : "#1A6FA8"
                      }
                    />
                    <Text style={[
                      styles.predictionAlertText,
                      prediction.alert_type === "low"         && { color: "#92400E" },
                      prediction.alert_type === "high"        && { color: "#991B1B" },
                      prediction.alert_type === "patch_error" && { color: "#374151" },
                      !prediction.alert_type                  && { color: "#1A4A6B" },
                    ]}>
                      {prediction.advice?.patient || (prediction.alert_type ? t(`alert_${prediction.alert_type}`) : "")}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.predictionInsufficient}>{t("predictionUnavailable")}</Text>
            )}
          </View>
        </View>

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
              <View style={styles.latestPill}>
                <Text style={styles.latestValue}>{loadingGlucose ? "--" : latest}</Text>
                <Text style={styles.latestUnit}>{t("mgdL")}</Text>
                <View style={[
                  styles.statusBadge,
                  typeof latest === "number" && latest < 70 && { backgroundColor: "#FEF3E2" },
                  typeof latest === "number" && latest >= 70 && latest <= 170 && { backgroundColor: "#E6F7F2" },
                  typeof latest === "number" && latest > 170 && { backgroundColor: "#FDEDED" },
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    typeof latest === "number" && latest < 70 && { color: "#E07B00" },
                    typeof latest === "number" && latest >= 70 && latest <= 170 && { color: "#0D9E6E" },
                    typeof latest === "number" && latest > 170 && { color: "#D32F2F" },
                  ]}>{latestStatus}</Text>
                </View>
              </View>
            </View>

            {/* Day Navigator */}
            <View style={styles.dayNav}>
              <Pressable style={styles.navArrow} onPress={() => setSelectedDateStr((d) => shiftDay(d, -1))}>
                <Ionicons name="chevron-back" size={20} color="#1A6FA8" />
              </Pressable>
              <Text style={styles.dayNavLabel}>{selectedLabel}</Text>
              <Pressable
                style={[styles.navArrow, !canNext && { opacity: 0.3 }]}
                onPress={() => canNext && setSelectedDateStr((d) => shiftDay(d, 1))}
                disabled={!canNext}
              >
                <Ionicons name="chevron-forward" size={20} color="#1A6FA8" />
              </Pressable>
            </View>

            {chartReadings.length > 0 ? (
              <View style={styles.trendWrap}>
                <GlucoseTrendChart readings={chartReadings} width={chartWidth} />
                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={styles.legendText}>{t("low")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#22C55E" }]} />
                    <Text style={styles.legendText}>{t("normal")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[styles.legendText, { color: "#EF4444" }]}>{t("high")}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.trendEmpty}>
                <Ionicons name="stats-chart-outline" size={32} color="#B8D0E8" />
                <Text style={styles.trendEmptyText}>{t("noReadingsYet")}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB — Add Glucose */}
      <Pressable style={styles.fab} onPress={() => router.push("/add-glucose" as any)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      {/* Glucose Reminder Modal */}
      <Modal visible={showReminder} transparent animationType="fade" onRequestClose={() => setShowReminder(false)}>
        <View style={styles.reminderBackdrop}>
          <View style={styles.reminderBox}>
            <View style={styles.reminderIconWrap}>
              <Ionicons name="time-outline" size={30} color="#1A6FA8" />
            </View>
            <Text style={styles.reminderModalTitle}>{t("reminderTitle")}</Text>
            <Text style={styles.reminderModalMsg}>{t("reminderMsg")}</Text>
            <Pressable
              style={styles.reminderAddBtn}
              onPress={() => { setShowReminder(false); router.push("/add-glucose" as any); }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.reminderAddText}>{t("addReading")}</Text>
            </Pressable>
            <Pressable style={styles.reminderDismiss} onPress={() => setShowReminder(false)}>
              <Text style={styles.reminderDismissText}>{t("remindLater")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Language dropdown — rendered as Modal so it floats above all content */}
      <Modal visible={langOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.langModalBackdrop} onPress={() => setLangOpen(false)}>
          <View style={styles.langDropdown}>
            {[
              { code: "en", label: "English" },
              { code: "ar", label: "العربية" },
              { code: "he", label: "עברית" },
            ].map(({ code, label }, index, arr) => {
              const active = i18n.language === code;
              return (
                <Pressable
                  key={code}
                  style={[
                    styles.langOption,
                    index < arr.length - 1 && styles.langOptionBorder,
                    active && styles.langOptionActive,
                  ]}
                  onPress={async () => {
                    setLangOpen(false);
                    const lng = code as "en" | "ar" | "he";
                    if (i18n.language === lng) return;
                    await AsyncStorage.setItem("app_lang", lng);
                    await i18n.changeLanguage(lng);
                    await applyRtlIfNeeded(lng);
                    updateProfile({ language: lng }).catch(() => {});
                  }}
                >
                  <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>
                    {label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={14} color="#1A6FA8" />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Side Drawer — Animated, slides from left (LTR) or right (RTL) */}
      {menuOpen && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Dimmed backdrop */}
          <Animated.View
            style={[styles.overlayBackdrop, { opacity: backdropAnim }]}
            pointerEvents="box-none"
          >
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </Animated.View>

          {/* Sliding drawer panel */}
          <Animated.View
            style={[
              styles.drawer,
              isRTL ? { right: 0 } : { left: 0 },
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            {/* Blue header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerSlot} />
              <View style={styles.drawerLogoRow}>
                <Ionicons name="heart-outline" size={22} color="#E8A317" />
                <View style={{ marginLeft: 7 }}>
                  <Text style={styles.drawerLogoText}>{t("appName1")}</Text>
                  <Text style={styles.drawerLogoSub}>{t("appName2")}</Text>
                </View>
              </View>
              <View style={[styles.drawerSlot, { alignItems: "flex-end" }]}>
                <Pressable style={styles.drawerCloseBtn} onPress={() => closeDrawer()}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.drawerScroll}>
              {/* Profile section */}
              <Text style={styles.drawerSection}>{t("profileNavigation")}</Text>
              {[
                { icon: "person-outline",  label: t("openProfile"),     route: "/profile" },
              ].map(({ icon, label, route }) => (
                <Pressable key={route} style={styles.drawerItem}
                  onPress={() => closeDrawer(() => router.push(route as any))}>
                  <Ionicons name={icon as any} size={17} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{label}</Text>
                </Pressable>
              ))}

              {/* Glucose section */}
              <Text style={styles.drawerSection}>{t("glucoseNavigation")}</Text>
              {[
                { icon: "stats-chart-outline",  label: t("glucoseHistory"), route: "/glucose-history" },
                { icon: "bar-chart-outline",    label: t("glucoseStats"),   route: "/glucose-stats"   },
                { icon: "add-circle-outline",   label: t("addGlucose"),     route: "/add-glucose"     },
                { icon: "notifications-outline", label: t("alerts"),        route: "/alerts"           },
              ].map(({ icon, label, route }) => (
                <Pressable key={route} style={styles.drawerItem}
                  onPress={() => closeDrawer(() => router.push(route as any))}>
                  <Ionicons name={icon as any} size={17} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{label}</Text>
                </Pressable>
              ))}

              {/* Daily Logs section */}
              <Text style={styles.drawerSection}>{t("dailyLogsSection")}</Text>
              {[
                { icon: "calendar-outline",    label: t("dailyLog"),      route: "/daily-log" },
              ].map(({ icon, label, route }) => (
                <Pressable key={route} style={styles.drawerItem}
                  onPress={() => closeDrawer(() => router.push(route as any))}>
                  <Ionicons name={icon as any} size={17} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{label}</Text>
                </Pressable>
              ))}

              {/* Family Connection section */}
              <Text style={styles.drawerSection}>{t("familySection")}</Text>
              {user?.role === "patient" && (
                <Pressable style={styles.drawerItem}
                  onPress={() => closeDrawer(() => router.push("/family-invite" as any))}>
                  <Ionicons name="person-add-outline" size={17} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{t("inviteFamily")}</Text>
                </Pressable>
              )}
              {user?.role === "family_member" && (
                <>
                  <Pressable style={styles.drawerItem}
                    onPress={() => closeDrawer(() => router.push("/family-patients" as any))}>
                    <Ionicons name="people-outline" size={17} color={Colors.primary} />
                    <Text style={styles.drawerItemText}>{t("myPatients")}</Text>
                  </Pressable>
                  <Pressable style={styles.drawerItem}
                    onPress={() => closeDrawer(() => router.push("/family-join" as any))}>
                    <Ionicons name="link-outline" size={17} color={Colors.primary} />
                    <Text style={styles.drawerItemText}>{t("enterPairingCode")}</Text>
                  </Pressable>
                </>
              )}

              <View style={styles.drawerDivider} />

              {/* Logout */}
              <Pressable style={styles.drawerLogout}
                onPress={() => closeDrawer(() => logout())}>
                <Ionicons name="log-out-outline" size={17} color="#D32F2F" />
                <Text style={styles.drawerLogoutText}>{t("logout")}</Text>
              </Pressable>

              <View style={{ height: 32 }} />
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EBF3FA",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // ── Blue top bar ──────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A6FA8",
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 14,
  },

  topBarSpacer: {
    width: 80, // mirrors topBarRight width to keep logo visually centered
  },

  topBarLogo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  topBarRight: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },

  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  topBarTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },

  topBarSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "300",
    lineHeight: 15,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    marginTop: 12,
    marginBottom: 16,
  },

  welcomeTitle: {
    color: "#0B1A2E",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  welcomeSub: {
    color: "#4A6480",
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
    color: "#4A6480",
    marginBottom: 12,
    letterSpacing: 1,
  },


  fab: {
    position: "absolute", bottom: 32, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#1A6FA8",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#1A6FA8", shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  overviewTitle: {
    color: "#0B1A2E",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },

  overviewSub: {
    color: "#4A6480",
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
    color: "#0B1A2E",
    lineHeight: 46,
  },

  latestUnit: {
    fontSize: 14,
    color: "#4A6480",
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
    color: "#4A6480",
    marginRight: 6,
  },

  latestStatusValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B1A2E",
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
    color: "#4A6480",
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
    color: "#4A6480",
  },


  trendEmpty: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    gap: 8,
  },

  trendEmptyText: {
    fontSize: 13,
    color: "#B8D0E8",
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
    borderColor: "#B8D0E8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  glucoseSecondaryText: {
    color: "#1E3A52",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D6E8F5",
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
    color: "#0B1A2E",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  recentSub: {
    color: "#4A6480",
    fontSize: 12,
    marginBottom: 4,
  },

  recentTime: {
    color: "#7A96B0",
    fontSize: 11,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },

  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 270,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 10,
  },

  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A6FA8",
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 14,
  },

  drawerSlot: {
    width: 36,
  },

  drawerLogoRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  drawerLogoText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 18,
  },

  drawerLogoSub: {
    fontSize: 12,
    fontWeight: "300",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 15,
  },

  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  drawerScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  drawerSection: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A96B0",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },

  drawerItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0B1A2E",
  },

  drawerDivider: {
    height: 1,
    backgroundColor: "#D6E8F5",
    marginVertical: 12,
    marginHorizontal: 4,
  },

  drawerLogout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },

  drawerLogoutText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#D32F2F",
  },


  langModalBackdrop: {
    flex: 1,
    paddingTop: 70,      // clears the header height
    paddingLeft: 16,     // aligns dropdown under the globe button
  },

  langWrap: {
    position: "relative",
  },

  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EBF3FA",
    borderWidth: 1,
    borderColor: "#B8D0E8",
    alignItems: "center",
    justifyContent: "center",
  },

  langDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B8D0E8",
    shadowColor: "#1A6FA8",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    zIndex: 999,
    minWidth: 120,
    overflow: "hidden",
  },

  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 14,
  },

  langOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#D6E8F5",
  },

  langOptionActive: {
    backgroundColor: "#EBF3FA",
  },

  langOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E3A52",
  },

  langOptionTextActive: {
    fontWeight: "700",
    color: "#1A6FA8",
  },

  // Prediction Card
  predictionCard: {
    backgroundColor: "#FFFFFF",
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
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  predictionLoading: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  predictionInsufficient: {
    fontSize: 13,
    color: Colors.textMuted,
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
    color: Colors.text,
  },
  predictionUnit: {
    fontSize: 14,
    color: Colors.textMuted,
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
  dayNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EBF3FA", borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 6,
    marginBottom: 10,
    alignSelf: "center",
    width: "70%",
  },
  navArrow: { padding: 4 },
  dayNavLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: "#0B1A2E" },
  predictionAlertText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },

  reminderBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  reminderBox: {
    backgroundColor: "#FFFFFF", borderRadius: 24,
    padding: 24, width: "100%", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  reminderIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#EBF3FA", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  reminderModalTitle: { fontSize: 17, fontWeight: "700", color: "#0B1A2E", marginBottom: 10, textAlign: "center" },
  reminderModalMsg: { fontSize: 14, color: "#4A6480", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  reminderAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1A6FA8", borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
    width: "100%", justifyContent: "center", marginBottom: 12,
  },
  reminderAddText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  reminderDismiss: { paddingVertical: 8 },
  reminderDismissText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
});
