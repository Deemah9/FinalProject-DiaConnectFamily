import { useAuth } from "@/context/AuthContext";
import { useDrawer } from "@/context/DrawerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  FlatList,
  I18nManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "emergency_alert" | "glucose_reminder";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  glucoseValue?: number;
  isRead: boolean;
  createdAt: string;
  patientName?: string;
  notifKey?: string;
  notifParams?: Record<string, any>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string, lang: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const isAr = lang === "ar";
  const isHe = lang === "he";

  if (diff < 60) return isAr ? "الآن" : isHe ? "עכשיו" : "Just now";
  const mins = Math.floor(diff / 60);
  if (diff < 3600) {
    if (isAr) return mins === 1 ? "منذ دقيقة" : `منذ ${mins} دقائق`;
    if (isHe) return `לפני ${mins} דקות`;
    return `${mins}m ago`;
  }
  const hrs = Math.floor(diff / 3600);
  if (diff < 86400) {
    if (isAr) return hrs === 1 ? "منذ ساعة" : `منذ ${hrs} ساعات`;
    if (isHe) return `לפני ${hrs} שעות`;
    return `${hrs}h ago`;
  }
  const days = Math.floor(diff / 86400);
  if (isAr) return days === 1 ? "منذ يوم" : `منذ ${days} أيام`;
  if (isHe) return `לפני ${days} ימים`;
  return `${days}d ago`;
}

