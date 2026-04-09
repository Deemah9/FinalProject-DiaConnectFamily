import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "@/src/components/AppHeader";
import { applyRtlIfNeeded } from "@/src/i18n/rtl";
import { getGlucoseReadings, getProfile, updateProfile } from "@/services/api";

// ── Catmull-Rom → cubic bezier smooth path ─────────────────────────────────
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ── Glucose Trend Chart ─────────────────────────────────────────────────────
// Returns Catmull-Rom control points for segment p1→p2
function segmentControlPoints(
  pts: { x: number; y: number }[],
  i: number,
) {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  return {
    cp1x: p1.x + (p2.x - p0.x) / 6,
    cp1y: p1.y + (p2.y - p0.y) / 6,
    cp2x: p2.x - (p3.x - p1.x) / 6,
    cp2y: p2.y - (p3.y - p1.y) / 6,
  };
}

function GlucoseTrendChart({
  readings,
  width,
}: {
  readings: any[];
  width: number;
}) {
  const HIGH = 140;
  const LOW  = 70;

  const H    = 220;
  const padL = 46;   // room for Y-axis labels
  const padR = 14;
  const padT = 16;
  const padB = 32;   // room for X-axis labels
  const plotW = width - padL - padR;
  const plotH = H - padT - padB;

  // ── Parse readings ────────────────────────────────────────────────────────
  const parsed = readings
    .map((r) => {
      const v   = Number(r?.value || 0);
      const raw = r?.measuredAt || r?.timestamp || r?.createdAt || "";
      const d   = new Date(raw);
      return { t: d.getTime(), v, date: d };
    })
    .filter((r) => r.v > 0 && !Number.isNaN(r.t));

  if (parsed.length === 0) return null;

  // ── Y axis ────────────────────────────────────────────────────────────────
  const dataMax = Math.max(...parsed.map((r) => r.v));
  const yMin = 40;
  const yMax = Math.max(dataMax + 25, HIGH + 65);
  const yRange = yMax - yMin;

  // ── X axis ────────────────────────────────────────────────────────────────
  const tMin = Math.min(...parsed.map((r) => r.t));
  const tMax = Math.max(...parsed.map((r) => r.t));
  const tRange = Math.max(tMax - tMin, 1);

  const toX = (t: number) => padL + ((t - tMin) / tRange) * plotW;
  const toY = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const points = parsed.map((r) => ({ x: toX(r.t), y: toY(r.v), v: r.v }));
  const linePath = smoothPath(points);
  const bottomY  = padT + plotH;

  // ── Per-segment vertical fill bands ───────────────────────────────────────
  // Each band follows the curve from point[i] to point[i+1], then drops to the
  // baseline — coloured by the glucose level of that time segment.
  const bands = points.slice(0, -1).map((p1, i) => {
    const p2 = points[i + 1];
    const { cp1x, cp1y, cp2x, cp2y } = segmentControlPoints(points, i);
    const avgV = (p1.v + p2.v) / 2;
    const zone  = avgV < LOW ? "low" : avgV > HIGH ? "high" : "normal";
    const color = zone === "high" ? "#EF4444" : zone === "low" ? "#F59E0B" : "#22C55E";
    // topY = highest point of this segment (smallest y value = closest to top)
    const topY  = Math.min(p1.y, p2.y, cp1y, cp2y);
    const path =
      `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}` +
      ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},` +
      ` ${cp2x.toFixed(1)} ${cp2y.toFixed(1)},` +
      ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}` +
      ` L ${p2.x.toFixed(1)} ${bottomY}` +
      ` L ${p1.x.toFixed(1)} ${bottomY} Z`;
    return { path, zone, color, topY, id: `sg_${i}` };
  });

  // ── Threshold pixel positions ─────────────────────────────────────────────
  const yHighPx = toY(HIGH);
  const yLowPx  = toY(LOW);

  // ── Y-axis tick values ────────────────────────────────────────────────────
  // Always show LOW and HIGH; add a top label rounded to nearest 20
  const topLabel = Math.ceil(yMax / 20) * 20;
  const yLabels = [
    { v: topLabel, px: toY(topLabel) },
    { v: HIGH,     px: yHighPx },
    { v: LOW,      px: yLowPx  },
  ];

  // ── X-axis labels: up to 5 evenly-spaced readings ────────────────────────
  const MAX_X_LABELS = 5;
  const step  = Math.max(1, Math.round((parsed.length - 1) / (MAX_X_LABELS - 1)));
  const xLabelIndices = new Set<number>();
  for (let i = 0; i < parsed.length; i += step) xLabelIndices.add(i);
  xLabelIndices.add(parsed.length - 1);

  const xLabels = Array.from(xLabelIndices)
    .sort((a, b) => a - b)
    .map((idx) => {
      const d    = parsed[idx].date;
      const h    = d.getHours(), m = d.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h % 12 || 12;
      return {
        label: m === 0
          ? `${h12} ${ampm}`
          : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`,
        x: toX(parsed[idx].t),
      };
    });

  // ── Tooltip (last point) ──────────────────────────────────────────────────
  const last       = points[points.length - 1];
  const lastParsed = parsed[parsed.length - 1];
  const tipH       = lastParsed.date.getHours();
  const tipM       = lastParsed.date.getMinutes();
  const tipAmpm    = tipH >= 12 ? "PM" : "AM";
  const tipH12     = tipH % 12 || 12;
  const tipTime    = `${tipH12}:${tipM.toString().padStart(2, "0")} ${tipAmpm}`;
  const TIP_W = 110, TIP_H = 48, TIP_R = 8;
  const tipX = last.x + TIP_W + 12 > width - padR
    ? last.x - TIP_W - 12
    : last.x + 12;
  const tipY = Math.max(padT + 2, last.y - TIP_H / 2);

  const activeColor = last.v < LOW ? "#F59E0B" : last.v > HIGH ? "#EF4444" : "#22C55E";

  return (
    <Svg width={width} height={H}>
      {/* ── Per-segment gradients: each anchored from its own topY to baseline ── */}
      <Defs>
        {bands.map(({ id, color, topY }) => (
          <SvgGradient
            key={id}
            id={id}
            x1={0} y1={topY} x2={0} y2={bottomY}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%"   stopColor={color} stopOpacity={0.50} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </SvgGradient>
        ))}
      </Defs>

      {/* ── Vertical fill bands (one per segment) ── */}
      {bands.map(({ path, id }) => (
        <Path key={id} d={path} fill={`url(#${id})`} />
      ))}

      {/* ── Threshold dashed lines ── */}
      <Path
        d={`M ${padL} ${yHighPx.toFixed(1)} L ${(width - padR).toFixed(1)} ${yHighPx.toFixed(1)}`}
        stroke="#D1D5DB" strokeWidth={1} strokeDasharray="5,4"
      />
      <Path
        d={`M ${padL} ${yLowPx.toFixed(1)} L ${(width - padR).toFixed(1)} ${yLowPx.toFixed(1)}`}
        stroke="#D1D5DB" strokeWidth={1} strokeDasharray="5,4"
      />

      {/* ── Y-axis spine ── */}
      <Path
        d={`M ${padL} ${padT} L ${padL} ${bottomY}`}
        stroke="#E5E7EB" strokeWidth={1}
      />

      {/* ── X-axis spine ── */}
      <Path
        d={`M ${padL} ${bottomY} L ${width - padR} ${bottomY}`}
        stroke="#E5E7EB" strokeWidth={1}
      />

      {/* ── Y-axis labels & ticks ── */}
      {yLabels.map(({ v, px }) => (
        <React.Fragment key={v}>
          {/* tick mark */}
          <Path
            d={`M ${padL - 4} ${px.toFixed(1)} L ${padL} ${px.toFixed(1)}`}
            stroke="#9CA3AF" strokeWidth={1}
          />
          {/* label */}
          <SvgText
            x={padL - 7}
            y={px + 4}
            textAnchor="end"
            fontSize={10}
            fill={v === HIGH ? "#EF4444" : v === LOW ? "#F59E0B" : "#9CA3AF"}
            fontWeight={v === HIGH || v === LOW ? "600" : "400"}
          >
            {v}
          </SvgText>
        </React.Fragment>
      ))}

      {/* ── Smooth curve line ── */}
      <Path
        d={linePath}
        fill="none"
        stroke="#1F2937"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Vertical dashed drop line at last point ── */}
      <Path
        d={`M ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${bottomY}`}
        stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4,3"
      />

      {/* ── Active dot (last point) ── */}
      <Circle cx={last.x} cy={last.y} r={8}   fill="white" stroke={activeColor} strokeWidth={2} />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={activeColor} />

      {/* ── Tooltip ── */}
      <Rect x={tipX} y={tipY} width={TIP_W} height={TIP_H} rx={TIP_R} ry={TIP_R} fill="#1C2B3A" />
      <SvgText x={tipX + TIP_W / 2} y={tipY + 18} textAnchor="middle" fontSize={13} fill="white" fontWeight="700">
        {last.v} mg/dL
      </SvgText>
      <SvgText x={tipX + TIP_W / 2} y={tipY + 35} textAnchor="middle" fontSize={11} fill="#9DB4C8">
        {tipTime}
      </SvgText>

      {/* ── X-axis labels ── */}
      {xLabels.map(({ label, x }, i) => (
        <SvgText key={i} x={x} y={H - 6} textAnchor="middle" fontSize={9.5} fill="#9CA3AF">
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadGlucose();
    }, []),
  );

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

      if (Array.isArray(data)) {
        setGlucoseReadings(data);
      } else if (Array.isArray(data?.items)) {
        setGlucoseReadings(data.items);
      } else if (Array.isArray(data?.readings)) {
        setGlucoseReadings(data.readings);
      } else {
        setGlucoseReadings([]);
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

  const role = user?.role || t("patient");

  const values = glucoseReadings
    .map((g) => Number(g?.value || 0))
    .filter((v) => !Number.isNaN(v) && v > 0);

  const latest = values.length > 0 ? values[0] : "--";

  // Today's readings only, oldest → newest for the chart
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const chartReadings = [...glucoseReadings]
    .filter((g) => {
      if (Number(g?.value) <= 0) return false;
      const raw = g?.measuredAt || g?.timestamp || g?.createdAt || "";
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= todayStart;
    })
    .reverse();

  const chartWidth = Dimensions.get("window").width - 64; // card padding

  const latestStatus =
    typeof latest === "number"
      ? latest < 70
        ? t("low")
        : latest > 180
          ? t("high")
          : t("normal")
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
              : `${t("welcomeBack")}, ${fullName}!`}
          </Text>
          <Text style={styles.welcomeSub}>
            {errorUser ? errorUser : t("homeSubtitle")}
          </Text>
        </View>

        {/* Role Badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{role}</Text>
        </View>

        {/* Today's Overview — chart first */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("todaysOverview")}</Text>

          <View style={styles.overviewCard}>
            {/* Latest reading row */}
            <View style={styles.latestRow}>
              <View>
                <Text style={styles.overviewTitle}>{t("bloodGlucose")}</Text>
                <Text style={styles.overviewSub}>
                  {errorGlucose ? errorGlucose : t("trackReadings")}
                </Text>
              </View>
              <View style={styles.latestPill}>
                <Text style={styles.latestValue}>
                  {loadingGlucose ? "--" : latest}
                </Text>
                <Text style={styles.latestUnit}>{t("mgdL")}</Text>
                <View style={[
                  styles.statusBadge,
                  typeof latest === "number" && latest < 70 && { backgroundColor: "#FEF3E2" },
                  typeof latest === "number" && latest >= 70 && latest <= 180 && { backgroundColor: "#E6F7F2" },
                  typeof latest === "number" && latest > 180 && { backgroundColor: "#FDEDED" },
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    typeof latest === "number" && latest < 70 && { color: "#E07B00" },
                    typeof latest === "number" && latest >= 70 && latest <= 180 && { color: "#0D9E6E" },
                    typeof latest === "number" && latest > 180 && { color: "#D32F2F" },
                  ]}>{latestStatus}</Text>
                </View>
              </View>
            </View>

            {/* Glucose Trend Chart */}
            {chartReadings.length > 0 ? (
              <View style={styles.trendWrap}>
                <GlucoseTrendChart readings={chartReadings} width={chartWidth} />
                {/* Legend */}
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
                    <View style={styles.legendHighBadge}>
                      <Text style={styles.legendHighBadgeText}>H</Text>
                    </View>
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

        {/* Quick Actions — small square buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("quickActions")}</Text>

          <View style={styles.quickRow}>
            {[
              { icon: "flash-outline",      bg: "#EFF6FF", color: "#3B82F6", label: t("quickCheck"),   route: "/glucose-history" },
              { icon: "restaurant-outline", bg: "#FFF7ED", color: "#F59E0B", label: t("addMeal"),     route: "/add-meal"        },
              { icon: "walk-outline",       bg: "#ECFDF5", color: "#10B981", label: t("addActivity"), route: "/add-activity"    },
              { icon: "moon-outline",       bg: "#EEF2FF", color: "#1A6FA8", label: t("addSleep"),    route: "/add-sleep"       },
            ].map(({ icon, bg, color, label, route }) => (
              <Pressable
                key={route}
                style={styles.quickSquare}
                onPress={() => router.push(route as any)}
              >
                <View style={[styles.quickSquareIcon, { backgroundColor: bg }]}>
                  <Ionicons name={icon as any} size={22} color={color} />
                </View>
                <Text style={styles.quickSquareLabel} numberOfLines={1}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("alerts")}</Text>

          <View style={styles.alertCard}>
            <View style={[styles.alertIconCircle, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertMainTitle}>{t("medicationReminder")}</Text>
              <Text style={styles.alertMainSub}>{t("eveningDose")}</Text>
            </View>
          </View>
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("recentAlerts")}</Text>

          <View style={styles.recentList}>
            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#FACC15" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{t("reminder")}</Text>
                <Text style={styles.recentSub}>{t("measureAfterLunch")}</Text>
                <Text style={styles.recentTime}>{t("twoHoursAgo")}</Text>
              </View>
            </View>

            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#60A5FA" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{t("tip")}</Text>
                <Text style={styles.recentSub}>{t("drinkWater")}</Text>
                <Text style={styles.recentTime}>{t("fiveHoursAgo")}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

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
              <View style={styles.drawerLogoRow}>
                <Ionicons name="heart-outline" size={22} color="#E8A317" />
                <View style={{ marginLeft: 7 }}>
                  <Text style={styles.drawerLogoText}>{t("appName1")}</Text>
                  <Text style={styles.drawerLogoSub}>{t("appName2")}</Text>
                </View>
              </View>
              <Pressable style={styles.drawerCloseBtn} onPress={() => closeDrawer()}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.drawerScroll}>
              {/* Profile section */}
              <Text style={styles.drawerSection}>{t("profileNavigation")}</Text>
              {[
                { icon: "person-outline",  label: t("openProfile"),     route: "/profile" },
                { icon: "create-outline",  label: t("editProfile"),     route: "/edit-profile" },
                { icon: "pulse-outline",   label: t("medicalInfo"),     route: "/medical-info" },
                { icon: "leaf-outline",    label: t("lifestyleHabits"), route: "/lifestyle-habits" },
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
                { icon: "add-circle-outline",   label: t("addGlucose"),     route: "/add-glucose" },
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
                { icon: "restaurant-outline",  label: t("addMeal"),       route: "/add-meal" },
                { icon: "walk-outline",        label: t("addActivity"),   route: "/add-activity" },
                { icon: "moon-outline",        label: t("addSleep"),      route: "/add-sleep" },
              ].map(({ icon, label, route }) => (
                <Pressable key={route} style={styles.drawerItem}
                  onPress={() => closeDrawer(() => router.push(route as any))}>
                  <Ionicons name={icon as any} size={17} color={Colors.primary} />
                  <Text style={styles.drawerItemText}>{label}</Text>
                </Pressable>
              ))}

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
    marginTop: 28,
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

  // Quick Actions — compact square buttons
  quickRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  quickSquare: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    alignItems: "center",
    shadowColor: "#1A6FA8",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  quickSquareIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  quickSquareLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E3A52",
    textAlign: "center",
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

  legendHighBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },

  legendHighBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#EF4444",
  },

  trendEmpty: {
    alignItems: "center",
    paddingVertical: 24,
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
    justifyContent: "space-between",
    backgroundColor: "#1A6FA8",
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 14,
  },

  drawerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
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
});
