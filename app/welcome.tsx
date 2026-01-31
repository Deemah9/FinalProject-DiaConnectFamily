import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Logo (لا يلتقط ضغط بالخطأ) */}
      <View style={styles.brand} pointerEvents="none">
        <Ionicons name="heart-outline" size={46} color={Colors.gold} />
        <View style={{ marginLeft: Spacing.md }}>
          <Text style={styles.title}>DiaConnect</Text>
          <Text style={styles.subtitle}>Family</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.actions}>
        <Link href="/signup" asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Sign up</Text>
          </Pressable>
        </Link>

        <Link href="/login" asChild>
          <Pressable style={styles.outlineBtn}>
            <Text style={styles.outlineText}>Log in</Text>
          </Pressable>
        </Link>

        <Text style={styles.footer}>Decision-support application</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  brand: {
    marginTop: 100,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: Colors.white,
    ...Typography.title,
    lineHeight: 26,
  },
  subtitle: {
    color: Colors.white,
    ...Typography.subtitle,
    lineHeight: 26,
  },
  actions: {
    position: "absolute",
    bottom: 90,
    left: Spacing.xl,
    right: Spacing.xl,
    gap: Spacing.md,
    alignItems: "center",
    zIndex: 10,
    elevation: 10,
  },
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: Colors.primary,
    ...Typography.button,
  },
  outlineBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    color: Colors.white,
    ...Typography.button,
  },
  footer: {
    marginTop: Spacing.sm,
    color: Colors.textMuted,
    ...Typography.footer,
  },
});
