import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

interface TimePickerProps {
  label: string;
  hours: string;
  minutes: string;
  isPM: boolean;
  onHoursChange: (v: string) => void;
  onMinutesChange: (v: string) => void;
  onTogglePeriod: (isPM: boolean) => void;
}

export default function TimePicker({
  label,
  hours,
  minutes,
  isPM,
  onHoursChange,
  onMinutesChange,
  onTogglePeriod,
}: TimePickerProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={hours}
          onChangeText={(v) => {
            const n = v.replace(/[^0-9]/g, "");
            onHoursChange(n.slice(0, 2));
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="12"
          placeholderTextColor="#9CA3AF"
          style={styles.timeInput}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          value={minutes}
          onChangeText={(v) => {
            const n = v.replace(/[^0-9]/g, "");
            onMinutesChange(n.slice(0, 2));
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="00"
          placeholderTextColor="#9CA3AF"
          style={styles.timeInput}
        />
        <View style={styles.periodWrap}>
          <Pressable
            style={[styles.periodBtn, !isPM && styles.periodBtnActive]}
            onPress={() => onTogglePeriod(false)}
          >
            <Text style={[styles.periodText, !isPM && styles.periodTextActive]}>
              {t("am")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.periodBtn, isPM && styles.periodBtnActive]}
            onPress={() => onTogglePeriod(true)}
          >
            <Text style={[styles.periodText, isPM && styles.periodTextActive]}>
              {t("pm")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function buildTimestamp(hours: string, minutes: string, isPM: boolean): string {
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10) || 0;
  if (Number.isNaN(h) || h < 1 || h > 12) h = 12;
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Clamp to now — prevents backend "cannot be in the future" errors
  // when selected time is seconds ahead of the server clock
  const now = new Date();
  return (d > now ? now : d).toISOString();
}

export function initTime(): { hours: string; minutes: string; isPM: boolean } {
  const now = new Date();
  const h = now.getHours();
  return {
    hours: String(h === 0 ? 12 : h > 12 ? h - 12 : h).padStart(2, "0"),
    minutes: String(now.getMinutes()).padStart(2, "0"),
    isPM: h >= 12,
  };
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeInput: {
    width: 56,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    color: "#1F2937",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  colon: {
    fontSize: 22,
    fontWeight: "700",
    color: "#374151",
  },
  periodWrap: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    marginLeft: 4,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  periodBtnActive: {
    backgroundColor: "#4A7DC9",
  },
  periodText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  periodTextActive: {
    color: "#FFFFFF",
  },
});
