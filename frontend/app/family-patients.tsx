import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import { Colors } from "@/constants/Colors";
import { getLinkedPatients, removePatientLink } from "@/services/api";

type Patient = {
  link_id: string;
  patient_id: string;
  patient_name: string;
  linked_at: string | null;
};

export default function FamilyPatientsScreen() {
  const { t, i18n } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<Patient | null>(null);

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

  const confirmRemove = async () => {
    if (!confirmItem) return;
    try {
      setRemovingId(confirmItem.link_id);
      setConfirmItem(null);
      await removePatientLink(confirmItem.link_id);
      setPatients((prev) => prev.filter((p) => p.link_id !== confirmItem.link_id));
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
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
      <Pressable
        style={styles.removeBtn}
        onPress={(e) => { e.stopPropagation(); setConfirmItem(item); }}
        disabled={removingId === item.link_id}
        hitSlop={8}
      >
        {removingId === item.link_id ? (
          <ActivityIndicator size="small" color={Colors.error} />
        ) : (
          <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
        )}
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader />

      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="person-remove-outline" size={28} color="#D32F2F" />
            </View>
            <Text style={styles.modalTitle}>{t("removePatientConfirm")}</Text>
            <Text style={styles.modalMsg}>{t("removePatientConfirmSub")}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmItem(null)}>
                <Text style={styles.modalCancelText}>{t("cancelRemove")}</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteBtn} onPress={confirmRemove}>
                <Text style={styles.modalDeleteText}>{t("confirmRemove")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  removeBtn: {
    padding: 8,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: "#FFFFFF", borderRadius: 24,
    padding: 24, width: "100%", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#FDEDED", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0B1A2E", marginBottom: 8, textAlign: "center" },
  modalMsg: { fontSize: 14, color: "#4A6480", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  modalBtns: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: "#D6E8F5",
    alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: "#4A6480" },
  modalDeleteBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: "#D32F2F",
    alignItems: "center", justifyContent: "center",
  },
  modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
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
