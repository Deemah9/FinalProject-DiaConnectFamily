import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { getProfile, updateLifestyle } from "@/services/api";
import { useTranslation } from "react-i18next";

export default function LifestyleHabitsScreen() {
  const { t } = useTranslation();
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
      console.log("loadLifestyleInfo error:", error);
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
      console.log("lifestyle save error:", error);
      setErrorMsg(error?.message || "Failed to update lifestyle info");
    } finally {
      setSaving(false);
    }
  };

  const activityOptions = ["low", "moderate", "high"];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.menuBtn}>
            <Ionicons name="arrow-back" size={22} color="#1E3A52" />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color={Colors.gold} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>{t("diaConnect")}</Text>
              <Text style={styles.logoSub}>{t("family")}</Text>
            </View>
          </View>

          <View style={styles.placeholder} />
        </View>

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
                color={stylesVars.primary}
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
              color={stylesVars.primary}
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
                    placeholderTextColor={stylesVars.muted}
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

const stylesVars = {
  primary: "#1A6FA8",
  bg: "#FFFFFF",
  text: "#0B1A2E",
  muted: "#4A6480",
  border: "#B8D0E8",
  soft: "#E8F1F8",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: stylesVars.bg,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D6E8F5",
  },

  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  placeholder: {
    width: 40,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoTitle: {
    color: "#0B1A2E",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: "#4A6480",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "300",
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
    color: stylesVars.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  screenSub: {
    color: stylesVars.muted,
    fontSize: 14,
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
  },

  editBtnText: {
    color: stylesVars.primary,
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

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: stylesVars.text,
  },

  loadingText: {
    fontSize: 14,
    color: stylesVars.muted,
  },

  itemBlock: {
    marginBottom: 18,
  },

  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E3A52",
    marginBottom: 10,
  },

  rowDisplay: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEFF3",
  },

  rowValue: {
    fontSize: 15,
    fontWeight: "600",
    color: stylesVars.text,
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
    borderColor: "#D1D5DB",
    backgroundColor: "#E8F1F8",
  },

  optionChipSelected: {
    backgroundColor: "#EEF4FF",
    borderColor: "#1A6FA8",
  },

  optionChipText: {
    fontSize: 13,
    color: "#1E3A52",
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
    borderColor: "#B8D0E8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: "#0B1A2E",
    ...Typography.button,
  },

  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: stylesVars.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  saveBtnText: {
    color: "#FFFFFF",
    ...Typography.button,
  },
});