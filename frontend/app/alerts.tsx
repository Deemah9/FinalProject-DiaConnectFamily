import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppHeader from "@/src/components/AppHeader";
import { getAlerts, markAllMyAlertsRead } from "@/services/api";

export default function AlertsScreen() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAll, setShowAll] = useState(false);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getAlerts(50);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadAlerts(); }, []));

  const formatTime = (raw: any) => {
    if (!raw) return "--";
    const ts = raw?._seconds ? new Date(raw._seconds * 1000).toISOString() : raw;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const hasUnread = alerts.some((a) => !a.read);
  const visible   = showAll ? alerts : alerts.slice(0, 5);

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("glucoseAlerts")}</Text>
            <Text style={styles.screenSub}>{t("glucoseAlertsSub")}</Text>
          </View>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications-outline" size={18} color="#1A6FA8" />
            <Text style={styles.cardTitle}>{t("recentAlerts")}</Text>
            {hasUnread && (
              <Pressable
                style={styles.readAllBtn}
                onPress={async () => {
                  try {
                    await markAllMyAlertsRead();
                    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
                  } catch {}
                }}
              >
                <Text style={styles.readAllText}>{t("markAsRead")}</Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#1A6FA8" style={{ marginVertical: 16 }} />
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#0D9E6E" />
              <Text style={styles.emptyTitle}>{t("noAlerts")}</Text>
              <Text style={styles.emptySub}>{t("noAlertsSub")}</Text>
            </View>
          ) : (
            <>
              {visible.map((alert, idx) => {
                const isHigh = alert?.type === "high";
                const color  = isHigh ? "#D32F2F" : "#E07B00";
                const bg     = isHigh ? "#FDEDED" : "#FEF3E2";
                const label  = isHigh ? t("highGlucose") : t("lowGlucose");
                return (
                  <View key={alert?.id || idx} style={[styles.alertRow, { backgroundColor: bg }]}>
                    <Ionicons name={isHigh ? "arrow-up-circle" : "arrow-down-circle"} size={22} color={color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertLabel, { color }]}>{label}</Text>
                      <Text style={styles.alertTime}>{formatTime(alert?.createdAt)}</Text>
                    </View>
                    <View style={[styles.valueBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.valueText, { color }]}>{alert?.value}</Text>
                      <Text style={[styles.valueUnit, { color }]}>mg/dL</Text>
                    </View>
                  </View>
                );
              })}

              {alerts.length > 5 && (
                <Pressable style={styles.showMoreBtn} onPress={() => setShowAll((v) => !v)}>
                  <Text style={styles.showMoreText}>
                    {showAll ? t("showLess") : t("showPreviousAlerts")}
                  </Text>
                  <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color="#1A6FA8" />
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
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
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#D6E8F5",
  },
  backBtnText: { color: "#1A6FA8", fontSize: 14, fontWeight: "600" },

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

  readAllBtn: { marginLeft: "auto" as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#EBF3FA" },
  readAllText: { fontSize: 12, color: "#1A6FA8", fontWeight: "600" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: "700", color: "#0B1A2E" },
  emptySub: { marginTop: 6, fontSize: 12, color: "#4A6480" },

  alertRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, marginBottom: 10, gap: 12,
  },
  alertLabel: { fontSize: 13, fontWeight: "700" },
  alertTime: { fontSize: 12, color: "#7A96B0", marginTop: 2 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#1A6FA8" },

  valueBadge: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  valueText: { fontSize: 16, fontWeight: "800" },
  valueUnit: { fontSize: 10, fontWeight: "500" },

  showMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, marginTop: 4 },
  showMoreText: { fontSize: 13, color: "#1A6FA8", fontWeight: "600" },
});
