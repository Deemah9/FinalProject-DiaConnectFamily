import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import ScrollTimePicker from "@/components/ScrollTimePicker";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  formatTime,
  from24h,
  getRemindersEnabled,
  getReminderTimes,
  saveReminderPreferences,
  to24h,
} from "@/services/reminderScheduler";
import AppHeader from "@/src/components/AppHeader";

const MAX_REMINDERS = 8;
const PRIMARY = "#1A6FA8";

export default function ReminderSettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [enabled, setEnabled] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerHour, setPickerHour] = useState("08");
  const [pickerMin, setPickerMin] = useState("00");
  const [pickerPM, setPickerPM] = useState(false);

  useEffect(() => {
    Promise.all([getReminderTimes(), getRemindersEnabled()]).then(
      ([savedTimes, savedEnabled]) => {
        setTimes(savedTimes);
        setEnabled(savedEnabled);
        setLoading(false);
      }
    );
  }, []);

  const persist = useCallback(
    async (newTimes: string[], newEnabled: boolean) => {
      setTimes(newTimes);
      setEnabled(newEnabled);
      await saveReminderPreferences(
        newTimes,
        newEnabled,
        t("reminderNotifTitle", "Glucose Reminder"),
        t("reminderNotifBody", "Time to measure your blood glucose 🩸")
      );
    },
    [t]
  );

  const requestPermission = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch { /* web — silently skip */ }
  };

  const handleToggleEnabled = async (val: boolean) => {
    if (val) await requestPermission();
    await persist(times, val);
  };

  const openPicker = () => {
    setPickerHour("08");
    setPickerMin("00");
    setPickerPM(false);
    setPickerOpen(true);
  };

  const handleAddTime = async () => {
    const time24 = to24h(pickerHour, pickerMin, pickerPM);
    setPickerOpen(false);
    if (times.includes(time24)) return;
    const sorted = [...times, time24].sort();
    // Enable automatically when adding first reminder
    await persist(sorted, sorted.length > 0 ? true : enabled);
  };

  const handleDeleteTime = async (time: string) => {
    const newTimes = times.filter((v) => v !== time);
    await persist(newTimes, enabled);
  };

  if (loading) return null;

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.headerBlock}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="alarm" size={28} color={PRIMARY} />
          </View>
          <Text style={styles.screenTitle}>{t("reminderSettings")}</Text>
          <Text style={styles.screenSub}>{t("reminderInfoNote")}</Text>
        </View>

        {/* Enable toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons
                name={enabled ? "alarm" : "alarm-outline"}
                size={20}
                color={enabled ? PRIMARY : theme.textSecondary}
              />
              <Text style={styles.toggleLabel}>{t("enableCustomReminders")}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: theme.borderStrong, true: PRIMARY }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Times section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t("reminderTimesSection")}</Text>

          {times.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={36} color={theme.inactive} />
              <Text style={styles.emptyText}>{t("noRemindersAdded")}</Text>
            </View>
          ) : (
            <View style={styles.timesList}>
              {times.map((time) => (
                <View key={time} style={styles.timeRow}>
                  <View style={styles.timeLeft}>
                    <Ionicons name="time-outline" size={18} color={PRIMARY} />
                    <Text style={styles.timeText}>
                      {formatTime(time, t("am", "AM"), t("pm", "PM"))}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteTime(time)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {times.length < MAX_REMINDERS ? (
            <Pressable style={styles.addBtn} onPress={openPicker}>
              <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
              <Text style={styles.addBtnText}>{t("addReminderTime")}</Text>
            </Pressable>
          ) : (
            <Text style={styles.maxNote}>
              {t("maxRemindersNote", { max: MAX_REMINDERS })}
            </Text>
          )}
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.infoText}>{t("reminderPermission")}</Text>
        </View>

      </ScrollView>

      {/* Time picker bottom sheet modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setPickerOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t("selectTime")}</Text>

            <ScrollTimePicker
              label=""
              hours={pickerHour}
              minutes={pickerMin}
              isPM={pickerPM}
              onHoursChange={setPickerHour}
              onMinutesChange={setPickerMin}
              onTogglePeriod={setPickerPM}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={handleAddTime}>
                <Text style={styles.modalSaveText}>{t("add")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 56, gap: 16 },

    headerBlock: {
      alignItems: "center",
      paddingVertical: 16,
      gap: 8,
    },
    headerIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${PRIMARY}15`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    screenSub: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 19,
      paddingHorizontal: 16,
    },

    card: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 14,
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    toggleLabel: { fontSize: 15, fontWeight: "600", color: theme.text },

    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.textLight,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },

    emptyState: { alignItems: "center", paddingVertical: 18, gap: 8 },
    emptyText: { fontSize: 13, color: theme.inactive, textAlign: "center" },

    timesList: { gap: 8 },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.bgSoft,
    },
    timeLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    timeText: {
      fontSize: 17,
      fontWeight: "700",
      color: PRIMARY,
      direction: "ltr",
    } as any,
    deleteBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: "#FDEDED",
      alignItems: "center",
      justifyContent: "center",
    },

    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: "dashed" as any,
      borderColor: PRIMARY,
    },
    addBtnText: { fontSize: 14, fontWeight: "600", color: PRIMARY },

    maxNote: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: "center",
    },

    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: `${PRIMARY}10`,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: `${PRIMARY}25`,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },

    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: theme.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingTop: 12,
      gap: 20,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    modalActions: { flexDirection: "row", gap: 12 },
    modalCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.borderStrong,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    modalSave: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: PRIMARY,
      alignItems: "center",
    },
    modalSaveText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
