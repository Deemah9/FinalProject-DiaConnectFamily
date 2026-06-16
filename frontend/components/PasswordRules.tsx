import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

const RULES = [
  { key: "length",    test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "number",    test: (p: string) => /[0-9]/.test(p) },
  { key: "special",   test: (p: string) => /[!@#$%^&*]/.test(p) },
];

export const isPasswordStrong = (p: string) => RULES.every((r) => r.test(p));

export default function PasswordRules({ password }: { password: string }) {
  const { t } = useTranslation();
  if (!password) return null;

  return (
    <View style={styles.container}>
      {RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.key} style={styles.row}>
            <Ionicons
              name={ok ? "checkmark-circle" : "ellipse-outline"}
              size={15}
              color={ok ? "#22C55E" : "#94A3B8"}
            />
            <Text style={[styles.text, ok && styles.textOk]}>
              {t(`passwordRule.${rule.key}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  text: {
    fontSize: 12,
    color: "#94A3B8",
  },
  textOk: {
    color: "#22C55E",
  },
});
