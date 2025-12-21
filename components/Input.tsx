import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import Colors from "../constants/Colors";
import Spacing from "../constants/Spacing";
import Typography from "../constants/Typography";

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;          // لو في خطأ اعرضه
  containerStyle?: ViewStyle;
};

export default function Input({
  label,
  helperText,
  error,
  containerStyle,
  style,
  ...props
}: Props) {
  const showError = !!error;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        {...props}
        // مهم: value لازم يكون string بالويب
        value={typeof props.value === "string" ? props.value : String(props.value ?? "")}
        placeholderTextColor={Colors.textMuted}
        style={[
          styles.input,
          showError && styles.inputError,
          style,
        ]}
      />

      {showError ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    ...Typography.body,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  helper: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
