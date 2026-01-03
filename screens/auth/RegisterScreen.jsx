import { useContext, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Button from "../../components/Button";
import Input from "../../components/Input";

import { Colors } from "../../constants/Colors";
import { Spacing } from "../../constants/Spacing";
import { Typography } from "../../constants/Typography";

import { AuthContext } from "../../context/AuthContext";

export default function RegisterScreen({ navigation }) {
  const { register, loading: authLoading, authError, setAuthError } =
    useContext(AuthContext);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    let ok = true;
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setAuthError?.("");

    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      ok = false;
    }

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

  const onRegister = async () => {
    if (!validate()) return;

    const res = await register({ name, email, password });
    if (!res?.ok) {
      setAuthError?.(res?.message || "Register failed");
    }
    // ✅ إذا رجع token من الباكند: RootNavigator ينقلك تلقائيًا للـ Main
    // ✅ إذا الباكند ما يرجع token بعد register: رح يظل في auth (ممكن نخليه يروح Login)
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, { color: Colors.text }]}>Register</Text>

      {authError ? <Text style={styles.error}>{authError}</Text> : null}

      <Input
        label="Full Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (nameError) setNameError("");
          if (authError) setAuthError?.("");
        }}
        placeholder="Your name"
        error={nameError}
      />

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

      <Button title="Create Account" loading={authLoading} onPress={onRegister} />

      <Text style={styles.link} onPress={() => navigation.goBack()}>
        Back to login
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
