import { Ionicons } from "@expo/vector-icons";
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

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { getProfile, updateProfile } from "@/services/api";

export default function EditProfileScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getProfile();

      setFirstName(data.firstName || data.first_name || "");
      setLastName(data.lastName || data.last_name || "");
      setPhone(data.phone || "");
    } catch (error) {
      console.log("Profile load error", error);
    }
  };

  const onSave = async () => {
    try {
      await updateProfile({
        firstName,
        lastName,
        phone,
      });

      router.back();
    } catch (error) {
      console.log("Update profile error", error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Logo */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.menuBtn}>
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color={Colors.gold} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>DiaConnect</Text>
              <Text style={styles.logoSub}>Family</Text>
            </View>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>Edit Profile</Text>
          <Text style={styles.screenSub}>Update your information</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor={stylesVars.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor={stylesVars.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor={stylesVars.muted}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  primary: "#4A7DC9",
  bg: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  soft: "#F9FAFB",
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
    borderBottomColor: "#F3F4F6",
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
    color: "#1F2937",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: "#6B7280",
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

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
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
    color: "#374151",
    marginBottom: 10,
  },

  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    color: "#1F2937",
    ...Typography.button,
  },

  saveBtn: {
    marginTop: 10,
    height: 54,
    borderRadius: 14,
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