import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";
import { setAppLanguage } from "@/src/i18n";

const LANG_OPTIONS = [
  { code: "en" as const, label: "English" },
  { code: "ar" as const, label: "العربية" },
  { code: "he" as const, label: "עברית" },
];

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <View style={styles.container}>
      {/* Language button */}
      <Pressable style={styles.langBtn} onPress={() => setLangOpen(true)}>
        <Ionicons name="earth-outline" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Language dropdown modal */}
      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setLangOpen(false)}>
          <View style={styles.langDropdown}>
            {LANG_OPTIONS.map(({ code, label }, idx, arr) => {
              const active = i18n.language === code;
              return (
                <Pressable
                  key={code}
                  style={[styles.langOption, idx < arr.length - 1 && styles.langOptionBorder, active && styles.langOptionActive]}
                  onPress={async () => {
                    setLangOpen(false);
                    if (i18n.language === code) return;
                    await setAppLanguage(code);
                  }}
                >
                  <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>{label}</Text>
                  {active && <Ionicons name="checkmark" size={14} color="#1A6FA8" />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Brand */}
      <View style={styles.brand} pointerEvents="none">
        <Ionicons name="heart-outline" size={46} color={Colors.gold} />
        <View style={{ marginLeft: Spacing.md }}>
          <Text style={styles.title}>{t("appName1")}</Text>
          <Text style={styles.subtitle}>{t("appName2")}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Link href="/signup" asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>{t("signup")}</Text>
          </Pressable>
        </Link>

        <Link href="/login" asChild>
          <Pressable style={styles.outlineBtn}>
            <Text style={styles.outlineText}>{t("login")}</Text>
          </Pressable>
        </Link>

        <Pressable
          style={styles.familyBtn}
          onPress={() => router.push({ pathname: "/signup" as any, params: { role: "family_member" } })}
        >
          <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.85)" />
          <Text style={styles.familyBtnText}>{t("familyMemberBtn")}</Text>
        </Pressable>

        <Text style={styles.footer}>{t("footer")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },

  langBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  langDropdown: {
    position: "absolute", top: 96, right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 14, borderWidth: 1, borderColor: "#D6E8F5",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    minWidth: 150, overflow: "hidden",
  },
  langOption: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: "#EBF3FA" },
  langOptionActive: { backgroundColor: "#EBF3FA" },
  langOptionText: { fontSize: 14, color: "#0B1A2E" },
  langOptionTextActive: { fontWeight: "700", color: "#1A6FA8" },

  brand: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { color: Colors.white, ...Typography.title, lineHeight: 26 },
  subtitle: { color: Colors.white, ...Typography.subtitle, lineHeight: 26 },

  actions: {
    width: "100%",
    marginTop: 90,
    gap: Spacing.md,
    alignItems: "center",
  },

  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: Colors.primary, ...Typography.button },

  outlineBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  outlineText: { color: Colors.white, ...Typography.button },

  familyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  familyBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: { marginTop: Spacing.sm, color: Colors.textMutedOnDark, ...Typography.footer },
});
