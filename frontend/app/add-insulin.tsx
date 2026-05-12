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

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { addInsulinDose } from "@/services/api";
import TimePicker, { buildTimestamp, initTime } from "@/components/TimePicker";

const FAST_INSULIN_IDS = [
  "insulin_humalog",
  "insulin_novorapid",
  "insulin_apidra",
  "insulin_fiasp",
] as const;
type FastInsulinId = typeof FAST_INSULIN_IDS[number];

const PRIMARY = "#1A6FA8";

export default function AddInsulinScreen() {
  const { t } = useTranslation();
  const [insulinType, setInsulinType] = useState<FastInsulinId | null>(null);
  const [units, setUnits] = useState("");
  const [notes, setNotes] = useState("");
  const [timeState, setTime] = useState(initTime);
  const { hours, minutes, isPM } = timeState;
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSave = async () => {
    try {
      setErrorMsg("");

      if (!insulinType) {
        setErrorMsg(t("invalidInsulinType"));
        return;
      }

      const unitsVal = Number(units);
      if (!units || Number.isNaN(unitsVal) || unitsVal < 0.5 || unitsVal > 100) {
        setErrorMsg(t("invalidInsulinUnits"));
        return;
      }

      setSaving(true);

      await addInsulinDose({
        insulin_type: insulinType,
        units: unitsVal,
        notes: notes.trim() || undefined,
        timestamp: buildTimestamp(hours, minutes, isPM),
      });

      router.back();
    } catch (error: any) {
      setErrorMsg(error?.message || t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("addFastInsulin")}</Text>
          <Text style={styles.screenSub}>{t("logFastInsulin")}</Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.formCard}>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("fastInsulinType")}</Text>
            <View style={styles.chipRow}>
              {FAST_INSULIN_IDS.map((id) => (
                <Pressable
                  key={id}
                  style={[styles.chip, insulinType === id && styles.chipActive]}
                  onPress={() => setInsulinType(insulinType === id ? null : id)}
                >
                  <Text style={[styles.chipText, insulinType === id && styles.chipTextActive]}>
                    {t(id)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("fastInsulinUnits")}</Text>
            <TextInput
              value={units}
              onChangeText={setUnits}
              placeholder={t("fastInsulinUnitsPlaceholder")}
              placeholderTextColor="#4A6480"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("notes")}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("optionalNotes")}
              placeholderTextColor="#4A6480"
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <TimePicker
              label={t("time")}
              hours={hours}
              minutes={minutes}
              isPM={isPM}
              onHoursChange={(v) => setTime((prev) => ({ ...prev, hours: v }))}
              onMinutesChange={(v) => setTime((prev) => ({ ...prev, minutes: v }))}
              onTogglePeriod={(v) => setTime((prev) => ({ ...prev, isPM: v }))}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.disabledBtn]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? t("saving") : t("saveFastInsulin")}
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBF3FA" },

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
    color: "#0B1A2E",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  screenSub: {
    color: "#4A6480",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 24,
    shadowColor: "#000",
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
    color: "#1E3A52",
    marginBottom: 10,
  },

  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#B8D0E8",
    backgroundColor: "#E8F1F8",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#0B1A2E",
    ...Typography.button,
  },

  textArea: {
    minHeight: 80,
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
    borderColor: "#B8D0E8",
    backgroundColor: "#E8F1F8",
  },

  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A6480",
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  saveBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY,
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
