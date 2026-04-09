import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/components/AppHeader";
import { Colors } from "@/constants/Colors";
import { joinWithCode } from "@/services/api";

const CODE_LENGTH = 6;

export default function FamilyJoinScreen() {
  const { t } = useTranslation();
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ patient_name: string } | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

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

  const handleJoin = async () => {
    const code = chars.join("");
    if (code.length < CODE_LENGTH) {
      setError(t("enterFullCode"));
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await joinWithCode(code);
      setSuccess({ patient_name: res.patient_name });
    } catch (e: any) {
      setError(e.message || t("familyLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <AppHeader />
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>{t("linkedSuccess")}</Text>
          <Text style={styles.successSub}>
            {t("linkedTo", { name: success.patient_name })}
          </Text>
          <Text style={styles.successNote}>{t("linkedNote")}</Text>
          <Pressable
            style={styles.doneBtn}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.doneBtnText}>{t("goHome")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />

      <View style={styles.inner}>
        <Text style={styles.label}>{t("enterCodeLabel")}</Text>

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
              returnKeyType="next"
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.joinBtn, loading && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.joinBtnText}>{t("joinBtn")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 28,
    fontWeight: "500",
  },
  codeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
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
  errorText: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  successCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  successSub: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "600",
    textAlign: "center",
  },
  successNote: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    marginTop: 16,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
