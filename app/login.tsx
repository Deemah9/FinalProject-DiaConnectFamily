import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const em = email.trim();

    if (!em) e.email = t("errors.emailRequired");
    else if (!emailRegex.test(em)) e.email = t("errors.emailInvalid");

    if (!password) e.password = t("errors.passwordRequired");
    else if (password.length < 6) e.password = t("errors.passwordMin");

    return e;
  }, [email, password, t]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  async function onLogin() {
    setGeneralError("");
    if (!canSubmit) return;

    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (e: any) {
      setGeneralError(e.message || t("errors.loginFailed"));
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

        <Text style={styles.header}>{t("login")}</Text>

        {!!generalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{generalError}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View>
            <Text style={styles.inputLabel}>{t("email")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("email")}
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, !!errors.email && styles.inputErr]}
            />
            {!!errors.email && (
              <Text style={styles.errText}>{errors.email}</Text>
            )}
          </View>

          <View>
            <Text style={styles.inputLabel}>{t("password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("password")}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, !!errors.password && styles.inputErr]}
            />
            {!!errors.password && (
              <Text style={styles.errText}>{errors.password}</Text>
            )}
          </View>

          <Pressable
            onPress={onLogin}
            disabled={!canSubmit}
            style={[
              styles.primaryBtn,
              (!canSubmit || loading) && styles.btnDisabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {loading ? t("loading") : t("login")}
            </Text>
          </Pressable>
        </View>
        {/* @ts-ignore */}
        <Link href="/signup" asChild>
          <Pressable style={{ marginTop: Spacing.lg }}>
            <Text style={styles.link}>
              {t("dontHave")} <Text style={styles.linkBold}>{t("signup")}</Text>
            </Text>
          </Pressable>
        </Link>
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
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: { color: Colors.white, fontSize: 13 },

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
    backgroundColor: Colors.inputBg,
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

  link: { color: Colors.linkText, fontSize: 13, textAlign: "center" },
  linkBold: { fontWeight: "700", textDecorationLine: "underline" },
});
