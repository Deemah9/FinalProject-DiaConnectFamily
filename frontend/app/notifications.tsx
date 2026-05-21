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
} from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "glucose_reminder" | "emergency_alert" | "all";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  glucoseValue?: number;
  isRead: boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string, t: any): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t("notif.justNow", "Just now");
  if (diff < 3600) return t("notif.minutesAgo", { count: Math.floor(diff / 60) }, `${Math.floor(diff / 60)}m ago`);
  if (diff < 86400) return t("notif.hoursAgo", { count: Math.floor(diff / 3600) }, `${Math.floor(diff / 3600)}h ago`);
  return t("notif.daysAgo", { count: Math.floor(diff / 86400) }, `${Math.floor(diff / 86400)}d ago`);
}

const TYPE_CONFIG: Record<string, { color: string; icon: any; bg: string }> = {
  emergency_alert: { color: "#E53E3E", icon: "warning", bg: "#FFF5F5" },
  glucose_reminder: { color: "#3182CE", icon: "time", bg: "#EBF8FF" },
};

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({ item, t }: { item: Notification; t: any }) {
  const cfg = TYPE_CONFIG[item.type] ?? { color: "#718096", icon: "notifications", bg: "#F7FAFC" };
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!item.isRead) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [item.isRead]);

  return (
    <View style={[styles.card, { backgroundColor: item.isRead ? "#FFFFFF" : cfg.bg }]}>
      <View style={[styles.cardBorder, { backgroundColor: cfg.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + "20" }]}>
        {!item.isRead && (
          <Animated.View style={[styles.pulseDot, { backgroundColor: cfg.color, opacity: pulseAnim }]} />
        )}
        <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: cfg.color }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardTime}>
            {relativeTime(item.createdAt, t)}
          </Text>
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        {item.glucoseValue != null && (
          <View style={[styles.glucoseBadge, { backgroundColor: cfg.color }]}>
            <Text style={styles.glucoseBadgeText}>{item.glucoseValue} mg/dL</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ t }: { t: any }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <Ionicons name="notifications-off-outline" size={72} color="#CBD5E0" />
      </Animated.View>
      <Text style={styles.emptyTitle}>{t("notif.emptyTitle", "No notifications yet")}</Text>
      <Text style={styles.emptySub}>{t("notif.emptySub", "You'll see glucose reminders and alerts here")}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotifType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const filterAnim = useRef(new Animated.Value(0)).current;

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

  const handleFilterChange = (f: NotifType, idx: number) => {
    setFilter(f);
    Animated.spring(filterAnim, { toValue: idx, useNativeDriver: true }).start();
  };

  const filtered = filter === "all" ? notifications : notifications.filter(n => n.type === filter);
  const unread = notifications.filter(n => !n.isRead).length;

  const tabs: { key: NotifType; label: string }[] = [
    { key: "all", label: t("notif.all", "All") },
    { key: "emergency_alert", label: t("notif.emergency", "Alerts") },
    { key: "glucose_reminder", label: t("notif.reminder", "Reminders") },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#1A6FA8", "#0D4F7C"]} style={[styles.header, { paddingTop: top + 12 }]}>
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
          {unread > 0 ? (
            <Pressable style={styles.markReadBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{notifications.filter(n => n.type === "emergency_alert").length}</Text>
            <Text style={styles.statLabel}>{t("notif.alerts", "Alerts")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{notifications.filter(n => n.type === "glucose_reminder").length}</Text>
            <Text style={styles.statLabel}>{t("notif.reminders", "Reminders")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{unread}</Text>
            <Text style={styles.statLabel}>{t("notif.unread", "Unread")}</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          {tabs.map((tab, idx) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, filter === tab.key && styles.tabActive]}
              onPress={() => handleFilterChange(tab.key, idx)}
            >
              <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.key !== "all" && (
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: tab.key === "emergency_alert" ? "#E53E3E" : "#3182CE" }
                ]}>
                  <Text style={styles.tabBadgeText}>
                    {notifications.filter(n => n.type === tab.key).length}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t("notif.loading", "Loading...")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1A6FA8"]} />}
          ListEmptyComponent={<EmptyState t={t} />}
          renderItem={({ item }) => <NotifCard item={item} t={t} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },

  // Header
  header: { paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  unreadBadge: { backgroundColor: "#E53E3E", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  markReadBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },

  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 24, paddingBottom: 16, justifyContent: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 4 },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, paddingBottom: 0 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 5, backgroundColor: "rgba(255,255,255,0.1)" },
  tabActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  tabBadge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // List
  listContent: { padding: 12, gap: 10 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#718096", fontSize: 14 },

  // Card
  card: { flexDirection: "row", borderRadius: 16, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  cardBorder: { width: 4 },
  iconWrap: { width: 52, alignItems: "center", justifyContent: "center", position: "relative" },
  pulseDot: { position: "absolute", top: 10, right: 8, width: 8, height: 8, borderRadius: 4 },
  cardContent: { flex: 1, padding: 12, gap: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 13, fontWeight: "700", flex: 1, marginEnd: 6 },
  cardTime: { fontSize: 11, color: "#A0AEC0" },
  cardBody: { fontSize: 12, color: "#4A5568", lineHeight: 17 },
  glucoseBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  glucoseBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // Empty
  emptyWrap: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#4A5568" },
  emptySub: { fontSize: 13, color: "#A0AEC0", textAlign: "center", paddingHorizontal: 40 },
});
