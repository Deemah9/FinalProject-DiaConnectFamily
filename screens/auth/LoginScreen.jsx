import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Button from "../../components/Button";
import Input from "../../components/Input";

import { Colors } from "../../constants/Colors";
import { Spacing } from "../../constants/Spacing";
import { Typography } from "../../constants/Typography";

import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login, loading: authLoading, authError, setAuthError } =
    useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // errors per-field (أفضل UX)
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    let ok = true;
    setEmailError("");
    setPasswordError("");
    setAuthError?.("");

    if (!email.trim() || !email.includes("@")) {
      setEmailError("Invalid email address");
      ok = false;
    }

    if (!password || password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      ok = false;
    }

    return ok;
  };

  const onLogin = async () => {
    if (!validate()) return;

    const res = await login({ email, password });
    if (!res?.ok) {
      // authError already set inside context, لكن هي احتياط
      setAuthError?.(res?.message || "Login failed");
    }
    // ✅ إذا ok: RootNavigator رح ينقلك تلقائيًا لـ Main
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, { color: Colors.text }]}>Login</Text>

      {authError ? <Text style={styles.error}>{authError}</Text> : null}

      <Input
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (emailError) setEmailError("");
          if (authError) setAuthError?.("");
        }}
        placeholder="email@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        error={emailError}
      />

      <Input
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (passwordError) setPasswordError("");
          if (authError) setAuthError?.("");
        }}
        placeholder="********"
        secureTextEntry
        error={passwordError}
      />

      <Button title="Login" loading={authLoading} onPress={onLogin} />

      <Text style={styles.link} onPress={() => navigation.navigate("Register")}>
        Create new account
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
    backgroundColor: Colors.bg,
    flex: 1,
  },
  error: {
    color: Colors.danger,
    ...Typography.caption,
  },
  link: {
    textAlign: "center",
    marginTop: Spacing.sm,
    color: Colors.primary,
    ...Typography.body,
  },
});
