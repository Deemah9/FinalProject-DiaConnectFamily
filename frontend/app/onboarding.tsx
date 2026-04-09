import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { updateLifestyle } from "@/services/api";

const DIET_OPTIONS = ["balanced", "low_carb", "vegetarian", "other"] as const;
const ACTIVITY_OPTIONS = ["low", "moderate", "high"] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();

  const [dietType, setDietType] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const dietLabels: Record<string, string> = {
    balanced: t("onboardingDietBalanced"),
    low_carb: t("onboardingDietLowCarb"),
    vegetarian: t("onboardingDietVegetarian"),
    other: t("onboardingDietOther"),
  };

  const activityLabels: Record<string, string> = {
    low: t("activityLow"),
    moderate: t("activityModerate"),
    high: t("activityHigh"),
  };

  const onComplete = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setErrorMsg("");

      await updateLifestyle({
        diet_type: dietType || null,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        activity_level: activityLevel || null,
      });

      router.replace("/(tabs)");
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.logoWrap}>
          <Ionicons name="heart-outline" size={36} color={Colors.gold} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
            <Text style={styles.logoSub}>{t("family")}</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("onboardingTitle")}</Text>
          <Text style={styles.screenSub}>{t("onboardingSubtitle")}</Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Step 1 — Dietary Pattern */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="nutrition-outline" size={20} color={PRIMARY} />
            <Text style={styles.cardTitle}>{t("onboardingDietLabel")}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {DIET_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.chip, dietType === opt && styles.chipSelected]}
                onPress={() => setDietType(opt)}
              >
                <Text
                  style={[
                    styles.chipText,
                    dietType === opt && styles.chipTextSelected,
                  ]}
                >
                  {dietLabels[opt]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Step 2 — Sleep Hours */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="moon-outline" size={20} color={PRIMARY} />
            <Text style={styles.cardTitle}>{t("onboardingSleepLabel")}</Text>
          </View>

          <TextInput
            value={sleepHours}
            onChangeText={setSleepHours}
            placeholder={t("sleepHoursPlaceholder")}
            placeholderTextColor={MUTED}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        {/* Step 3 — Activity Level */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="walk-outline" size={20} color={PRIMARY} />
            <Text style={styles.cardTitle}>{t("onboardingActivityLabel")}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[
                  styles.chip,
                  activityLevel === opt && styles.chipSelected,
                ]}
                onPress={() => setActivityLevel(opt)}
              >
                <Text
                  style={[
                    styles.chipText,
                    activityLevel === opt && styles.chipTextSelected,
                  ]}
                >
                  {activityLabels[opt]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Actions */}
        <Pressable
          style={[styles.completeBtn, saving && styles.disabledBtn]}
          onPress={onComplete}
          disabled={saving}
        >
          <Text style={styles.completeBtnText}>
            {saving ? t("saving") : t("onboardingComplete")}
          </Text>
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={onSkip} disabled={saving}>
          <Text style={styles.skipBtnText}>{t("onboardingSkip")}</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const PRIMARY = "#1A6FA8";
const MUTED = "#4A6480";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },

  logoTitle: {
    color: "#0B1A2E",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },

  logoSub: {
    color: MUTED,
    fontSize: 16,
    fontWeight: "300",
    lineHeight: 18,
  },

  hero: {
    marginBottom: 24,
  },

  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0B1A2E",
    marginBottom: 8,
  },

  screenSub: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },

  errorBox: {
    marginBottom: 16,
    backgroundColor: "#FDEDED",
    borderWidth: 1,
    borderColor: "#F5C2C2",
    borderRadius: 16,
    padding: 12,
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "500",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1A2E",
  },

  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#E8F1F8",
  },

  chipSelected: {
    backgroundColor: "#EEF4FF",
    borderColor: PRIMARY,
  },

  chipText: {
    fontSize: 13,
    color: "#1E3A52",
    fontWeight: "500",
  },

  chipTextSelected: {
    color: PRIMARY,
    fontWeight: "700",
  },

  input: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#B8D0E8",
    backgroundColor: "#E8F1F8",
    paddingHorizontal: 14,
    color: "#0B1A2E",
    ...Typography.button,
  },

  completeBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  completeBtnText: {
    color: "#FFFFFF",
    ...Typography.button,
  },

  skipBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
  },

  skipBtnText: {
    color: MUTED,
    fontSize: 14,
  },
});
