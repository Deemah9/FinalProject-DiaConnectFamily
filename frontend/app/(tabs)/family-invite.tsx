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
import { generateFamilyCode, getFamilyMembers, removeFamilyMember } from "@/services/api";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function FamilyInviteScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

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
              <Ionicons name="person-remove-outline" size={28} color="#D32F2F" />
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
          <Ionicons name="people-outline" size={18} color="#1A6FA8" />
          <Text style={styles.membersSectionTitle}>{t("myFamilyMembers")}</Text>
          {members.length > 0 && (
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>{members.length}</Text>
            </View>
          )}
        </View>

        {members.length === 0 ? (
          <View style={styles.emptyMembers}>
            <Ionicons name="person-add-outline" size={28} color={theme.border} />
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
                  <ActivityIndicator size="small" color="#D32F2F" />
                ) : (
                  <Ionicons name="person-remove-outline" size={18} color="#D32F2F" />
                )}
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { paddingBottom: 40 },

  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: theme.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: theme.textSecondary, marginBottom: 20 },
  codeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  codeBox: {
    width: 44, height: 52, borderRadius: 12,
    backgroundColor: theme.bg, borderWidth: 1.5, borderColor: theme.border,
    alignItems: "center", justifyContent: "center",
  },
  codeChar: { fontSize: 22, fontWeight: "700", color: theme.text, letterSpacing: 1 },
  copyBtn: {
    backgroundColor: "#145B8A",
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20, marginBottom: 14,
  },
  copyBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  expiryNote: { fontSize: 13, color: "#1A6FA8", fontWeight: "500" },
  placeholder: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginVertical: 16 },

  errorText: { color: "#D32F2F", textAlign: "center", marginTop: 12, fontSize: 13 },

  actionRow: {
    flexDirection: "row", gap: 10,
    marginHorizontal: 20, marginTop: 16,
  },
  generateBtn: {
    backgroundColor: "#1A6FA8",
    paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareBtn: {
    backgroundColor: "#145B8A",
    paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Family members section
  membersSection: {
    marginHorizontal: 20, marginTop: 32,
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    padding: 20,
    shadowColor: theme.shadow, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  membersSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16,
  },
  membersSectionTitle: { fontSize: 15, fontWeight: "700", color: theme.text, flex: 1 },
  memberCountBadge: {
    backgroundColor: "#2E86C1",
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
  },
  memberCountText: { fontSize: 12, fontWeight: "700", color: "#1A6FA8" },

  emptyMembers: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyMembersText: { fontSize: 13, color: theme.textMuted, textAlign: "center" },

  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  memberAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#1A6FA8",
    alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  memberName: { fontSize: 15, fontWeight: "600", color: theme.text },
  memberDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  removeBtn: { padding: 8 },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: theme.bgCard, borderRadius: 24,
    padding: 24, width: "100%", alignItems: "center",
    shadowColor: theme.shadow, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#FDEDED", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: theme.text, marginBottom: 8, textAlign: "center" },
  modalMsg: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  modalBtns: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: theme.bgSoft,
    alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
  modalDeleteBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: "#D32F2F",
    alignItems: "center", justifyContent: "center",
  },
  modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  });
}
