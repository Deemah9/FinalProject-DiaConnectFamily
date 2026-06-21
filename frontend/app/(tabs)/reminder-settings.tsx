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
  Text,
  TextInput,
  View,
} from "react-native";
import CustomSwitch from "@/src/components/CustomSwitch";

import ScrollTimePicker from "@/components/ScrollTimePicker";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  Reminder,
  formatTime,
  loadReminderSettings,
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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerHour, setPickerHour] = useState("08");
  const [pickerMin, setPickerMin] = useState("00");
  const [pickerPM, setPickerPM] = useState(false);
  const [pickerName, setPickerName] = useState("");
  const [deleteConfirmReminder, setDeleteConfirmReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    loadReminderSettings().then(({ reminders: saved, enabled: savedEnabled }) => {
      setReminders(saved);
      setEnabled(savedEnabled);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(
    async (newReminders: Reminder[], newEnabled: boolean) => {
      setReminders(newReminders);
      setEnabled(newEnabled);
      await saveReminderPreferences(
        newReminders,
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
    await persist(reminders, val);
  };

  const openPicker = () => {
    setPickerHour("08");
    setPickerMin("00");
    setPickerPM(false);
    setPickerName("");
    setPickerOpen(true);
  };

  const handleAddReminder = async () => {
    const time24 = to24h(pickerHour, pickerMin, pickerPM);
    setPickerOpen(false);
    // Prevent exact duplicate (same name + same time)
    if (reminders.some((r) => r.time === time24 && r.name === pickerName.trim())) return;
    const newReminder: Reminder = { name: pickerName.trim(), time: time24 };
    const sorted = [...reminders, newReminder].sort((a, b) => a.time.localeCompare(b.time));
    await persist(sorted, true);
  };

  const handleDeleteReminder = async () => {
    if (!deleteConfirmReminder) return;
    const updated = reminders.filter(
      (r) => !(r.time === deleteConfirmReminder.time && r.name === deleteConfirmReminder.name)
    );
    setDeleteConfirmReminder(null);
    await persist(updated, enabled);
  };

  if (loading) return null;

  const amLabel = t("am", "AM");
  const pmLabel = t("pm", "PM");

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
            <CustomSwitch
              value={enabled}
              onValueChange={handleToggleEnabled}
              colorOn={PRIMARY}
              colorOff={theme.borderStrong}
              accessibilityLabel={t("aria.enableReminders")}
            />
          </View>
        </View>

        {/* Reminders list */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t("reminderTimesSection")}</Text>

          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={36} color={theme.inactive} />
              <Text style={styles.emptyText}>{t("noRemindersAdded")}</Text>
            </View>
          ) : (
            <View style={styles.timesList}>
              {reminders.map((reminder, idx) => (
                <View key={`${reminder.time}-${idx}`} style={styles.timeRow}>
                  <View style={styles.timeLeft}>
                    <Ionicons name="time-outline" size={18} color={PRIMARY} />
                    <View style={styles.timeInfo}>
                      {reminder.name ? (
                        <Text style={styles.reminderName}>{reminder.name}</Text>
                      ) : null}
                      <Text style={styles.timeText}>
                        {formatTime(reminder.time, amLabel, pmLabel)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => setDeleteConfirmReminder(reminder)}
                    hitSlop={10}
                    accessibilityLabel={t("aria.deleteTime", {
                      time: formatTime(reminder.time, amLabel, pmLabel),
                    })}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {reminders.length < MAX_REMINDERS ? (
            <Pressable
              style={styles.addBtn}
              onPress={openPicker}
              accessibilityLabel={t("aria.addTime")}
              accessibilityRole="button"
            >
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={deleteConfirmReminder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmReminder(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="trash-outline" size={28} color="#D32F2F" />
            </View>
            <Text style={styles.confirmTitle}>
              {t("deleteReminderTitle", "Remove Reminder")}
            </Text>
            <Text style={styles.confirmMsg}>
              {deleteConfirmReminder
                ? t("deleteReminderConfirm", {
                    time: formatTime(deleteConfirmReminder.time, amLabel, pmLabel),
                    defaultValue: `Remove reminder at ${formatTime(deleteConfirmReminder.time, amLabel, pmLabel)}?`,
                  })
                : ""}
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setDeleteConfirmReminder(null)}>
                <Text style={styles.confirmCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteBtn} onPress={handleDeleteReminder}>
                <Text style={styles.confirmDeleteText}>{t("delete", "Remove")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Time + Name picker modal ── */}
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
            <Text style={styles.modalTitle}>{t("addReminderTime")}</Text>

            {/* Name input */}
            <View style={styles.nameInputWrap}>
              <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} style={styles.nameIcon} />
              <TextInput
                style={styles.nameInput}
                placeholder={t("reminderNamePlaceholder", "e.g. Insulin dose")}
                placeholderTextColor={theme.inactive}
                value={pickerName}
                onChangeText={setPickerName}
                maxLength={40}
                returnKeyType="done"
              />
            </View>

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
              <Pressable style={styles.modalSave} onPress={handleAddReminder}>
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
    timeLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    timeInfo: { flex: 1 },
    reminderName: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 2,
    },
    timeText: {
      fontSize: 17,
      fontWeight: "700",
      color: PRIMARY,
      writingDirection: "ltr",
    },
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

    // Delete confirmation modal
    confirmBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    confirmBox: {
      backgroundColor: theme.bgCard,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      alignItems: "center",
      boxShadow: "0px 0px 20px rgba(0,0,0,0.15)",
    },
    confirmIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: "#FDEDED",
      alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    },
    confirmTitle: { fontSize: 17, fontWeight: "700", color: theme.text, marginBottom: 8 },
    confirmMsg: {
      fontSize: 14, color: theme.textMuted,
      textAlign: "center", marginBottom: 24, lineHeight: 20,
    },
    confirmBtns: { flexDirection: "row", gap: 12, width: "100%" },
    confirmCancelBtn: {
      flex: 1, height: 48, borderRadius: 14,
      borderWidth: 1, borderColor: theme.border,
      alignItems: "center", justifyContent: "center",
    },
    confirmCancelText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
    confirmDeleteBtn: {
      flex: 1, height: 48, borderRadius: 14,
      backgroundColor: "#D32F2F",
      alignItems: "center", justifyContent: "center",
    },
    confirmDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

    // Time picker modal
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

    // Name input inside picker modal
    nameInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      height: 48,
    },
    nameIcon: { marginRight: 8 },
    nameInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
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
