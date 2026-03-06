import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";

export default function EditProfileScreen() {
  const [firstName, setFirstName] = useState("Wagdi");
  const [lastName, setLastName] = useState("Alfrawona");
  const [email, setEmail] = useState("wagde1100@gmail.com");
  const [diabetesType, setDiabetesType] = useState("Type 1");
  const [exercise, setExercise] = useState("3 times / week");
  const [sleep, setSleep] = useState("7 hours");

  const onSave = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={stylesVars.text} />
          </Pressable>
        </View>

        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.card}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor={stylesVars.muted}
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor={stylesVars.muted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={stylesVars.muted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Diabetes Type</Text>
          <TextInput
            value={diabetesType}
            onChangeText={setDiabetesType}
            style={styles.input}
            placeholder="Diabetes Type"
            placeholderTextColor={stylesVars.muted}
          />

          <Text style={styles.label}>Exercise</Text>
          <TextInput
            value={exercise}
            onChangeText={setExercise}
            style={styles.input}
            placeholder="Exercise"
            placeholderTextColor={stylesVars.muted}
          />

          <Text style={styles.label}>Sleep</Text>
          <TextInput
            value={sleep}
            onChangeText={setSleep}
            style={styles.input}
            placeholder="Sleep"
            placeholderTextColor={stylesVars.muted}
          />
        </View>

        <Pressable style={styles.primaryBtn} onPress={onSave}>
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  primary: Colors.primary,
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: stylesVars.bg,
  },

  content: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  topRow: {
    marginBottom: Spacing.md,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: stylesVars.border,
  },

  title: {
    color: stylesVars.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: Spacing.lg,
  },

  card: {
    borderRadius: 16,
    backgroundColor: stylesVars.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: stylesVars.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  label: {
    color: stylesVars.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: stylesVars.text,
    ...Typography.button,
  },

  primaryBtn: {
    marginTop: Spacing.xl,
    height: 54,
    borderRadius: 14,
    backgroundColor: stylesVars.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    ...Typography.button,
  },
});