import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { setAppLanguage } from "@/src/i18n";

const LANG_KEY = "app_lang";

const LANGUAGES = [
  { code: "en", nativeLabel: "English" },
  { code: "ar", nativeLabel: "العربية" },
  { code: "he", nativeLabel: "עברית" },
] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<string>("en");
  const [changingLang, setChangingLang] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((lang) => {
      if (lang) setCurrentLang(lang);
    });
  }, []);

  const handleSelectLanguage = (code: string) => {
    if (code === currentLang || changingLang) return;
    setChangingLang(code);
    setCurrentLang(code);
    // نؤخر تغيير اللغة حتى يُرسم الـ spinner أولاً
    setTimeout(async () => {
      await setAppLanguage(code as "en" | "ar" | "he");
      setChangingLang(null);
    }, 80);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.topHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={22} color="#374151" />
          </Pressable>
          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color={Colors.gold} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
              <Text style={styles.logoSub}>{t("family")}</Text>
            </View>
          </View>
          <View style={styles.backPlaceholder} />
        </View>

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("settingsTitle")}</Text>
          <Text style={styles.screenSub}>{t("settingsSubtitle")}</Text>
        </View>

        {/* Language Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="language-outline" size={18} color={stylesVars.primary} />
            <Text style={styles.cardTitle}>{t("appLanguage")}</Text>
          </View>
          <Text style={styles.cardSub}>{t("selectLanguage")}</Text>

          <View style={styles.langList}>
            {LANGUAGES.map(({ code, nativeLabel }) => {
              const selected = currentLang === code;
              return (
                <Pressable
                  key={code}
                  style={[styles.langItem, selected && styles.langItemSelected]}
                  onPress={() => handleSelectLanguage(code)}
                >
                  <Text style={[styles.langLabel, selected && styles.langLabelSelected]}>
                    {nativeLabel}
                  </Text>
                  {changingLang === code ? (
                    <ActivityIndicator size="small" color={stylesVars.primary} style={styles.checkIcon} />
                  ) : selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={stylesVars.primary}
                      style={styles.checkIcon}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  primary: "#4A7DC9",
  bg: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#F3F4F6",
  soft: "#F9FAFB",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: stylesVars.bg,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
  },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: stylesVars.border,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: stylesVars.soft,
    borderWidth: 1,
    borderColor: stylesVars.border,
  },

  backPlaceholder: {
    width: 40,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoTitle: {
    color: stylesVars.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: stylesVars.muted,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "300",
  },

  hero: {
    marginTop: 28,
    marginBottom: 24,
  },

  screenTitle: {
    color: stylesVars.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  screenSub: {
    color: stylesVars.muted,
    fontSize: 14,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: stylesVars.border,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: stylesVars.text,
  },

  cardSub: {
    fontSize: 13,
    color: stylesVars.muted,
    marginBottom: 20,
  },

  langList: {
    gap: 10,
  },

  langItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: stylesVars.soft,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: stylesVars.border,
  },

  langItemSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },

  langLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: stylesVars.text,
    flex: 1,
  },

  langLabelSelected: {
    color: stylesVars.primary,
  },

  checkIcon: {
    marginLeft: 8,
  },
});
