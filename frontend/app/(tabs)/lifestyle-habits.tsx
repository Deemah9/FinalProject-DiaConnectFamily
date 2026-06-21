import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { getProfile, updateLifestyle } from "@/services/api";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function LifestyleHabitsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [isEditing, setIsEditing] = useState(false);

  const [activityLevel, setActivityLevel] = useState("");
  const [sleepHours, setSleepHours] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadLifestyleInfo = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const data = await getProfile();
      const lifestyle = data?.lifestyle || {};

      setActivityLevel(lifestyle?.activity_level || "");
      setSleepHours(
        lifestyle?.sleep_hours !== undefined && lifestyle?.sleep_hours !== null
          ? String(lifestyle.sleep_hours)
          : ""
      );
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to load lifestyle info");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLifestyleInfo();
    }, [])
  );

  const onCancel = async () => {
    setIsEditing(false);
    await loadLifestyleInfo();
  };

  const onSave = async () => {
    try {
      setSaving(true);
      setErrorMsg("");

      await updateLifestyle({
        activity_level: activityLevel,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
      });

      await loadLifestyleInfo();
      setIsEditing(false);
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to update lifestyle info");
    } finally {
      setSaving(false);
    }
  };

  const activityOptions = ["low", "moderate", "high"];

  return (
    <View style={styles.container}>
      <AppHeader />
<ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* Title */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t("lifestyleHabits")}</Text>
            <Text style={styles.screenSub}>{t("manageDailyHabits")}</Text>
          </View>

          {!loading && (
            <Pressable
              style={styles.editBtn}
              onPress={() => setIsEditing((prev) => !prev)}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color="#1A6FA8"
              />
              <Text style={styles.editBtnText}>{isEditing ? t("close") : t("edit")}</Text>
            </Pressable>
          )}
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="moon-outline"
              size={18}
              color="#1A6FA8"
            />
            <Text style={styles.cardTitle}>{t("lifestyleDetails")}</Text>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>{t("loadingLifestyle")}</Text>
          ) : (
            <>
              {/* Activity Level */}
              <View style={styles.itemBlock}>
                <Text style={styles.itemLabel}>{t("activityLevel")}</Text>

                {isEditing ? (
                  <View style={styles.optionsWrap}>
                    {activityOptions.map((option) => {
                      const selected = activityLevel === option;
                      return (
                        <Pressable
                          key={option}
                          style={[
                            styles.optionChip,
                            selected && styles.optionChipSelected,
                          ]}
                          onPress={() => setActivityLevel(option)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              selected && styles.optionChipTextSelected,
                            ]}
                          >
                            {t(`activity${option.charAt(0).toUpperCase() + option.slice(1)}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.rowDisplay}>
                    <Text style={styles.rowValue}>{activityLevel || "--"}</Text>
                  </View>
                )}
              </View>

              {/* Sleep Hours */}
              <View style={styles.itemBlock}>
                <Text style={styles.itemLabel}>{t("sleepHours")}</Text>

                {isEditing ? (
                  <TextInput
                    value={sleepHours}
                    onChangeText={setSleepHours}
                    placeholder={t("sleepHoursPlaceholder")}
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                ) : (
                  <View style={styles.rowDisplay}>
                    <Text style={styles.rowValue}>{sleepHours || "--"}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Bottom Buttons */}
        {isEditing && !loading && (
          <View style={styles.bottomActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
            </Pressable>

            <Pressable
              style={[styles.saveBtn, saving && styles.disabledBtn]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t("saving") : t("saveChanges")}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 24 }} />
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
    paddingTop: 20,
    paddingBottom: 40,
  },

  heroRow: {
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
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

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.primaryBg,
  },

  editBtnText: {
    color: "#1A6FA8",
    fontSize: 14,
    fontWeight: "600",
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.bgSoft,
    padding: 24,
    boxShadow: "0px 3px 8px rgba(0,0,0,0.05)",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },

  loadingText: {
    fontSize: 14,
    color: theme.textMuted,
  },

  itemBlock: {
    marginBottom: 18,
  },

  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textSecondary,
    marginBottom: 10,
  },

  rowDisplay: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },

  rowValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
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

  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.bgInput,
  },

  optionChipSelected: {
    backgroundColor: theme.primaryBg,
    borderColor: "#1A6FA8",
  },

  optionChipText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: "500",
  },

  optionChipTextSelected: {
    color: "#1A6FA8",
    fontWeight: "700",
  },

  bottomActions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },

  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: theme.text,
    ...Typography.button,
  },

  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1A6FA8",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.05)",
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
