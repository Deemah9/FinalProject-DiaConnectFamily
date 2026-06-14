import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import AppHeader from "@/src/components/AppHeader";
import { getEstimatedA1C } from "@/services/api";
import { useAppTheme } from "@/hooks/useAppTheme";

const PRIMARY = "#1A6FA8";

// ADA colour thresholds
const TIR_COLORS = {
  very_low: "#7B1FA2",
  low:      "#E53935",
  in_range: "#2E7D32",
  high:     "#F57C00",
  very_high:"#B71C1C",
};

function a1cColor(a1c: number): string {
  if (a1c < 5.7) return "#16A34A";
  if (a1c < 6.5) return "#D97706";
  return "#DC2626";
}

function a1cBg(a1c: number): string {
  if (a1c < 5.7) return "#F0FDF4";
  if (a1c < 6.5) return "#FFFBEB";
  return "#FEF2F2";
}

export default function A1CScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await getEstimatedA1C();
        setData(result);
      } catch (e: any) {
        setError(e?.message || "Failed to load A1C data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tir = data?.time_in_range;
  const a1c: number | null = data?.estimated_a1c ?? null;
  const label =
    a1c == null
      ? ""
      : a1c < 5.7
      ? t("a1cNormal")
      : a1c < 6.5
      ? t("a1cPrediabetes")
      : t("a1cDiabetes");

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("a1cTitle")}</Text>
          <Text style={styles.screenSub}>{t("a1cSubtitle")}</Text>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 60 }} />
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && data?.estimated_a1c == null && (
          <View style={styles.emptyBox}>
            <Ionicons name="analytics-outline" size={48} color={theme.border} />
            <Text style={styles.emptyText}>{t("a1cNoData")}</Text>
          </View>
        )}

        {!loading && !error && a1c != null && (
          <>
            {/* Unreliable warning */}
            {!data.is_reliable && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color="#92400E" />
                <Text style={styles.warningText}>{t("a1cUnreliable")}</Text>
              </View>
            )}

            {/* Big A1C circle */}
            <View style={[styles.a1cCard, { backgroundColor: a1cBg(a1c) }]}>
              <Text style={styles.a1cLabel}>{t("a1cResult")}</Text>
              <View style={[styles.a1cCircle, { borderColor: a1cColor(a1c) }]}>
                <Text style={[styles.a1cValue, { color: a1cColor(a1c) }]}>
                  {a1c.toFixed(1)}%
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: a1cColor(a1c) }]}>
                <Text style={styles.statusBadgeText}>{label}</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatBox
                icon="pulse-outline"
                label={t("a1cAvgGlucose")}
                value={`${data.average_glucose} mg/dL`}
                styles={styles}
              />
              <StatBox
                icon="calendar-outline"
                label={t("a1cDaysCovered")}
                value={`${data.days_covered}`}
                styles={styles}
              />
              <StatBox
                icon="document-text-outline"
                label={t("a1cReadingsCount")}
                value={`${data.readings_count}`}
                styles={styles}
              />
            </View>

            {/* Time in Range */}
            {tir && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("timeInRange")}</Text>

                <TirRow
                  color={TIR_COLORS.very_low}
                  label={t("tirVeryLow")}
                  pct={tir.very_low}
                  styles={styles}
                />
                <TirRow
                  color={TIR_COLORS.low}
                  label={t("tirLow")}
                  pct={tir.low}
                  styles={styles}
                />
                <TirRow
                  color={TIR_COLORS.in_range}
                  label={t("tirInRange")}
                  pct={tir.in_range}
                  styles={styles}
                />
                <TirRow
                  color={TIR_COLORS.high}
                  label={t("tirHigh")}
                  pct={tir.high}
                  styles={styles}
                />
                <TirRow
                  color={TIR_COLORS.very_high}
                  label={t("tirVeryHigh")}
                  pct={tir.very_high}
                  styles={styles}
                />

                {/* Stacked bar */}
                <View style={styles.stackedBar}>
                  {(["very_low","low","in_range","high","very_high"] as const).map((k) => (
                    tir[k] > 0 && (
                      <View
                        key={k}
                        style={{
                          width: `${tir[k]}%`,
                          height: "100%",
                          backgroundColor: TIR_COLORS[k],
                        }}
                      />
                    )
                  ))}
                </View>
              </View>
            )}

            {/* Disclaimer */}
            <View style={styles.disclaimerBox}>
              <Ionicons name="information-circle-outline" size={15} color="#64748B" />
              <Text style={styles.disclaimerText}>{t("a1cDisclaimer")}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, label, value, styles }: { icon: any; label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={PRIMARY} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TirRow({ color, label, pct, styles }: { color: string; label: string; pct: number; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.tirRow}>
      <View style={[styles.tirDot, { backgroundColor: color }]} />
      <Text style={styles.tirLabel}>{label}</Text>
      <Text style={styles.tirPct}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },

    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },

    hero: { marginTop: 24, marginBottom: 20 },

    screenTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },

    screenSub: { fontSize: 13, color: theme.textMuted },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#FDEDED",
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
    },

    errorText: { color: "#B91C1C", fontSize: 13, flex: 1 },

    emptyBox: {
      alignItems: "center",
      marginTop: 60,
      gap: 14,
    },

    emptyText: { color: theme.textMuted, fontSize: 14, textAlign: "center" },

    warningBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "#FFFBEB",
      borderWidth: 1,
      borderColor: "#FDE68A",
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
    },

    warningText: { color: "#92400E", fontSize: 12, flex: 1 },

    // A1C Big Card
    a1cCard: {
      borderRadius: 24,
      padding: 28,
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.bgSoft,
    },

    a1cLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 18,
    },

    a1cCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgCard,
      marginBottom: 18,
      shadowColor: theme.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    a1cValue: {
      fontSize: 38,
      fontWeight: "800",
    },

    statusBadge: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
    },

    statusBadgeText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    // Stats row
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },

    statBox: {
      flex: 1,
      backgroundColor: theme.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 14,
      alignItems: "center",
      gap: 6,
    },

    statValue: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },

    statLabel: {
      fontSize: 10,
      color: theme.textMuted,
      textAlign: "center",
    },

    // TIR card
    card: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 20,
      marginBottom: 16,
    },

    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.textSecondary,
      marginBottom: 14,
    },

    tirRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 10,
    },

    tirDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },

    tirLabel: { flex: 1, fontSize: 12, color: theme.textSecondary },

    tirPct: { fontSize: 13, fontWeight: "700", color: theme.text },

    stackedBar: {
      flexDirection: "row",
      height: 14,
      borderRadius: 7,
      overflow: "hidden",
      marginTop: 10,
      backgroundColor: theme.bg,
    },

    // Disclaimer
    disclaimerBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.bgAlt,
      borderRadius: 14,
      padding: 12,
    },

    disclaimerText: { color: "#64748B", fontSize: 11, flex: 1, lineHeight: 17 },
  });
}