const TYPE_CONFIG = {
  emergency_alert: { color: "#E53E3E", icon: "warning" as const, bg: "#FFF5F5", light: "#FFF0F0" },
  glucose_reminder: { color: "#1A6FA8", icon: "time" as const, bg: "#EBF8FF", light: "#EBF3FA" },
};

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({
  item, lang, t, onPress, styles,
}: {
  item: Notification; lang: string; t: any; onPress: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cfg = TYPE_CONFIG[item.type as NotifType] ?? {
    color: "#718096", icon: "notifications" as const, bg: "#F7FAFC", light: "#F7FAFC",
  };
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const displayTitle = item.notifKey
    ? t(`notif_${item.notifKey}_title`, item.notifParams ?? {}, item.title)
    : item.title;
  const displayBody = item.notifKey
    ? t(`notif_${item.notifKey}_body`, item.notifParams ?? {}, item.body)
    : item.body;

  useEffect(() => {
    if (!item.isRead) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [item.isRead]);

  return (
    <Pressable
      onPress={() => !item.isRead && onPress(item.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.card, !item.isRead && { backgroundColor: cfg.bg }]}>
        {/* Left color bar */}
        <View style={[styles.cardBar, { backgroundColor: cfg.color }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.color + "18" }]}>
          {!item.isRead && (
            <Animated.View style={[styles.pulseDot, { backgroundColor: cfg.color, opacity: pulseAnim }]} />
          )}
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: cfg.color }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text style={styles.cardTime}>{relativeTime(item.createdAt, lang)}</Text>
          </View>

          {item.patientName && (
            <View style={[styles.patientBadge, { backgroundColor: cfg.color + "12" }]}>
              <Ionicons name="person-outline" size={11} color={cfg.color} />
              <Text style={[styles.patientText, { color: cfg.color }]}>{item.patientName}</Text>
            </View>
          )}

          <Text style={styles.cardBody} numberOfLines={2}>{displayBody}</Text>

          {item.glucoseValue != null && (
            <View style={[styles.glucosePill, { backgroundColor: cfg.color }]}>
              <Ionicons name="water-outline" size={11} color="#fff" />
              <Text style={styles.glucoseText}>{item.glucoseValue} mg/dL</Text>
            </View>
          )}
        </View>

        {/* Unread dot */}
        {!item.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />
        )}
      </View>
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({
  filter, t, isFamily, styles,
}: {
  filter: NotifType; t: any; isFamily: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const cfg = TYPE_CONFIG[filter];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -8, duration: 900, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const emptyIcon = filter === "emergency_alert" ? "shield-checkmark-outline" : "alarm-outline";
  const emptyMsg = filter === "emergency_alert"
    ? (isFamily
        ? t("notif.emptyAlertsFamily", "All patients have normal glucose")
        : t("notif.emptyAlerts", "No alerts — glucose is in range"))
    : t("notif.emptyReminders", "No reminders yet");
  const emptySub = isFamily
    ? t("notif.emptySubFamily", "You'll be notified when a patient has dangerous glucose levels")
    : t("notif.emptySub", "You'll see glucose reminders and alerts here");

  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={[styles.emptyIcon, { backgroundColor: cfg.color + "14", transform: [{ translateY: bounceAnim }] }]}>
        <Ionicons name={emptyIcon} size={42} color={cfg.color} />
      </Animated.View>
      <Text style={styles.emptyTitle}>{emptyMsg}</Text>
      <Text style={styles.emptySub}>{emptySub}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { top } = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const lang = i18n.language;
  const { user } = useAuth();
  const isFamily = user?.role === "family_member";
  const { openDrawer, openLang } = useDrawer();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotifType>("emergency_alert");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const unread          = notifications.filter(n => !n.isRead).length;
  const alertCount      = notifications.filter(n => n.type === "emergency_alert").length;
  const unreadAlerts    = notifications.filter(n => n.type === "emergency_alert" && !n.isRead).length;
  const reminderCount   = notifications.filter(n => n.type === "glucose_reminder").length;
  const unreadReminders = notifications.filter(n => n.type === "glucose_reminder" && !n.isRead).length;

  const filtered = notifications.filter(n => n.type === filter);

  const tabs = [
    {
      key: "emergency_alert" as NotifType,
      label: t("notif.emergency", "Alerts"),
      icon: "warning" as const,
      total: alertCount,
      unread: unreadAlerts,
      color: "#E53E3E",
    },
    {
      key: "glucose_reminder" as NotifType,
      label: t("notif.reminder", "Reminders"),
      icon: "time" as const,
      total: reminderCount,
      unread: unreadReminders,
      color: "#1A6FA8",
    },
  ];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <LinearGradient colors={["#1A6FA8", "#1A6FA8"]} style={[styles.header, { paddingTop: top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t("notif.title", "Notifications")}</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread}</Text>
              </View>
            )}
          </View>
          {isFamily ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable style={styles.backBtn} onPress={openLang}>
                <Ionicons name="earth-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable style={styles.backBtn} onPress={openDrawer}>
                <Ionicons name="menu-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          ) : unread > 0 ? (
            <Pressable style={styles.markReadBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* ── Segmented Tabs — patients only ── */}
        {!isFamily && (
          <View style={styles.segmentWrap}>
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setFilter(tab.key)}
                >
                  <View style={[styles.segmentIconWrap, active
                    ? { backgroundColor: tab.color + "22" }
                    : { backgroundColor: "rgba(255,255,255,0.12)" }
                  ]}>
                    <Ionicons
                      name={tab.icon}
                      size={18}
                      color={active ? tab.color : "rgba(255,255,255,0.7)"}
                    />
                  </View>
                  <Text style={[styles.segmentLabel, active && { color: theme.text, fontWeight: "700" }]}>
                    {tab.label}
                  </Text>
                  {tab.unread > 0 && (
                    <View style={[styles.segmentBadge, { backgroundColor: tab.color }]}>
                      <Text style={styles.segmentBadgeText}>{tab.unread}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </LinearGradient>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t("notif.loading", "Loading...")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={filtered.length === 0 ? { flex: 1 } : undefined}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1A6FA8"]} />}
          renderItem={({ item }) => (
            <NotifCard item={item} lang={lang} t={t} onPress={handleMarkOneRead} styles={styles} />
          )}
          ListEmptyComponent={<EmptyState filter={filter} t={t} isFamily={isFamily} styles={styles} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },

    // Header
    header: { paddingBottom: 0 },
    headerRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingBottom: 14,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    headerCenter: {
      flex: 1, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8,
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    unreadBadge: {
      backgroundColor: "#E53E3E", borderRadius: 10,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    markReadBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.15)",
    },

    // Segmented control
    segmentWrap: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 16,
      backgroundColor: "rgba(0,0,0,0.18)",
      borderRadius: 18,
      padding: 5,
      gap: 4,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 14,
      gap: 7,
    },
    segmentActive: {
      backgroundColor: theme.bgCard,
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    segmentIconWrap: {
      width: 30, height: 30, borderRadius: 9,
      alignItems: "center", justifyContent: "center",
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.75)",
    },
    segmentBadge: {
      borderRadius: 9, minWidth: 18, height: 18,
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 5,
    },
    segmentBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

    // List
    listContent: { padding: 14, gap: 10 },
    emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: 120 },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: theme.textLight, fontSize: 14 },

    // Card
    card: {
      flexDirection: "row",
      backgroundColor: theme.bgCard,
      borderRadius: 18,
      overflow: "hidden",
      elevation: 2,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    cardBar: { width: 4 },
    iconWrap: {
      width: 54, alignItems: "center",
      justifyContent: "center", position: "relative",
    },
    pulseDot: {
      position: "absolute", top: 10, right: 8,
      width: 8, height: 8, borderRadius: 4,
    },
    cardContent: { flex: 1, padding: 12, gap: 5 },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { fontSize: 13, fontWeight: "700", flex: 1, marginEnd: 6 },
    cardTime: { fontSize: 11, color: theme.placeholder },
    cardBody: { fontSize: 12, color: theme.textMuted, lineHeight: 17 },

    patientBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      alignSelf: "flex-start", borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    patientText: { fontSize: 11, fontWeight: "700" },

    glucosePill: {
      flexDirection: "row", alignItems: "center", gap: 4,
      alignSelf: "flex-start", borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    glucoseText: { color: "#fff", fontSize: 11, fontWeight: "700" },

    unreadDot: {
      width: 8, height: 8, borderRadius: 4,
      alignSelf: "center", marginRight: 12,
    },

    // Empty
    emptyWrap: { alignItems: "center", gap: 12, paddingTop: 70 },
    emptyIcon: {
      width: 88, height: 88, borderRadius: 44,
      alignItems: "center", justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.textMuted, textAlign: "center", paddingHorizontal: 32 },
    emptySub: { fontSize: 13, color: theme.placeholder, textAlign: "center", paddingHorizontal: 40 },
  });
}
