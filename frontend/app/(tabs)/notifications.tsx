import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppHeader from "@/src/components/AppHeader";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "emergency_alert" | "glucose_reminder" | "prediction_alert" | "custom_reminder";

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
  emergency_alert:  { color: "#E53E3E", icon: "warning"       as const, bg: "#FFF5F5", light: "#FFF0F0" },
  prediction_alert: { color: "#D69E2E", icon: "trending-up"   as const, bg: "#FFFFF0", light: "#FEFCE8" },
  glucose_reminder: { color: "#1A6FA8", icon: "time"          as const, bg: "#EBF8FF", light: "#EBF3FA" },
  custom_reminder:  { color: "#6B46C1", icon: "alarm"         as const, bg: "#FAF5FF", light: "#FAF5FF" },
};

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({
  item, lang, t, onPress, styles,
}: {
  item: Notification; lang: string; t: any; onPress: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const isFalling = item.notifKey?.includes("falling") || item.notifKey?.includes("low_falling");
  const baseCfg = TYPE_CONFIG[item.type as NotifType] ?? {
    color: "#718096", icon: "notifications" as const, bg: "#F7FAFC", light: "#F7FAFC",
  };
  const cfg = item.type === "prediction_alert"
    ? { ...baseCfg, icon: (isFalling ? "trending-down" : "trending-up") as const }
    : baseCfg;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isCustomReminder = item.type === "custom_reminder";
  // Default reminder titles across all languages — if stored title matches any, re-translate it
  const DEFAULT_REMINDER_TITLES = ["Glucose Reminder", "تذكير قياس السكر", "תזכורת גלוקוז", "תזכורת סוכר"];
  const isDefaultTitle = !item.title || DEFAULT_REMINDER_TITLES.includes(item.title);
  const displayTitle = isCustomReminder
    ? (isDefaultTitle ? t("reminderNotifTitle") : item.title)
    : item.notifKey
      ? t(`notif_${item.notifKey}_title`, item.notifParams ?? {}, item.title)
      : item.title;
  const displayBody = isCustomReminder
    ? t("reminderNotifBody")
    : item.notifKey
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
  const lang = i18n.language;
  const { user } = useAuth();
  const isFamily = user?.role === "family_member";
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

  // Load on mount
  useEffect(() => { load(); }, [load]);

  // Refresh when screen comes into focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll every 30 seconds while on screen
  useEffect(() => {
    const id = setInterval(() => { load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

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

  const isAlertType    = (type: string) => type === "emergency_alert" || type === "prediction_alert";
  const isReminderType = (type: string) => type === "glucose_reminder" || type === "custom_reminder";

  const unread          = notifications.filter(n => !n.isRead).length;
  const alertCount      = notifications.filter(n => isAlertType(n.type)).length;
  const unreadAlerts    = notifications.filter(n => isAlertType(n.type) && !n.isRead).length;
  const reminderCount   = notifications.filter(n => isReminderType(n.type)).length;
  const unreadReminders = notifications.filter(n => isReminderType(n.type) && !n.isRead).length;

  // "emergency_alert" tab shows both emergency + prediction; "glucose_reminder" tab shows both reminder types
  const filtered = notifications.filter(n =>
    filter === "emergency_alert" ? isAlertType(n.type) : isReminderType(n.type)
  );

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
      <AppHeader unreadCount={unread} />

      {/* ── Tabs + Mark all — patients only ── */}
      {!isFamily && (
        <View style={styles.tabBar}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tab, active && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={17}
                    color={active ? tab.color : theme.textMuted}
                  />
                  <Text style={[styles.tabLabel, active && { color: tab.color, fontWeight: "700" }]}>
                    {tab.label}
                  </Text>
                  {tab.unread > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
                      <Text style={styles.tabBadgeText}>{tab.unread}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          {unread > 0 && (
            <Pressable style={styles.markAllRow} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={14} color="#1A6FA8" />
              <Text style={styles.markAllText}>{t("notif.markAll", "Mark all as read")}</Text>
            </Pressable>
          )}
        </View>
      )}

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

    // Mark all read button
    markAllRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-end", marginHorizontal: 14, marginTop: 10,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 12, backgroundColor: "#EBF3FA",
    },
    markAllText: { fontSize: 12, fontWeight: "600", color: "#1A6FA8" },

    // Tab bar
    tabBar: {
      backgroundColor: theme.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.border ?? "#E2E8F0",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    tabRow: {
      flexDirection: "row",
      gap: 4,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.textMuted,
    },
    tabBadge: {
      borderRadius: 9, minWidth: 18, height: 18,
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 5,
    },
    tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

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
      boxShadow: "0px 2px 6px rgba(0,0,0,0.06)",
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
