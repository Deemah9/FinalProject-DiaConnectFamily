import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";
import { setAppLanguage } from "@/src/i18n";

type Lang = "en" | "ar" | "he";
const LANGS: Lang[] = ["en", "ar", "he"];

function normalizeLang(lng?: string): Lang {
  const base = (lng || "en").split("-")[0].toLowerCase();
  return base === "ar" || base === "he" || base === "en" ? (base as Lang) : "en";
}

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();

  // ✅ State يضمن أن الزر يتلوّن فورًا حتى لو i18n ما عمل rerender بسرعة
  const [selected, setSelected] = useState<Lang>(() => normalizeLang(i18n.language));

  // ✅ تابع تغيّر اللغة من i18next
  useEffect(() => {
    const onChanged = (lng: string) => setSelected(normalizeLang(lng));
    i18n.on("languageChanged", onChanged);
    return () => {
      i18n.off("languageChanged", onChanged);
    };
  }, [i18n]);

  const current = useMemo(() => normalizeLang(i18n.language), [i18n.language]);

  async function pick(lng: Lang) {
    setSelected(lng); // ✅ لون فوري
    try {
      await setAppLanguage(lng); // يحفظ + يغير + RTL (وقد يعمل Reload عند الحاجة)
    } catch {
      // رجّعها لو صار خطأ
      setSelected(current);
    }
  }

  return (
    <View style={styles.container}>
      {/* Language pills */}
      <View style={styles.langRow}>
        {LANGS.map((lng) => {
          const active = selected === lng;
          return (
            <Pressable
              key={lng}
              onPress={() => pick(lng)}
              style={[styles.langPill, active && styles.langPillActive]}
            >
              <Text style={[styles.langText, active && styles.langTextActive]}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

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

  langRow: {
    position: "absolute",
    top: 48,
    left: 16,
    flexDirection: "row",
    gap: 10,
    zIndex: 10,
  },
  langPill: {
    height: 34,
    minWidth: 46,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  langPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  langText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  langTextActive: { color: Colors.primary },

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

  footer: { marginTop: Spacing.sm, color: Colors.textMuted, ...Typography.footer },
});
