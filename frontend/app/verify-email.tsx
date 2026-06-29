import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";
import { useAuth } from "../context/AuthContext";
import { checkVerification, resendVerification } from "../services/api";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const isRTL = I18nManager.isRTL;
  const { email, password } = useLocalSearchParams<{ email?: string; password?: string }>();

  const [resendLoading, setResendLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!email) return;

    intervalRef.current = setInterval(async () => {
      try {
        const data = await checkVerification(email);
        if (data?.verified) {
          clearInterval(intervalRef.current!);
          setVerified(true);

          if (password) {
            setAutoLogging(true);
            try {
              await login(email, password);
            } catch {
              router.replace("/login");
            }
          } else {
            router.replace("/login");
          }
        }
      } catch {
        // ignore poll errors silently
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [email, password]);

  async function handleResend() {
    if (!email || resendLoading) return;
    setError("");
    setResent(false);
    setResendLoading(true);
    try {
      await resendVerification(email);
      setResent(true);
    } catch (e: any) {
      setError(e.message || t("errors.signupFailed"));
    } finally {
      setResendLoading(false);
    }
  }

  if (autoLogging) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={Colors.white} />
        <Text style={[styles.title, { marginTop: Spacing.lg }]}>
          {t("verifyEmail.title")} ✓
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topRow, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Pressable onPress={() => router.replace("/login")} style={styles.backBtn}>
          <Ionicons
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={22}
            color={Colors.white}
          />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Ionicons name="heart-outline" size={46} color={Colors.gold} />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.brandTitle}>{t("appName1")}</Text>
            <Text style={styles.brandSub}>{t("appName2")}</Text>
          </View>
        </View>

        <View style={styles.iconWrap}>
          <Ionicons name="mail-outline" size={72} color={Colors.white} />
        </View>

        <Text style={styles.title}>{t("verifyEmail.title")}</Text>
        <Text style={styles.subtitle}>{t("verifyEmail.subtitle")}</Text>
        {!!email && <Text style={styles.emailText}>{email}</Text>}
        <Text style={styles.instructions}>{t("verifyEmail.instructions")}</Text>

        <View style={styles.pollingRow}>
          <ActivityIndicator size="small" color={Colors.white} style={{ opacity: 0.7 }} />
          <Text style={styles.pollingText}>{t("verifyEmail.waiting")}</Text>
        </View>

        {!!resent && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
            <Text style={styles.successText}>{t("verifyEmail.resent")}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={handleResend}
          disabled={resendLoading}
          style={[styles.resendBtn, resendLoading && styles.btnDisabled]}
        >
          {resendLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.resendText}>
              {t("verifyEmail.resend")}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          style={{ marginTop: Spacing.lg }}
        >
          <Text style={styles.loginLink}>{t("verifyEmail.backToLogin")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },

  topRow: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  brand: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xl },
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

  iconWrap: {
    marginBottom: Spacing.lg,
    opacity: 0.9,
  },

  title: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },

  subtitle: {
    color: Colors.white,
    fontSize: 15,
    textAlign: "center",
    opacity: 0.85,
    marginBottom: 4,
  },

  emailText: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },

  instructions: {
    color: Colors.white,
    fontSize: 13,
    textAlign: "center",
    opacity: 0.75,
    lineHeight: 20,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },

  pollingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.xl,
  },

  pollingText: {
    color: Colors.white,
    fontSize: 13,
    opacity: 0.7,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 12,
    marginBottom: Spacing.md,
    width: "100%",
  },
  successText: { color: "#166534", fontSize: 13, fontWeight: "600", flex: 1 },

  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: Spacing.md,
    width: "100%",
  },
  errorText: { color: "#991B1B", fontSize: 13 },

  resendBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  resendText: {
    color: Colors.primary,
    ...Typography.button,
  },

  loginLink: {
    color: Colors.white,
    fontSize: 13,
    textDecorationLine: "underline",
    opacity: 0.8,
  },
});
