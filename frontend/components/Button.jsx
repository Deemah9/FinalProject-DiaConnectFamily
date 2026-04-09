import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "../constants/Colors";
import { Spacing } from "../constants/Spacing";
import { FontFamily, Typography } from "../constants/Typography";

export default function Button({
  title,
  onPress,
  variant = "primary", // primary | secondary | outline | danger
  disabled = false,
  loading = false,
  fullWidth = true,
}) {
  const isDisabled = disabled || loading;
  const isOutline = variant === "outline";

  const spinnerColor = isOutline ? Colors.primary : Colors.white;
  const textColor = isOutline ? Colors.primary : Colors.white;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        styles[variant],
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <Text
            style={[styles.text, { color: textColor }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",

    // Shadow (iOS/Web)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    // Elevation (Android)
    elevation: 4,
  },

  fullWidth: {
    alignSelf: "stretch",
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  danger: { backgroundColor: Colors.danger },

  outline: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    shadowOpacity: 0.08,
    elevation: 2,
  },

  disabled: {
    opacity: 0.45,
  },

  text: {
    ...Typography.button,
    fontFamily: FontFamily,
  },
});
