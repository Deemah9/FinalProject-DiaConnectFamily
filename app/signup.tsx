import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { Typography } from "@/constants/Typography";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const em = email.trim();

    if (!firstName.trim()) e.firstName = "First name is required";
    if (!lastName.trim()) e.lastName = "Last name is required";

    if (!em) e.email = "Email is required";
    else if (!emailRegex.test(em)) e.email = "Invalid email";

    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Min 6 characters";

    if (!confirmPassword) e.confirmPassword = "Confirm your password";
    else if (confirmPassword !== password) e.confirmPassword = "Passwords do not match";

    return e;
  }, [firstName, lastName, email, password, confirmPassword]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  async function onSignUp() {
    setGeneralError("");
    if (!canSubmit) return;

    try {
      setLoading(true);

      // TODO: اربط API حقيقي
      await new Promise((r) => setTimeout(r, 1000));

      router.replace("/(tabs)");
    } catch (e) {
      setGeneralError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand} pointerEvents="none">
          <Ionicons name="heart-outline" size={46} color={Colors.gold} />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.brandTitle}>DiaConnect</Text>
            <Text style={styles.brandSub}>Family</Text>
          </View>
        </View>

        <Text style={styles.header}>Sign up</Text>

        {!!generalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{generalError}</Text>
          </View>
        )}

        <View style={styles.form}>
          {/* ✅ First + Last name side-by-side */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, errors.firstName && styles.inputErr]}
                placeholder="First name"
                placeholderTextColor={Colors.textMuted}
                value={firstName}
                onChangeText={setFirstName}
              />
              {!!errors.firstName && <Text style={styles.errText}>{errors.firstName}</Text>}
            </View>

            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, errors.lastName && styles.inputErr]}
                placeholder="Last name"
                placeholderTextColor={Colors.textMuted}
                value={lastName}
                onChangeText={setLastName}
              />
              {!!errors.lastName && <Text style={styles.errText}>{errors.lastName}</Text>}
            </View>
          </View>

          <View>
            <TextInput
              style={[styles.input, errors.email && styles.inputErr]}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            {!!errors.email && <Text style={styles.errText}>{errors.email}</Text>}
          </View>

          <View>
            <TextInput
              style={[styles.input, errors.password && styles.inputErr]}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
            {!!errors.password && <Text style={styles.errText}>{errors.password}</Text>}
          </View>

          <View>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputErr]}
              placeholder="Confirm password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {!!errors.confirmPassword && (
              <Text style={styles.errText}>{errors.confirmPassword}</Text>
            )}
          </View>

          <Pressable
            onPress={onSignUp}
            disabled={!canSubmit}
            style={[styles.primaryBtn, (!canSubmit || loading) && styles.btnDisabled]}
          >
            <Text style={styles.primaryText}>{loading ? "Creating..." : "Create account"}</Text>
          </Pressable>
        </View>

        <Link href="/login" asChild>
          <Pressable style={{ marginTop: Spacing.lg }}>
            <Text style={styles.link}>
              Already have an account? <Text style={styles.linkBold}>Log in</Text>
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },

  topRow: { paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },

  brand: { marginTop: Spacing.sm, flexDirection: "row", alignItems: "center" },
  brandTitle: { color: Colors.white, fontSize: 22, fontWeight: "700", lineHeight: 24 },
  brandSub: { color: Colors.white, fontSize: 22, fontWeight: "300", lineHeight: 24 },

  header: { marginTop: Spacing.lg, color: Colors.white, fontSize: 22, fontWeight: "600" },

  errorBanner: {
    marginTop: Spacing.md,
    width: "100%",
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: { color: Colors.white, fontSize: 13 },

  form: { width: "100%", marginTop: Spacing.md, gap: Spacing.md },

  // ✅ صف الاسم الأول + العائلة
  nameRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 16,
    color: Colors.white,
    ...Typography.button,
  },
  inputErr: { borderColor: Colors.error },
  errText: { marginTop: Spacing.sm, color: Colors.errorText, fontSize: 12 },

  primaryBtn: {
    marginTop: Spacing.sm,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: Colors.primary, ...Typography.button },

  link: { color: Colors.linkText, fontSize: 13, textAlign: "center" },
  linkBold: { fontWeight: "700", textDecorationLine: "underline" },
});
