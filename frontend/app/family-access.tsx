import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { viewWithCode } from "@/services/api";

const CODE_LENGTH = 6;
export const FAMILY_CODE_KEY = "family_pairing_code";

export default function FamilyAccessScreen() {
  const { t } = useTranslation();
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<(TextInput | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (text: string, index: number) => {
    const char = text.toUpperCase().slice(-1);
    const next = [...chars];
    next[index] = char;
    setChars(next);
    if (char && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = chars.join("");
    if (code.length < CODE_LENGTH) {
      setError(t("enterFullCode"));
      return;
    }
    try {
      setLoading(true);
      setError("");

      const res = await viewWithCode(code);

      // Save code for future sessions
      await AsyncStorage.setItem(FAMILY_CODE_KEY, code);

      // Navigate to glucose screen
      router.replace({
        pathname: "/family-patient-glucose" as any,
        params: {
          patientId: res.patient_id,
          patientName: res.patient_name,
          familyCode: code,
        },
      });
    } catch (e: any) {
      setError(e.message || t("invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Ionicons name="people-outline" size={52} color={Colors.gold} />
        <Text style={styles.title}>{t("familyAccessTitle")}</Text>
        <Text style={styles.subtitle}>{t("enterCodeLabel")}</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.codeLabel}>{t("pairingCode")}</Text>

        <View style={styles.codeRow}>
          {chars.map((char, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              style={[styles.codeBox, char ? styles.codeBoxFilled : null]}
              value={char}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              maxLength={1}
              autoCapitalize="characters"
              keyboardType="default"
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t("joinBtn")}</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          {t("shareSubtitle")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    alignItems: "center",
    paddingTop: 70,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 36,
    gap: 10,
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  card: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },
  codeBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.bgInput,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#B91C1C",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    width: "100%",
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
