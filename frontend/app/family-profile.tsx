import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { getProfile, updateProfile, deleteAccount } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";

const PRIMARY = "#1A6FA8";

export default function FamilyProfileScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [editBasic, setEditBasic]     = useState(false);
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [savingBasic, setSavingBasic] = useState(false);
  const [errorBasic, setErrorBasic]   = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [deletePassword, setDeletePassword]   = useState("");
  const [deleteError, setDeleteError]         = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setUser(data);
      setFirstName(data?.firstName || data?.first_name || "");
      setLastName(data?.lastName  || data?.last_name  || "");
    } catch (e: any) {
      console.log("FamilyProfileScreen load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await deleteAccount(deletePassword);
      await logout();
    } catch (e: any) {
      setDeleting(false);
      setDeleteError(e?.message?.includes("Incorrect") ? t("deleteAccountPasswordError") : e?.message || t("saveFailed"));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const saveBasic = async () => {
    try {
      setSavingBasic(true);
      setErrorBasic("");
      await updateProfile({ firstName, lastName });
      await load();
      setEditBasic(false);
    } catch (e: any) {
      setErrorBasic(e?.message || t("saveFailed"));
    } finally {
      setSavingBasic(false);
    }
  };

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || t("user");

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("myProfile")}</Text>
          <Text style={styles.screenSub}>
            {loading ? t("loadingProfile") : t("manageInfo")}
          </Text>
        </View>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={40} color={PRIMARY} />
          </View>
          <Text style={styles.nameText}>
            {loading ? t("loading") : fullName}
          </Text>
          <Text style={styles.emailText}>{user?.email || "--"}</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="person-circle-outline" size={18} color={PRIMARY} />
              <Text style={styles.cardTitle}>{t("basicInfo")}</Text>
            </View>
            {!loading && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditBasic((v) => !v); setErrorBasic(""); }}
              >
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                <Text style={styles.editBtnText}>{editBasic ? t("close") : t("edit")}</Text>
              </Pressable>
            )}
          </View>

          {!!errorBasic && <Text style={styles.errorText}>{errorBasic}</Text>}

          {editBasic ? (
            <>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t("firstName")}</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={t("firstName")}
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t("lastName")}</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t("lastName")}
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.saveCancelRow}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => { setEditBasic(false); load(); }}
                  disabled={savingBasic}
                >
                  <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, savingBasic && { opacity: 0.7 }]}
                  onPress={saveBasic}
                  disabled={savingBasic}
                >
                  <Text style={styles.saveBtnText}>
                    {savingBasic ? t("saving") : t("saveChanges")}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.rowBox}>
                <Text style={styles.rowLabel}>{t("firstName")}</Text>
                <Text style={styles.rowValue}>{user?.firstName || "--"}</Text>
              </View>
              <View style={styles.rowBox}>
                <Text style={styles.rowLabel}>{t("lastName")}</Text>
                <Text style={styles.rowValue}>{user?.lastName || "--"}</Text>
              </View>
              <View style={styles.rowBox}>
                <Text style={styles.rowLabel}>{t("email")}</Text>
                <Text style={styles.rowValue}>{user?.email || "--"}</Text>
              </View>
            </>
          )}
        </View>

        {/* Change Password */}
        <Pressable
          style={styles.changePwBtn}
          onPress={() => router.push("/change-password")}
        >
          <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
          <Text style={styles.changePwBtnText}>{t("changePassword")}</Text>
          <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
        </Pressable>

        {/* Delete Account */}
        <Pressable style={styles.deleteAccountBtn} onPress={() => setShowDeleteModal(true)}>
          <Ionicons name="trash-outline" size={18} color="#D32F2F" />
          <Text style={styles.deleteAccountBtnText}>{t("deleteAccount")}</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
      >
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalBox}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="warning-outline" size={32} color="#D32F2F" />
            </View>
            <Text style={styles.deleteModalTitle}>{t("deleteAccount")}</Text>
            <Text style={styles.deleteModalWarning}>{t("deleteAccountFamilyWarning")}</Text>
            <TextInput
              style={styles.deletePasswordInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={t("deleteAccountPasswordPlaceholder")}
              placeholderTextColor={theme.inactive}
              secureTextEntry
              editable={!deleting}
            />
            {!!deleteError && <Text style={styles.deletePasswordError}>{deleteError}</Text>}
            <Pressable
              style={[styles.deleteConfirmBtn, (deleting || !deletePassword.trim()) && { opacity: 0.5 }]}
              onPress={handleDeleteAccount}
              disabled={deleting || !deletePassword.trim()}
            >
              <Text style={styles.deleteConfirmText}>
                {deleting ? t("deletingAccount") : t("deleteAccountConfirm")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.deleteCancelBtn}
              onPress={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
              disabled={deleting}
            >
              <Text style={styles.deleteCancelText}>{t("deleteAccountCancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  hero: {
    marginTop: 20,
    marginBottom: 20,
  },

  screenTitle: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },

  screenSub: {
    color: theme.textMuted,
    fontSize: 14,
  },

  avatarCard: {
    backgroundColor: theme.bgAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  nameText: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 2,
    textAlign: "center",
  },

  emailText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: "center",
  },

  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: theme.primaryBg,
  },

  editBtnText: {
    color: "#1A6FA8",
    fontSize: 13,
    fontWeight: "600",
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 10,
  },

  rowBox: {
    backgroundColor: theme.bgInput,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  rowLabel: {
    fontSize: 13,
    color: theme.textMuted,
    flex: 1,
    marginRight: 12,
  },

  rowValue: {
    fontSize: 13,
    color: theme.text,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },

  fieldBlock: {
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textSecondary,
    marginBottom: 8,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgInput,
    paddingHorizontal: 14,
    color: theme.text,
    ...Typography.button,
  },

  saveCancelRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },

  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: theme.text,
    ...Typography.button,
  },

  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1A6FA8",
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtnText: {
    color: "#FFFFFF",
    ...Typography.button,
  },

  changePwBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.primaryBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF0F0",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  changePwBtnText: {
    flex: 1,
    color: "#1A6FA8",
    fontSize: 15,
    fontWeight: "600",
  },

  deleteAccountBtnText: {
    flex: 1,
    color: "#D32F2F",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  deleteModalBox: {
    backgroundColor: theme.bgCard,
    borderRadius: 28,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: theme.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  deleteModalIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 14,
    textAlign: "center",
  },
  deleteModalWarning: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteConfirmBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D32F2F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  deleteCancelBtn: { paddingVertical: 10 },
  deleteCancelText: { fontSize: 14, color: theme.inactive, fontWeight: "500" },
  deletePasswordInput: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 14,
    color: theme.text,
    fontSize: 14,
    marginBottom: 8,
  },
  deletePasswordError: {
    fontSize: 13,
    color: "#D32F2F",
    marginBottom: 10,
    textAlign: "center",
  },
  });
}
