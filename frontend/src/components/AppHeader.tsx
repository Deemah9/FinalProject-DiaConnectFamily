import { useDrawer } from "@/context/DrawerContext";
import { useFontSize, MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } from "@/context/FontSizeContext";
import { useHighContrast } from "@/context/HighContrastContext";
import { useHaptic } from "@/context/HapticContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CustomSwitch from "./CustomSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const HEADER_BG = "#1A6FA8";
const SLOT_W = 164;

interface AppHeaderProps {
  left?: React.ReactNode | null;
  right?: React.ReactNode | null;
  bottom?: React.ReactNode;
  unreadCount?: number;
}

export default function AppHeader({ left, right, bottom, unreadCount = 0 }: AppHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { openDrawer, openLang } = useDrawer();
  const { isDark, toggleTheme } = useTheme();
  const { isHighContrast, toggleHighContrast } = useHighContrast();
  const { hapticEnabled, setHapticEnabled } = useHaptic();
  const { fontScale, setFontScale } = useFontSize();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const [accessOpen, setAccessOpen] = useState(false);
  const [sliderVal, setSliderVal] = useState(fontScale);

  const defaultRight = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        style={styles.iconBtn}
        onPress={() => { setSliderVal(fontScale); setAccessOpen(true); }}
      >
        <Ionicons name="accessibility" size={20} color="#FFFFFF" />
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={openLang}>
        <Ionicons name="earth-outline" size={20} color="#FFFFFF" />
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications" as any)}>
        <View>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </View>
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={openDrawer}>
        <Ionicons name="menu-outline" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  const leftNode =
    left === null
      ? <View style={styles.slot} />
      : left ?? (
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#FFFFFF" />
          </Pressable>
        );

  const rightNode =
    right === null
      ? <View style={styles.slot} />
      : right ?? defaultRight;

  return (
    <View style={[styles.bar, { paddingTop: top + 8 }]}>
      <View style={styles.topRow}>
        <View style={styles.slot}>{leftNode}</View>
        <Pressable style={styles.logo} onPress={() => router.push("/" as any)}>
          <Ionicons name="heart-outline" size={26} color="#E8A317" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.title}>DiaConnect</Text>
            <Text style={styles.sub}>Family</Text>
          </View>
        </Pressable>
        <View style={[styles.slot, { alignItems: "flex-end" }]}>{rightNode}</View>
      </View>
      {bottom}

      {/* ── Accessibility Panel ── */}
      <Modal
        visible={accessOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAccessOpen(false)}
      >
        <Pressable style={styles.panelBackdrop} onPress={() => setAccessOpen(false)}>
          <View
            style={[
              styles.panel,
              { marginTop: top + 60 },
              isRTL ? { marginLeft: 16 } : { marginRight: 16 },
            ]}
          >
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <Ionicons name="accessibility" size={16} color={HEADER_BG} />
              <Text style={styles.panelTitle}>
                {t("accessibility", "Accessibility")}
              </Text>
            </View>

            <View style={styles.panelDivider} />

            {/* Dark Mode row */}
            <View style={styles.panelRow}>
              <View style={styles.panelRowLeft}>
                <Ionicons
                  name={isDark ? "moon" : "sunny-outline"}
                  size={18}
                  color={isDark ? "#8DA4BC" : "#E8A317"}
                />
                <Text style={styles.panelRowLabel}>
                  {t("darkMode", "Dark Mode")}
                </Text>
              </View>
              <CustomSwitch
                value={isDark}
                onValueChange={toggleTheme}
                colorOn={HEADER_BG}
              />
            </View>

            <View style={styles.panelDivider} />

            {/* High Contrast row */}
            <View style={styles.panelRow}>
              <View style={styles.panelRowLeft}>
                <Ionicons
                  name="contrast-outline"
                  size={18}
                  color={isHighContrast ? "#000000" : HEADER_BG}
                />
                <Text style={styles.panelRowLabel}>
                  {t("highContrast", "High Contrast")}
                </Text>
              </View>
              <CustomSwitch
                value={isHighContrast}
                onValueChange={toggleHighContrast}
                colorOn="#000000"
              />
            </View>

            <View style={styles.panelDivider} />

            {/* Haptic Alerts row */}
            <View style={styles.panelRow}>
              <View style={styles.panelRowLeft}>
                <Ionicons
                  name={hapticEnabled ? "phone-portrait" : "phone-portrait-outline"}
                  size={18}
                  color={HEADER_BG}
                />
                <Text style={styles.panelRowLabel}>
                  {t("hapticAlerts", "Vibration on Alerts")}
                </Text>
              </View>
              <CustomSwitch
                value={hapticEnabled}
                onValueChange={setHapticEnabled}
                colorOn={HEADER_BG}
              />
            </View>

            <View style={styles.panelDivider} />

            {/* Reminder Settings row */}
            <Pressable
              style={styles.panelRow}
              onPress={() => { setAccessOpen(false); router.push("/reminder-settings" as any); }}
            >
              <View style={styles.panelRowLeft}>
                <Ionicons name="alarm-outline" size={18} color={HEADER_BG} />
                <Text style={styles.panelRowLabel}>
                  {t("customReminders", "Reminder Settings")}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color="#94A3B8"
              />
            </Pressable>

            <View style={styles.panelDivider} />

            {/* Font Size Slider */}
            <View style={styles.fontSection}>
              <View style={styles.fontSectionHeader}>
                <Ionicons name="text-outline" size={16} color={HEADER_BG} />
                <Text style={styles.panelTitle}>
                  {t("fontSize", "Font Size")}
                </Text>
              </View>

              {/* Live preview */}
              <View style={styles.previewBox}>
                <Text style={[styles.previewText, { fontSize: Math.round(15 * sliderVal) }]}>
                  {t("fontPreviewText", "مرحباً بك في DiaConnect")}
                </Text>
              </View>

              {/* Slider row */}
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabelSmall}>{t("fontLetter", "A")}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={MIN_SCALE}
                  maximumValue={MAX_SCALE}
                  value={sliderVal}
                  step={0.05}
                  minimumTrackTintColor={HEADER_BG}
                  maximumTrackTintColor="#CBD5E1"
                  thumbTintColor={HEADER_BG}
                  onValueChange={(v) => setSliderVal(v)}
                  onSlidingComplete={(v) => setFontScale(v)}
                />
                <Text style={styles.sliderLabelLarge}>{t("fontLetter", "A")}</Text>
              </View>

              {/* Reset button — only shows if not at default */}
              {Math.abs(sliderVal - DEFAULT_SCALE) > 0.04 && (
                <Pressable
                  style={styles.resetBtn}
                  onPress={() => { setSliderVal(DEFAULT_SCALE); setFontScale(DEFAULT_SCALE); }}
                >
                  <Ionicons name="refresh-outline" size={13} color={HEADER_BG} />
                  <Text style={styles.resetText}>
                    {t("resetDefault", "Reset")}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: HEADER_BG },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  slot: { width: SLOT_W, flexDirection: "row", alignItems: "center" },
  logo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    direction: "ltr",
  } as any,
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: I18nManager.isRTL ? undefined : -6,
    left:  I18nManager.isRTL ? -6 : undefined,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#E53E3E",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: HEADER_BG,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" as const, lineHeight: 12 },
  title:  { color: "#FFFFFF", fontSize: 16, fontWeight: "700", lineHeight: 18 },
  sub:    { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "300", lineHeight: 15 },

  // Panel
  panelBackdrop: {
    flex: 1,
    alignItems: I18nManager.isRTL ? "flex-start" : "flex-end",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 240,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  panelTitle: {
    fontSize: 12, fontWeight: "700", color: HEADER_BG,
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  panelDivider: {
    height: 1, backgroundColor: "#E2E8F0",
    marginHorizontal: 8, marginVertical: 2,
  },
  panelRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginHorizontal: 4,
  },
  panelRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  panelRowLabel: { fontSize: 14, fontWeight: "500", color: "#0B1A2E" },

  // Font size section
  fontSection: { paddingHorizontal: 10, paddingBottom: 10 },
  fontSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 4, paddingTop: 10, paddingBottom: 8,
  },
  previewBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  previewText: {
    color: "#0B1A2E",
    fontWeight: "500",
    textAlign: "center",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sliderLabelSmall: { fontSize: 12, fontWeight: "700", color: "#94A3B8", width: 18 },
  sliderLabelLarge: { fontSize: 22, fontWeight: "700", color: "#94A3B8", width: 22 },
  slider: { flex: 1, height: 36 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "center", marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "#CBD5E1",
  },
  resetText: { fontSize: 12, color: HEADER_BG, fontWeight: "600" },
});
