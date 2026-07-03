import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Typography } from "@/constants/Typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { updateProfile, updateHealthInfo, updateLifestyle } from "@/services/api";
import { formatDob, isValidDob, isValidIsraeliPhone } from "@/utils/validation";

const PRIMARY = "#1A6FA8";

const CONDITION_IDS = [
  "hypertension",
  "kidney_disease",
  "heart_disease",
  "dyslipidemia",
  "obesity",
  "neuropathy",
  "condition_other",
  "condition_none",
] as const;

const ACTIVITY_OPTIONS = ["low", "moderate", "high"] as const;
const DIET_OPTIONS = ["balanced", "low_carb", "keto", "vegetarian", "vegan", "other"] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [step, setStep]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1
  const [phone, setPhone]           = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Step 2
  const [conditions, setConditions] = useState<string[]>([]);
  const [isf, setIsf]               = useState("30");

  // Step 3
  const [dietType, setDietType]         = useState("");
  const [sleepHours, setSleepHours]     = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  const STEP_TITLES = [
    t("onboardingStep1Title"),
    t("onboardingStep2Title"),
    t("onboardingStep3Title"),
  ];

  const STEP_SUBS = [
    t("onboardingStep1Sub"),
    t("onboardingStep2Sub"),
    t("onboardingStep3Sub"),
  ];

  const goBack = () => {
    setErrorMsg("");
    setStep((s) => s - 1);
  };

  const goNext = async () => {
    if (saving) return;
    setErrorMsg("");

    if (step === 1) {
      if (!phone.trim() || !dateOfBirth.trim()) {
        setErrorMsg(t("onboardingStep1Error"));
        return;
      }
      if (!isValidIsraeliPhone(phone)) {
        setErrorMsg(t("onboardingPhoneInvalid"));
        return;
      }
      if (!isValidDob(dateOfBirth)) {
        setErrorMsg(t("onboardingDobInvalid"));
        return;
      }
      setStep(2);

    } else if (step === 2) {
      if (conditions.length === 0 || !isf.trim()) {
        setErrorMsg(t("onboardingStep2Error"));
        return;
      }
      setStep(3);

    } else {
      if (!activityLevel || !sleepHours || !dietType) {
        setErrorMsg(t("onboardingValidationError"));
        return;
      }
      const hours = Number(sleepHours);
      if (isNaN(hours) || hours < 1 || hours > 14) {
        setErrorMsg(t("onboardingSleepInvalid"));
        return;
      }
      try {
        setSaving(true);
        await updateProfile({ phone, dateOfBirth });
        await updateHealthInfo({
          conditions: conditions.filter((c) => c !== "condition_none"),
          insulin_sensitivity: Number(isf),
        });
        await updateLifestyle({
          diet_type: dietType,
          sleep_hours: hours,
          activity_level: activityLevel,
        });
        router.replace("/(tabs)");
      } catch (e: any) {
        setErrorMsg(e?.message || t("saveFailed"));
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={[styles.logoWrap, { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" }]}>
          <Ionicons name="heart-outline" size={36} color={theme.gold} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
            <Text style={styles.logoSub}>{t("family")}</Text>
          </View>
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.dot, s <= step ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {t("onboardingStepOf", { step, total: 3 })}
        </Text>

        {/* Step title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{STEP_TITLES[step - 1]}</Text>
          <Text style={styles.screenSub}>{STEP_SUBS[step - 1]}</Text>
        </View>

        {/* Error */}
        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* ── Step 1: Personal Info ─────────────────────── */}
        {step === 1 && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("phone")}</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
                placeholder="05XXXXXXXX"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("dateOfBirth")}</Text>
              </View>
              <TextInput
                value={dateOfBirth}
                onChangeText={(v) => setDateOfBirth(formatDob(v))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                maxLength={10}
                style={styles.input}
              />
            </View>
          </>
        )}

        {/* ── Step 2: Health Info ────────────────────────── */}
        {step === 2 && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="fitness-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("chronicConditions")}</Text>
              </View>
              <View style={styles.optionsWrap}>
                {CONDITION_IDS.map((id) => {
                  const selected = conditions.includes(id);
                  return (
                    <Pressable
                      key={id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => {
                        if (id === "condition_none") {
                          setConditions(selected ? [] : ["condition_none"]);
                        } else {
                          setConditions((prev) => {
                            const withoutNone = prev.filter((c) => c !== "condition_none");
                            return withoutNone.includes(id)
                              ? withoutNone.filter((c) => c !== id)
                              : [...withoutNone, id];
                          });
                        }
                      }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(id)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="pulse-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>
                  {t("insulinSensitivity")} ({t("isfUnit")})
                </Text>
              </View>
              <TextInput
                value={isf}
                onChangeText={setIsf}
                placeholder="30"
                placeholderTextColor={theme.placeholder}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </>
        )}

        {/* ── Step 3: Lifestyle ──────────────────────────── */}
        {step === 3 && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="nutrition-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("dietType")}</Text>
              </View>
              <View style={styles.optionsWrap}>
                {DIET_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.chip, dietType === opt && styles.chipSelected]}
                    onPress={() => setDietType(opt)}
                  >
                    <Text style={[styles.chipText, dietType === opt && styles.chipTextSelected]}>
                      {t(`diet_${opt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="moon-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("sleepHours")}</Text>
              </View>
              <TextInput
                value={sleepHours}
                onChangeText={setSleepHours}
                placeholder={t("sleepHoursPlaceholder")}
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="walk-outline" size={20} color={PRIMARY} />
                <Text style={styles.cardTitle}>{t("activityLevel")}</Text>
              </View>
              <View style={styles.optionsWrap}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.chip, activityLevel === opt && styles.chipSelected]}
                    onPress={() => setActivityLevel(opt)}
                  >
                    <Text style={[styles.chipText, activityLevel === opt && styles.chipTextSelected]}>
                      {t(`activity${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Navigation buttons ─────────────────────────── */}
        <View style={styles.actionsRow}>
          {step > 1 && (
            <Pressable style={styles.backBtn} onPress={goBack} disabled={saving}>
              <Ionicons name="arrow-back" size={16} color={PRIMARY} />
              <Text style={styles.backBtnText}>{t("onboardingBack")}</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.nextBtn,
              saving && styles.disabledBtn,
              step === 1 && styles.nextBtnFull,
            ]}
            onPress={goNext}
            disabled={saving}
          >
            <Text style={styles.nextBtnText}>
              {saving
                ? t("saving")
                : step < 3
                ? t("onboardingNext")
                : t("onboardingComplete")}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    content: {
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 40,
    },

    logoWrap: {
      alignItems: "center",
      marginBottom: 28,
    },

    logoTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 22,
    },

    logoSub: {
      color: theme.textMuted,
      fontSize: 16,
      fontWeight: "300",
      lineHeight: 18,
    },

    progressRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },

    dot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },

    dotActive: {
      backgroundColor: PRIMARY,
    },

    dotInactive: {
      backgroundColor: theme.bgSoft,
    },

    stepLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 20,
    },

    hero: {
      marginBottom: 20,
    },

    screenTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },

    screenSub: {
      fontSize: 13,
      color: theme.textMuted,
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
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 20,
      marginBottom: 16,
      boxShadow: "0px 2px 6px rgba(0,0,0,0.04)",
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },

    cardTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      flexShrink: 1,
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
      borderColor: theme.borderStrong,
      backgroundColor: theme.bgInput,
    },

    chipSelected: {
      backgroundColor: "#EEF4FF",
      borderColor: PRIMARY,
    },

    chipText: {
      fontSize: 13,
      color: theme.textSecondary,
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
      borderColor: theme.border,
      backgroundColor: theme.bgInput,
      paddingHorizontal: 14,
      color: theme.text,
      ...Typography.button,
    },

    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },

    backBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },

    backBtnText: {
      color: PRIMARY,
      fontSize: 15,
      fontWeight: "600",
    },

    nextBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
    },

    nextBtnFull: {
      flex: 1,
    },

    nextBtnText: {
      color: "#FFFFFF",
      ...Typography.button,
    },

    disabledBtn: {
      opacity: 0.7,
    },
  });
}
