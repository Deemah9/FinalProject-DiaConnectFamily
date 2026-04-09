import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import Colors from "../constants/Colors";
import Spacing from "../constants/Spacing";

type CardVariant = "default" | "outline" | "filled";

type Props = ViewProps & {
  variant?: CardVariant;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function Card({
  variant = "default",
  padded = true,
  style,
  children,
  ...props
}: Props) {
  return (
    <View
      {...props}
      style={[
        styles.base,
        padded && styles.padded,
        variant === "default" && styles.default,
        variant === "filled" && styles.filled,
        variant === "outline" && styles.outline,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,

    // Shadow (iOS/Web)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,

    // Elevation (Android)
    elevation: 3,
  },

  padded: {
    padding: Spacing.md,
  },

  // "default" = نفس الخلفية لكن بدون حدود
  default: {
    backgroundColor: Colors.surface,
  },

  // "filled" = نفس default (ممكن تخليه نفس اللون أو أغمق شوي)
  filled: {
    backgroundColor: Colors.surface,
  },

  // "outline" = خلفية + حدود
  outline: {
    backgroundColor: Colors.background ?? Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowOpacity: 0.06,
    elevation: 1,
  },
});
