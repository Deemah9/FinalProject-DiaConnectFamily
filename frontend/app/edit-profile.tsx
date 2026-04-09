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

export default function EditProfileScreen() {
  const { t } = useTranslation();
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
              placeholderTextColor={stylesVars.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("lastName")}</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder={t("lastName")}
              placeholderTextColor={stylesVars.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("phone")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("phone")}
              placeholderTextColor={stylesVars.muted}
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
    backgroundColor: "#1A6FA8",
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
    flex: 1,
    justifyContent: 'center',
    flexDirection: "row",
    alignItems: "center",
  },

  logoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "300",
  },

  hero: {
    marginTop: 28,
    marginBottom: 20,
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
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#B8D0E8",
    backgroundColor: "#E8F1F8",
    paddingHorizontal: 14,
    color: "#0B1A2E",
    ...Typography.button,
  },

  saveBtn: {
    marginTop: 10,
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

  saveBtnText: {
    color: "#FFFFFF",
    ...Typography.button,
  },
});