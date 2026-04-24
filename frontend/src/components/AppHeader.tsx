import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const HEADER_BG = "#1A6FA8";
const SLOT_W = 80;

interface AppHeaderProps {
  left?: React.ReactNode | null;
  right?: React.ReactNode | null;
  bottom?: React.ReactNode;
}

/**
 * Consistent blue top bar used on every screen.
 *
 * Layout:  [left slot 80px]  [logo — centered flex:1]  [right slot 80px]
 *
 * Both slots are always the same fixed width so the logo stays
 * perfectly centered regardless of what icons appear on either side.
 */
export default function AppHeader({ left, right, bottom }: AppHeaderProps) {
  const { top } = useSafeAreaInsets();

  const leftNode =
    left === null
      ? <View style={styles.slot} />
      : left ?? (
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
        );

  const rightNode =
    right === null
      ? <View style={styles.slot} />
      : right ?? <View style={styles.slot} />;

  return (
    <View style={[styles.bar, { paddingTop: top + 8 }]}>
      <View style={styles.topRow}>
        <View style={styles.slot}>{leftNode}</View>
        <View style={styles.logo}>
          <Ionicons name="heart-outline" size={26} color="#E8A317" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.title}>DiaConnect</Text>
            <Text style={styles.sub}>Family</Text>
          </View>
        </View>
        <View style={[styles.slot, { alignItems: "flex-end" }]}>{rightNode}</View>
      </View>
      {bottom}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: HEADER_BG,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  slot: {
    width: SLOT_W,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  sub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "300",
    lineHeight: 15,
  },
});
