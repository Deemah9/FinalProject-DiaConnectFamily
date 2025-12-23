import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Colors } from "../constants/Colors";

type Props = {
  size?: "small" | "large";
  overlay?: boolean;
};

export default function LoadingSpinner({
  size = "large",
  overlay = false,
}: Props) {
  if (!overlay) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size={size} color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size={size} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
