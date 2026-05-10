import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
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
import { getProfile, updateProfile } from "@/services/api";

const PRIMARY   = "#1A6FA8";
const BG        = "#FFFFFF";
const TEXT      = "#0B1A2E";
const MUTED     = "#4A6480";
const BORDER    = "#D6E8F5";
const SOFT      = "#E8F1F8";
const INPUT_BDR = "#B8D0E8";

export default function FamilyProfileScreen() {
  const { t } = useTranslation();

  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [editBasic, setEditBasic]     = useState(false);
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [savingBasic, setSavingBasic] = useState(false);
  const [errorBasic, setErrorBasic]   = useState("");

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
                  placeholderTextColor={MUTED}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t("lastName")}</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t("lastName")}
                  placeholderTextColor={MUTED}
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

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },

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
    color: TEXT,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },

  screenSub: {
    color: MUTED,
    fontSize: 14,
  },

  avatarCard: {
    backgroundColor: "#F8FBFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: "#000",
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
    color: TEXT,
    marginBottom: 2,
    textAlign: "center",
  },

  emailText: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
  },

  card: {
    backgroundColor: BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
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
    color: TEXT,
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
  },

  editBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 10,
  },

  rowBox: {
    backgroundColor: SOFT,
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
    color: MUTED,
    flex: 1,
    marginRight: 12,
  },

  rowValue: {
    fontSize: 13,
    color: TEXT,
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
    color: "#1E3A52",
    marginBottom: 8,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: INPUT_BDR,
    backgroundColor: SOFT,
    paddingHorizontal: 14,
    color: TEXT,
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
    borderColor: INPUT_BDR,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: TEXT,
    ...Typography.button,
  },

  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: PRIMARY,
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
    backgroundColor: "#EEF4FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  changePwBtnText: {
    flex: 1,
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "600",
  },
});
