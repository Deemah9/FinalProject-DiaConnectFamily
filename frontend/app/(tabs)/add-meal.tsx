import { router } from "expo-router";
import { markPredictionStale } from "@/services/predictionFlag";
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

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { addMeal } from "@/services/api";
import ScrollTimePicker from "@/components/ScrollTimePicker";
import { buildTimestamp, initTime } from "@/components/TimePicker";
import { useAppTheme } from "@/hooks/useAppTheme";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

export default function AddMealScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [carbs, setCarbs] = useState("");
  const [foods, setFoods] = useState("");
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [notes, setNotes] = useState("");
  const [timeState, setTime] = useState(initTime);
  const { hours, minutes, isPM } = timeState;
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSave = async () => {
    try {
      setErrorMsg("");

      if (!foods.trim()) {
        setErrorMsg(t("enterMealFoods"));
        return;
      }

      const carbsValue = Number(carbs);
      if (!carbs || Number.isNaN(carbsValue) || carbsValue < 0) {
        setErrorMsg(t("invalidCarbs"));
        return;
      }

      setSaving(true);

      await addMeal({
        carbs: carbsValue,
        foods: foods.trim(),
        meal_type: mealType || undefined,
        notes: notes.trim(),
        timestamp: buildTimestamp(hours, minutes, isPM),
      });

      markPredictionStale();
      router.back();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to add meal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("addMeal")}</Text>
          <Text style={styles.screenSub}>{t("logMealCarbs")}</Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.formCard}>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("foods")}</Text>
            <TextInput
              value={foods}
              onChangeText={setFoods}
              placeholder={t("foodsPlaceholder")}
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("mealType")}</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, mealType === type && styles.chipActive]}
                  onPress={() => setMealType(mealType === type ? null : type)}
                >
                  <Text style={[styles.chipText, mealType === type && styles.chipTextActive]}>
                    {t(type)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("carbsG")}</Text>
            <TextInput
              value={carbs}
              onChangeText={setCarbs}
              placeholder={t("carbsPlaceholder")}
              placeholderTextColor={theme.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("notes")}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("optionalNotes")}
              placeholderTextColor={theme.placeholder}
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <ScrollTimePicker
              label={t("time")}
              hours={hours}
              minutes={minutes}
              isPM={isPM}
              onHoursChange={(v: string) => setTime((prev) => ({ ...prev, hours: v }))}
              onMinutesChange={(v: string) => setTime((prev) => ({ ...prev, minutes: v }))}
              onTogglePeriod={(v: boolean) => setTime((prev) => ({ ...prev, isPM: v }))}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.disabledBtn]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? t("saving") : t("saveMeal")}
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },

    content: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },

    hero: {
      marginTop: 28,
      marginBottom: 20,
    },

    screenTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 8,
    },

    screenSub: {
      color: theme.textMuted,
      fontSize: 14,
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

    formCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 24,
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    formGroup: {
      marginBottom: 18,
    },

    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 10,
    },

    input: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgInput,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: theme.text,
      ...Typography.button,
    },

    textArea: {
      minHeight: 96,
      textAlignVertical: "top",
    },

    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgInput,
    },

    chipActive: {
      backgroundColor: "#1A6FA8",
      borderColor: "#1A6FA8",
    },

    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textMuted,
    },

    chipTextActive: {
      color: "#FFFFFF",
    },

    saveBtn: {
      marginTop: 10,
      height: 48,
      borderRadius: 16,
      backgroundColor: "#1A6FA8",
      alignItems: "center",
      justifyContent: "center",
    },

    disabledBtn: {
      opacity: 0.7,
    },

    saveBtnText: {
      color: "#FFFFFF",
      ...Typography.button,
    },
  });
}
