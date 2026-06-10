import { useAppTheme } from "@/hooks/useAppTheme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { NativeViewGestureHandler } from "react-native-gesture-handler";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const ITEM_H = 40;
const VISIBLE = 3;
const PICKER_H = ITEM_H * VISIBLE; // 120

const HOURS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

interface ColumnProps {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  width: number;
  styles: ReturnType<typeof createStyles>;
  bg: string;
}

function ScrollColumn({ items, selected, onSelect, width, styles, bg }: ColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const idx = Math.max(0, items.indexOf(selected));
  const offsetRef = useRef(idx * ITEM_H);
  const lastEmitted = useRef(selected);
  const [localSelected, setLocalSelected] = useState(selected);

  useEffect(() => {
    const y = idx * ITEM_H;
    offsetRef.current = y;
    const t = setTimeout(
      () => scrollRef.current?.scrollTo({ y, animated: false }),
      60,
    );
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(
    (e: any) => {
      offsetRef.current = e.nativeEvent.contentOffset.y;
      const i = Math.round(offsetRef.current / ITEM_H);
      const val = items[Math.max(0, Math.min(i, items.length - 1))];
      if (val !== lastEmitted.current) {
        lastEmitted.current = val;
        setLocalSelected(val);
        onSelect(val);
      }
    },
    [items, onSelect],
  );

  const commit = useCallback(() => {
    const i = Math.round(offsetRef.current / ITEM_H);
    const clamped = Math.max(0, Math.min(i, items.length - 1));
    const val = items[clamped];
    if (val !== lastEmitted.current) {
      lastEmitted.current = val;
      setLocalSelected(val);
      onSelect(val);
    }
  }, [items, onSelect]);

  return (
    <View style={{ width, height: PICKER_H, overflow: "hidden" }}>
      <View style={styles.selectionBand} pointerEvents="none" />

      <NativeViewGestureHandler disallowInterruption>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: ITEM_H }}
          onScroll={onScroll}
          onMomentumScrollEnd={commit}
          onScrollEndDrag={commit}
        >
          {items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Text
                style={[styles.itemText, item === localSelected && styles.itemTextActive]}
              >
                {item}
              </Text>
            </View>
          ))}
        </ScrollView>
      </NativeViewGestureHandler>

      <LinearGradient
        colors={[bg, "transparent"]}
        style={styles.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", bg]}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
    </View>
  );
}

interface ScrollTimePickerProps {
  label: string;
  hours: string;
  minutes: string;
  isPM: boolean;
  onHoursChange: (v: string) => void;
  onMinutesChange: (v: string) => void;
  onTogglePeriod: (isPM: boolean) => void;
}

export default function ScrollTimePicker({
  label,
  hours,
  minutes,
  isPM,
  onHoursChange,
  onMinutesChange,
  onTogglePeriod,
}: ScrollTimePickerProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const periods = [t("am"), t("pm")];
  const selectedPeriod = isPM ? t("pm") : t("am");

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerContainer}>
        <ScrollColumn
          items={HOURS}
          selected={hours.padStart(2, "0")}
          onSelect={onHoursChange}
          width={60}
          styles={styles}
          bg={theme.bgCard}
        />
        <Text style={styles.colon}>:</Text>
        <ScrollColumn
          items={MINUTES}
          selected={minutes.padStart(2, "0")}
          onSelect={onMinutesChange}
          width={60}
          styles={styles}
          bg={theme.bgCard}
        />
        <View style={styles.columnDivider} />
        <ScrollColumn
          items={periods}
          selected={selectedPeriod}
          onSelect={(v) => onTogglePeriod(v === t("pm"))}
          width={46}
          styles={styles}
          bg={theme.bgCard}
        />
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 10,
    },
    pickerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      direction: "ltr",
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      shadowColor: "#1A6FA8",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as any,
    selectionBand: {
      position: "absolute",
      top: ITEM_H,
      left: 3,
      right: 3,
      height: ITEM_H,
      backgroundColor: theme.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fadeTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: ITEM_H,
    },
    fadeBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: ITEM_H,
    },
    item: {
      height: ITEM_H,
      alignItems: "center",
      justifyContent: "center",
    },
    itemText: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.inactive,
    },
    itemTextActive: {
      fontSize: 20,
      fontWeight: "700",
      color: "#1A6FA8",
    },
    colon: {
      fontSize: 20,
      fontWeight: "700",
      color: "#1A6FA8",
      marginHorizontal: 2,
      marginBottom: 1,
    },
    columnDivider: {
      width: 1,
      height: PICKER_H * 0.5,
      backgroundColor: theme.bgSoft,
      marginHorizontal: 6,
    },
  });
}
