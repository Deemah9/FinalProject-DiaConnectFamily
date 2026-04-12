import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppHeader from "@/src/components/AppHeader";
import { getAlerts } from "@/services/api";

export default function AlertsScreen() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getAlerts(20);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadAlerts(); }, []));

  const formatTime = (raw: string) => {
    if (!raw) return "--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const alertConfig = (type: string) => {
    if (type === "high") {
      return {
        icon: "arrow-up-circle-outline" as const,
        color: "#D32F2F",
        bg: "#FDEDED",
        label: t("highGlucose"),
      };
    }
    return {
      icon: "arrow-down-circle-outline" as const,
      color: "#E07B00",
      bg: "#FEF3E2",
      label: t("lowGlucose"),
    };
  };

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Title row */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("glucoseAlerts")}</Text>
            <Text style={styles.screenSub}>{t("glucoseAlertsSub")}</Text>
          </View>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={16} color="#1A6FA8" />
            <Text style={styles.backBtnText}>{t("back")}</Text>
          </Pressable>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="notifications-outline"
              size={18}
              color="#1A6FA8"
            />
            <Text style={styles.cardTitle}>{t("recentAlerts")}</Text>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>{t("loadingAlerts")}</Text>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle-outline"
                size={36}
                color="#0D9E6E"
              />
              <Text style={styles.emptyTitle}>{t("noAlerts")}</Text>
              <Text style={styles.emptySub}>{t("noAlertsSub")}</Text>
            </View>
          ) : (
            alerts.map((alert, idx) => {
              const cfg = alertConfig(alert?.type);
              return (
                <View
                  key={alert?.id || idx}
                  style={styles.alertRow}
                >
                  <View
                    style={[
                      styles.alertIconWrap,
                      { backgroundColor: cfg.bg },
                    ]}
                  >
                    <Ionicons
                      name={cfg.icon}
                      size={20}
                      color={cfg.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertType, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                    <Text style={styles.alertTime}>
                      {formatTime(
                        alert?.createdAt?._seconds
                          ? new Date(
                              alert.createdAt._seconds * 1000
                            ).toISOString()
                          : alert?.createdAt
                      )}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.valueBadge,
                      { backgroundColor: cfg.bg },
                    ]}
                  >
                    <Text style={[styles.valueText, { color: cfg.color }]}>
                      {alert?.value}
                    </Text>
                    <Text style={[styles.valueUnit, { color: cfg.color }]}>
                      mg/dL
                    </Text>
                  </View>
                </View>
              );
            })
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
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  screenTitle: {
    color: "#0B1A2E",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  screenSub: { color: "#4A6480", fontSize: 14 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E8F5",
  },
  backBtnText: { color: "#1A6FA8", fontSize: 14, fontWeight: "600" },

  errorBox: {
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B1A2E" },
  loadingText: { fontSize: 14, color: "#4A6480" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1A2E",
  },
  emptySub: { marginTop: 6, fontSize: 12, color: "#4A6480" },

  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F9FD",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 12,
  },
  alertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertType: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  alertTime: { fontSize: 12, color: "#7A96B0" },
  valueBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  valueText: { fontSize: 16, fontWeight: "800" },
  valueUnit: { fontSize: 10, fontWeight: "500" },
});
