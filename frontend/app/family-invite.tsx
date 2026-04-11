import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { generateFamilyCode } from "@/services/api";

export default function FamilyInviteScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setCopied(false);
      const res = await generateFamilyCode();
      setCode(res.code);
      setExpiryDays(res.expires_in_days);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <AppHeader />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("pairingCode")}</Text>

        {code ? (
          <>
            <View style={styles.codeRow}>
              {code.split("").map((char, i) => (
                <View key={i} style={styles.codeBox}>
                  <Text style={styles.codeChar}>{char}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.copyBtn} onPress={handleCopy}>
              <Text style={styles.copyBtnText}>
                {copied ? t("codeCopied") : t("copyCode")}
              </Text>
            </Pressable>

            <Text style={styles.expiryNote}>
              {t("codeExpiryNote", { days: expiryDays })}
            </Text>
          </>
        ) : (
          <Text style={styles.placeholder}>{t("generateCodeHint")}</Text>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.generateBtn, loading && styles.btnDisabled]}
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
        <>
          <Text style={styles.shareTitle}>{t("shareTitle")}</Text>
          <Text style={styles.shareSubtitle}>{t("shareSubtitle")}</Text>

          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>{t("shareCode")}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
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
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  codeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  codeBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  codeChar: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: 1,
  },
  copyBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 14,
  },
  copyBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  expiryNote: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "500",
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginVertical: 16,
  },
  errorText: {
    color: Colors.error,
    textAlign: "center",
    marginTop: 12,
    fontSize: 13,
  },
  generateBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginTop: 32,
    marginHorizontal: 20,
  },
  shareSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 24,
    lineHeight: 22,
  },
  shareBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
