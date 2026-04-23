import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";
import { changePassword } from "@/services/api";

const PRIMARY = "#1A6FA8";
const TEXT    = "#0B1A2E";
const MUTED   = "#4A6480";
const BORDER  = "#B8D0E8";
const SOFT    = "#E8F1F8";

export default function ChangePasswordScreen() {
  const { t } = useTranslation();

  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");

  async function onSubmit() {
    setError("");

    if (!currentPw || !newPw || !confirmPw) {
      setError("All fields are required.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await changePassword(currentPw, newPw, confirmPw);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brand} pointerEvents="none">
          <Ionicons name="heart-outline" size={46} color={Colors.gold} />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.brandTitle}>{t("appName1")}</Text>
            <Text style={styles.brandSub}>{t("appName2")}</Text>
          </View>
        </View>

        <Text style={styles.header}>{t("changePasswordTitle")}</Text>

        {/* Error banner */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Success banner */}
        {success ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.successText}>{t("changePasswordSuccess")}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text style={styles.inputLabel}>{t("currentPassword")}</Text>
              <TextInput
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder={t("currentPassword")}
                placeholderTextColor={Colors.textMutedOnDark}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>{t("newPassword")}</Text>
              <TextInput
                value={newPw}
                onChangeText={setNewPw}
                placeholder={t("newPassword")}
                placeholderTextColor={Colors.textMutedOnDark}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>{t("confirmNewPassword")}</Text>
              <TextInput
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder={t("confirmNewPassword")}
                placeholderTextColor={Colors.textMutedOnDark}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
            >
              <Text style={styles.primaryText}>
                {loading ? t("changingPassword") : t("changePassword")}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PRIMARY },

  topRow: { paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },

  brand: { marginTop: Spacing.sm, flexDirection: "row", alignItems: "center" },
  brandTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  brandSub: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 24,
  },

  header: {
    marginTop: Spacing.lg,
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },

  errorBanner: {
    marginTop: Spacing.md,
    width: "100%",
    backgroundColor: "#B91C1C",
    borderWidth: 1,
    borderColor: "#991B1B",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  successBanner: {
    marginTop: Spacing.lg,
    width: "100%",
    backgroundColor: "#166534",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  successText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },

  form: { width: "100%", marginTop: Spacing.md, gap: Spacing.md },

  inputLabel: {
    color: Colors.textLabel,
    marginBottom: Spacing.sm,
    fontSize: 12,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBgOnDark,
    paddingHorizontal: 16,
    color: "#fff",
    ...Typography.button,
  },

  primaryBtn: {
    marginTop: Spacing.sm,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: PRIMARY, ...Typography.button },
});
