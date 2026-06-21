import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

const TRACK_W    = 48;
const TRACK_H    = 26;
const THUMB_SIZE = 20;
const MARGIN     = 3;
const TRAVEL     = TRACK_W - THUMB_SIZE - MARGIN * 2;

interface Props {
  value: boolean;
  onValueChange: (v: boolean) => void;
  colorOn?:  string;
  colorOff?: string;
  accessibilityLabel?: string;
}

export default function CustomSwitch({
  value,
  onValueChange,
  colorOn  = "#1A6FA8",
  colorOff = "#CBD5E1",
  accessibilityLabel,
}: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const bg = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [colorOff, colorOn],
  });

  // translateX is always LTR-physical, unaffected by RTL text direction
  const thumbX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [MARGIN, MARGIN + TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{ outlineWidth: 0 } as any}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    // Required on web: parent must be relative so absolute child works
    position: "relative",
    overflow: "hidden",
    // Prevent RTL from flipping translateX direction
    writingDirection: "ltr",
  },
  thumb: {
    position: "absolute",
    top: MARGIN,
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.2)",
  },
});
