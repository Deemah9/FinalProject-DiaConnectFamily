import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { getProfile, updateProfile } from "@/services/api";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await getProfile();
        if (!active) return;
        setFirstName(data.firstName || data.first_name || "");
        setLastName(data.lastName || data.last_name || "");
        setPhone(data.phone || "");
      } catch (error: any) {
        if (!active) return;
        setErrorMsg(error?.message || "Failed to load profile");
      }
    };
    run();
    return () => { active = false; };
  }, []);

  const onSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setErrorMsg("");
      await updateProfile({
        firstName,
        lastName,
        phone,
      });

      router.back();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader />
<ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("editProfile")}</Text>
          <Text style={styles.screenSub}>{t("updateInfo")}</Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("firstName")}</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t("firstName")}
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("lastName")}</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder={t("lastName")}
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("phone")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("phone")}
              placeholderTextColor={theme.placeholder}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? t("saving") : t("saveChanges")}</Text>
          </Pressable>
        </View>
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
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgInput,
      paddingHorizontal: 14,
      color: theme.text,
      ...Typography.button,
    },

    saveBtn: {
      marginTop: 10,
      height: 48,
      borderRadius: 16,
      backgroundColor: "#1A6FA8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    saveBtnText: {
      color: "#FFFFFF",
      ...Typography.button,
    },
  });
}
