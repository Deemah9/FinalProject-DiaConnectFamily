import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";

export default function ProfileScreen() {
  const user = {
    firstName: "Wagdi",
    lastName: "Alfrawona",
    email: "wagde1100@gmail.com",
    role: "Patient",
    diabetesType: "Type 1",
    exercise: "3 times / week",
    sleep: "7 hours",
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={34} color={stylesVars.primary} />
          </View>

          <Text style={styles.name}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="medkit-outline" size={18} color={stylesVars.primary} />
            <Text style={styles.cardTitle}>Medical Info</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Diabetes Type</Text>
            <Text style={styles.value}>{user.diabetesType}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="leaf-outline" size={18} color={stylesVars.primary} />
            <Text style={styles.cardTitle}>Lifestyle</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Exercise</Text>
            <Text style={styles.value}>{user.exercise}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Sleep</Text>
            <Text style={styles.value}>{user.sleep}</Text>
          </View>
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/edit-profile" as any)}
        >
          <Text style={styles.primaryText}>Edit Profile</Text>
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

  header: {
    alignItems: "center",
    marginTop: Spacing.md,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    marginTop: Spacing.md,
    color: stylesVars.text,
    fontSize: 22,
    fontWeight: "800",
  },

  email: {
    marginTop: 4,
    color: stylesVars.muted,
    fontSize: 13,
  },

  roleBadge: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  roleText: {
    color: stylesVars.text,
    fontSize: 12,
    fontWeight: "700",
  },

  card: {
    marginTop: Spacing.lg,
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

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  cardTitle: {
    color: stylesVars.text,
    fontSize: 14,
    fontWeight: "800",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  label: {
    color: stylesVars.muted,
    fontSize: 13,
  },

  value: {
    color: stylesVars.text,
    fontSize: 13,
    fontWeight: "700",
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