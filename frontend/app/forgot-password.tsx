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
import { forgotPassword } from "@/services/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const emailValid = emailRegex.test(email.trim());
  const canSubmit = emailValid && !loading && !sent;

  async function onSend() {
    setError("");
    if (!canSubmit) return;

    try {
      setLoading(true);
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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

        <Text style={styles.header}>{t("forgotPasswordTitle")}</Text>
        <Text style={styles.subtitle}>{t("forgotPasswordSubtitle")}</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {sent ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.successText}>{t("resetLinkSent")}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text style={styles.inputLabel}>{t("email")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("email")}
                placeholderTextColor={Colors.textMutedOnDark}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, !!error && styles.inputErr]}
              />
            </View>

            <Pressable
              onPress={onSend}
              disabled={!canSubmit}
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
            >
              <Text style={styles.primaryText}>
                {loading ? t("loading") : t("sendResetLink")}
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => router.replace("/login")}
          style={{ marginTop: Spacing.lg }}
        >
          <Text style={styles.link}>{t("backToLogin")}</Text>
        </Pressable>
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
    textAlign: "center",
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.textMutedOnDark,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
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
