import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import { Colors } from "@/constants/Colors";
import { viewWithCode } from "@/services/api";

type Reading = {
  id: string;
  value: number;
  unit: string;
  measuredAt: string | null;
  source: string;
};

function getStatusColors(value: number): { color: string; bg: string; key: string } {
  if (value < 70)  return { color: Colors.statusLow,    bg: Colors.statusLowBg,    key: "low" };
  if (value > 180) return { color: Colors.statusHigh,   bg: Colors.statusHighBg,   key: "high" };
  return           { color: Colors.statusNormal, bg: Colors.statusNormalBg, key: "normal" };
}

export default function FamilyPatientGlucoseScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : i18n.language === "ar" ? "ar-SA" : "en-US";
  const { patientId, patientName, familyCode } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    familyCode?: string;
  }>();

  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      load();
    }, [patientId, familyCode])
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      if (familyCode) {
        // Unauthenticated access via pairing code
        const res = await viewWithCode(familyCode);
        setReadings(res.readings);
      } else {
        setError(t("invalidCode"));
      }
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const latest = readings[0];

  const renderItem = ({ item }: { item: Reading }) => {
    const { color, bg, key } = getStatusColors(item.value);
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowValue}>
            {item.value}{" "}
            <Text style={styles.rowUnit}>{item.unit}</Text>
          </Text>
          <Text style={styles.rowTime}>{formatTime(item.measuredAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeText, { color }]}>{t(key)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={Colors.primary}
        />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {latest && (
            <View style={styles.latestCard}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.latestLabel}>{t("latestReading")}</Text>
              <Text
                style={[
                  styles.latestValue,
                  { color: getStatusColors(latest.value).color },
                ]}
              >
                {latest.value}
              </Text>
              <Text style={styles.latestUnit}>{latest.unit}</Text>
              <Text style={styles.latestTime}>
                {formatTime(latest.measuredAt)}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>{t("fullHistory")}</Text>

          <FlatList
            data={readings}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t("noReadings")}</Text>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loader: {
    marginTop: 60,
  },
  latestCard: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
  },
  latestLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  latestValue: {
    fontSize: 52,
    fontWeight: "700",
  },
  latestUnit: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
  },
  latestTime: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  row: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    gap: 3,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  rowUnit: {
    fontSize: 13,
    fontWeight: "400",
    color: Colors.textMuted,
  },
  rowTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textMuted,
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
