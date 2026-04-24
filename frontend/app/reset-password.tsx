import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { resetPassword } from "@/services/api";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 6;
  const canSubmit =
    !!token && passwordLongEnough && passwordsMatch && !loading && !done;

  async function onReset() {
    setError("");
    if (!canSubmit) return;

    if (!token) {
      setError(t("resetTokenMissing"));
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="warning-outline" size={48} color={Colors.gold} />
        <Text style={[styles.header, { marginTop: Spacing.md, textAlign: "center" }]}>
          {t("resetTokenMissing")}
        </Text>
        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: Spacing.lg }}>
          <Text style={styles.link}>{t("backToLogin")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand} pointerEvents="none">
          <Ionicons name="heart-outline" size={46} color={Colors.gold} />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.brandTitle}>{t("appName1")}</Text>
            <Text style={styles.brandSub}>{t("appName2")}</Text>
          </View>
        </View>

        <Text style={styles.header}>{t("resetPassword")}</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {done ? (
          <>
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.successText}>{t("resetPasswordSuccess")}</Text>
            </View>
            <Pressable
              onPress={() => router.replace("/login")}
              style={[styles.primaryBtn, { marginTop: Spacing.lg, width: "100%" }]}
            >
              <Text style={styles.primaryText}>{t("login")}</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.form}>
            <View>
              <Text style={styles.inputLabel}>{t("newPassword")}</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t("newPassword")}
                placeholderTextColor={Colors.textMutedOnDark}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  newPassword.length > 0 && !passwordLongEnough && styles.inputErr,
                ]}
              />
              {newPassword.length > 0 && !passwordLongEnough && (
                <Text style={styles.errText}>{t("errors.passwordMin")}</Text>
              )}
            </View>

            <View>
              <Text style={styles.inputLabel}>{t("confirmNewPassword")}</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t("confirmNewPassword")}
                placeholderTextColor={Colors.textMutedOnDark}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  confirmPassword.length > 0 && !passwordsMatch && styles.inputErr,
                ]}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={styles.errText}>{t("errors.passwordsMismatch")}</Text>
              )}
            </View>

            <Pressable
              onPress={onReset}
              disabled={!canSubmit}
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
            >
              <Text style={styles.primaryText}>
                {loading ? t("loading") : t("resetPassword")}
              </Text>
            </Pressable>
          </View>
        )}

        {!done && (
          <Pressable
            onPress={() => router.replace("/login")}
            style={{ marginTop: Spacing.lg }}
          >
            <Text style={styles.link}>{t("backToLogin")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },

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
    color: Colors.white,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  brandSub: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 24,
  },

  header: {
    marginTop: Spacing.lg,
    color: Colors.white,
    fontSize: 22,
    fontWeight: "600",
  },

  errorBanner: {
    marginTop: Spacing.md,
    width: "100%",
    backgroundColor: "#B91C1C",
    borderColor: "#991B1B",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

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
    color: Colors.white,
    ...Typography.button,
  },
  inputErr: { borderColor: Colors.error },
  errText: { marginTop: Spacing.sm, color: Colors.errorText, fontSize: 12 },

  primaryBtn: {
    marginTop: Spacing.sm,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: Colors.primary, ...Typography.button },

  link: {
    color: Colors.textMutedOnDark,
    fontSize: 13,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
