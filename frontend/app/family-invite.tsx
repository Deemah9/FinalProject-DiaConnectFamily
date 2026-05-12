import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import { Colors } from "@/constants/Colors";
import { generateFamilyCode, getFamilyMembers, removeFamilyMember } from "@/services/api";

export default function FamilyInviteScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState<string | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [])
  );

  const loadMembers = async () => {
    try {
      const data = await getFamilyMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setCopied(false);
      const res = await generateFamilyCode();
      setCode(res.code);
      setExpiryMinutes(res.expires_in_minutes);
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await Share.share({ message: code });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!code) return;
    const storeLink = "https://expo.go";
    const message = t("shareMessage", { code, storeLink });
    await Share.share({ message });
  };

  const confirmRemove = async () => {
    if (!confirmId) return;
    try {
      setRemovingId(confirmId);
      setConfirmId(null);
      await removeFamilyMember(confirmId);
      setMembers((prev) => prev.filter((m) => m.link_id !== confirmId));
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <AppHeader />

      {/* Pairing Code Card — only shown after generation */}
      {code && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("pairingCode")}</Text>
          <View style={styles.codeRow}>
            {code.split("").map((char, i) => (
              <View key={i} style={styles.codeBox}>
                <Text style={styles.codeChar}>{char}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.expiryNote}>
            {t("codeExpiryNote", { minutes: expiryMinutes })}
          </Text>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.generateBtn, { flex: code ? 1 : undefined, width: code ? undefined : "100%" }, loading && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateBtnText}>
              {code ? t("generateNewCode") : t("generateCode")}
            </Text>
          )}
        </Pressable>

        {code && (
          <Pressable style={[styles.shareBtn, { flex: 1 }]} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>{t("shareCode")}</Text>
          </Pressable>
        )}
      </View>

      {/* Confirm Remove Modal */}
      <Modal visible={!!confirmId} transparent animationType="fade" onRequestClose={() => setConfirmId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="person-remove-outline" size={28} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>{t("removeMemberConfirm")}</Text>
            <Text style={styles.modalMsg}>{t("removeMemberConfirmSub")}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmId(null)}>
                <Text style={styles.modalCancelText}>{t("cancelRemove")}</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteBtn} onPress={confirmRemove}>
                <Text style={styles.modalDeleteText}>{t("confirmRemove")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Family Members List */}
      <View style={styles.membersSection}>
        <View style={styles.membersSectionHeader}>
          <Ionicons name="people-outline" size={18} color={Colors.primary} />
          <Text style={styles.membersSectionTitle}>{t("myFamilyMembers")}</Text>
          {members.length > 0 && (
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>{members.length}</Text>
            </View>
          )}
        </View>

        {members.length === 0 ? (
          <View style={styles.emptyMembers}>
            <Ionicons name="person-add-outline" size={28} color="#B8D0E8" />
            <Text style={styles.emptyMembersText}>{t("noFamilyMembers")}</Text>
          </View>
        ) : (
          members.map((m) => (
            <View key={m.link_id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {m.family_member_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.family_member_name}</Text>
                {m.linked_at && (
                  <Text style={styles.memberDate}>
                    {t("linkedOn", { date: formatDate(m.linked_at) })}
                  </Text>
                )}
              </View>
              <Pressable
                style={styles.removeBtn}
                onPress={() => setConfirmId(m.link_id)}
                disabled={removingId === m.link_id}
              >
                {removingId === m.link_id ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Ionicons name="person-remove-outline" size={18} color={Colors.error} />
                )}
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 40 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: Colors.textSecondary, marginBottom: 20 },
  codeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  codeBox: {
    width: 44, height: 52, borderRadius: 12,
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  codeChar: { fontSize: 22, fontWeight: "700", color: Colors.text, letterSpacing: 1 },
  copyBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20, marginBottom: 14,
  },
  copyBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  expiryNote: { fontSize: 13, color: Colors.primary, fontWeight: "500" },
  placeholder: { fontSize: 14, color: Colors.textMuted, textAlign: "center", marginVertical: 16 },

  errorText: { color: Colors.error, textAlign: "center", marginTop: 12, fontSize: 13 },

  actionRow: {
    flexDirection: "row", gap: 10,
    marginHorizontal: 20, marginTop: 16,
  },
  generateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Family members section
  membersSection: {
    marginHorizontal: 20, marginTop: 32,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  membersSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16,
  },
  membersSectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 },
  memberCountBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
  },
  memberCountText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  emptyMembers: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyMembersText: { fontSize: 13, color: Colors.textMuted, textAlign: "center" },

  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  memberAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  memberName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  memberDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 8 },

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
    backgroundColor: Colors.error,
    alignItems: "center", justifyContent: "center",
  },
  modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
