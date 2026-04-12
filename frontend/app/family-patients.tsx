import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import { Colors } from "@/constants/Colors";
import { getLinkedPatients } from "@/services/api";

type Patient = {
  patient_id: string;
  patient_name: string;
  linked_at: string | null;
};

export default function FamilyPatientsScreen() {
  const { t, i18n } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getLinkedPatients();
      setPatients(data);
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(i18n.language === "he" ? "he-IL" : i18n.language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderItem = ({ item }: { item: Patient }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/family-patient-glucose" as any,
          params: {
            patientId: item.patient_id,
            patientName: item.patient_name,
          },
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.patient_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.patient_name}</Text>
        {item.linked_at && (
          <Text style={styles.date}>
            {t("linkedSince", { date: formatDate(item.linked_at) })}
          </Text>
        )}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );

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
      ) : patients.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>{t("noPatients")}</Text>
          <Text style={styles.emptySubText}>{t("noPatientsSubtext")}</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.patient_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
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
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  arrow: {
    fontSize: 22,
    color: Colors.textLight,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  errorText: {
    color: Colors.error,
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
