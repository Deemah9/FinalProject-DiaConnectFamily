import { useAppTheme } from "@/hooks/useAppTheme";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/services/api";
import { applyRtlIfNeeded } from "@/src/i18n/rtl";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CustomSwitch from "@/src/components/CustomSwitch";

interface DrawerContextValue {
  openDrawer: () => void;
  closeDrawer: (cb?: () => void) => void;
  openLang: () => void;
}

const DrawerContext = createContext<DrawerContextValue>({
  openDrawer: () => {},
  closeDrawer: () => {},
  openLang: () => {},
});

export const useDrawer = () => useContext(DrawerContext);

const DRAWER_W = 270;

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { logout, user: authUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const userRole = authUser?.role ?? null;

  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { isDark, toggleTheme } = useTheme();
  const isRTL = I18nManager.isRTL;
  const slideAnim = useRef(
    new Animated.Value(isRTL ? DRAWER_W : -DRAWER_W),
  ).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const closeDrawer = useCallback(
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: isRTL ? DRAWER_W : -DRAWER_W,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMenuOpen(false);
        cb?.();
      });
    },
    [slideAnim, backdropAnim, isRTL],
  );

  const openLang = useCallback(() => setLangOpen(true), []);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer, openLang }}>
      {children}

      {/* Language picker modal */}
      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLangOpen(false)}
      >
        <Pressable
          style={styles.langBackdrop}
          onPress={() => setLangOpen(false)}
        >
          <View style={styles.langDropdown}>
            {(
              [
                { code: "en", label: "English" },
                { code: "ar", label: "العربية" },
                { code: "he", label: "עברית" },
              ] as const
            ).map(({ code, label }, index, arr) => {
              const active = i18n.language === code;
              return (
                <Pressable
                  key={code}
                  style={[
                    styles.langOption,
                    index < arr.length - 1 && styles.langOptionBorder,
                    active && styles.langOptionActive,
                  ]}
                  onPress={async () => {
                    setLangOpen(false);
                    if (i18n.language === code) return;
                    await AsyncStorage.setItem("app_lang", code);
                    await i18n.changeLanguage(code);
                    await applyRtlIfNeeded(code);
                    updateProfile({ language: code }).catch(() => {});
                  }}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      active && styles.langOptionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={14} color="#1A6FA8" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Side drawer */}
      {menuOpen && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View
            style={[styles.overlayBackdrop, { opacity: backdropAnim }]}
            pointerEvents="box-none"
          >
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              isRTL ? { right: 0 } : { left: 0 },
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={styles.drawerSlot} />
              <View style={styles.drawerLogoRow}>
                <Ionicons name="heart-outline" size={22} color="#E8A317" />
                <View style={{ marginLeft: 7 }}>
                  <Text style={styles.drawerLogoText}>{t("appName1")}</Text>
                  <Text style={styles.drawerLogoSub}>{t("appName2")}</Text>
                </View>
              </View>
              <View style={[styles.drawerSlot, { alignItems: "flex-end" }]}>
                <Pressable
                  style={styles.drawerCloseBtn}
                  onPress={() => closeDrawer()}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.drawerScroll}
            >
              <Text style={styles.drawerSection}>{t("profileNavigation")}</Text>
              <Pressable
                style={styles.drawerItem}
                onPress={() =>
                  closeDrawer(() => router.push("/" as any))
                }
              >
                <Ionicons
                  name="home-outline"
                  size={17}
                  color={theme.primary}
                />
                <Text style={styles.drawerItemText}>{t("goHome")}</Text>
              </Pressable>
              <Pressable
                style={styles.drawerItem}
                onPress={() =>
                  closeDrawer(() => router.push("/profile" as any))
                }
              >
                <Ionicons
                  name="person-outline"
                  size={17}
                  color={theme.primary}
                />
                <Text style={styles.drawerItemText}>{t("openProfile")}</Text>
              </Pressable>

              {userRole !== "family_member" && (
                <>
                  <Text style={styles.drawerSection}>{t("glucoseNavigation")}</Text>
                  {[
                    {
                      icon: "stats-chart-outline",
                      label: t("glucoseHistory"),
                      route: "/glucose-history",
                    },
                    {
                      icon: "bar-chart-outline",
                      label: t("glucoseStats"),
                      route: "/glucose-stats",
                    },
                    {
                      icon: "analytics-outline",
                      label: t("estimatedA1C"),
                      route: "/a1c",
                    },
                    {
                      icon: "notifications-outline",
                      label: t("alerts"),
                      route: "/notifications",
                    },
                    {
                      icon: "alarm-outline",
                      label: t("customReminders", "Reminder Settings"),
                      route: "/reminder-settings",
                    },
                  ].map(({ icon, label, route }) => (
                    <Pressable
                      key={route}
                      style={styles.drawerItem}
                      onPress={() =>
                        closeDrawer(() => router.push(route as any))
                      }
                    >
                      <Ionicons
                        name={icon as any}
                        size={17}
                        color={theme.primary}
                      />
                      <Text style={styles.drawerItemText}>{label}</Text>
                    </Pressable>
                  ))}

                  <Text style={styles.drawerSection}>{t("dailyLogsSection")}</Text>
                  {[
                    {
                      icon: "calendar-outline",
                      label: t("dailyLog"),
                      route: "/daily-log",
                    },
                    {
                      icon: "medical-outline",
                      label: t("addFastInsulin"),
                      route: "/add-insulin",
                    },
                  ].map(({ icon, label, route }) => (
                    <Pressable
                      key={route}
                      style={styles.drawerItem}
                      onPress={() =>
                        closeDrawer(() => router.push(route as any))
                      }
                    >
                      <Ionicons
                        name={icon as any}
                        size={17}
                        color={theme.primary}
                      />
                      <Text style={styles.drawerItemText}>{label}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              {/* Emergency Contacts — visible to all roles */}
              <Text style={styles.drawerSection}>{t("emergencySection", "Emergency")}</Text>
              <Pressable
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => router.push("/emergency" as any))}
              >
                <Ionicons name="call-outline" size={17} color="#E53E3E" />
                <Text style={[styles.drawerItemText, { color: "#E53E3E" }]}>
                  {t("emergency.title", "Emergency Contact")}
                </Text>
              </Pressable>

              <Text style={styles.drawerSection}>{t("familySection")}</Text>
              {userRole === "patient" && (
                <Pressable
                  style={styles.drawerItem}
                  onPress={() =>
                    closeDrawer(() => router.push("/family-invite" as any))
                  }
                >
                  <Ionicons
                    name="person-add-outline"
                    size={17}
                    color={theme.primary}
                  />
                  <Text style={styles.drawerItemText}>{t("inviteFamily")}</Text>
                </Pressable>
              )}
              {userRole === "family_member" && (
                <>
                  <Pressable
                    style={styles.drawerItem}
                    onPress={() =>
                      closeDrawer(() => router.push("/notifications" as any))
                    }
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={17}
                      color={theme.primary}
                    />
                    <Text style={styles.drawerItemText}>{t("notif.title", "Notifications")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.drawerItem}
                    onPress={() =>
                      closeDrawer(() => router.push("/family-patients" as any))
                    }
                  >
                    <Ionicons
                      name="people-outline"
                      size={17}
                      color={theme.primary}
                    />
                    <Text style={styles.drawerItemText}>{t("myPatients")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.drawerItem}
                    onPress={() =>
                      closeDrawer(() => router.push("/family-join" as any))
                    }
                  >
                    <Ionicons
                      name="link-outline"
                      size={17}
                      color={theme.primary}
                    />
                    <Text style={styles.drawerItemText}>
                      {t("enterPairingCode")}
                    </Text>
                  </Pressable>
                </>
              )}

              <View style={styles.drawerDivider} />

              {/* Dark Mode Toggle */}
              <View style={styles.darkModeRow}>
                <View style={styles.darkModeLeft}>
                  <Ionicons
                    name={isDark ? "moon" : "sunny-outline"}
                    size={17}
                    color={isDark ? "#8DA4BC" : "#E8A317"}
                  />
                  <Text style={styles.darkModeText}>
                    {t("darkMode", "Dark Mode")}
                  </Text>
                </View>
                <CustomSwitch
                  value={isDark}
                  onValueChange={toggleTheme}
                  colorOn={theme.primary}
                  colorOff={theme.borderStrong}
                />
              </View>

              <View style={styles.drawerDivider} />

              <Pressable
                style={styles.drawerLogout}
                onPress={() => closeDrawer(() => logout())}
              >
                <Ionicons name="log-out-outline" size={17} color="#D32F2F" />
                <Text style={styles.drawerLogoutText}>{t("logout")}</Text>
              </Pressable>

              <View style={{ height: 32 }} />
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </DrawerContext.Provider>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 200,
    },
    overlayBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    drawer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: DRAWER_W,
      backgroundColor: theme.bgCard,
      boxShadow: "4px 0px 12px rgba(0,0,0,0.15)",
    },
    drawerHeader: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1A6FA8",
      paddingHorizontal: 16,
      paddingTop: 44,
      paddingBottom: 14,
    },
    drawerSlot: { width: 36 },
    drawerLogoRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    drawerLogoText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
      lineHeight: 18,
    },
    drawerLogoSub: {
      fontSize: 12,
      fontWeight: "300",
      color: "rgba(255,255,255,0.75)",
      lineHeight: 15,
    },
    drawerCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    drawerScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    drawerSection: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.textLight,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginTop: 16,
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    drawerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginBottom: 2,
    },
    drawerItemText: { fontSize: 14, fontWeight: "500", color: theme.text },
    drawerDivider: {
      height: 1,
      backgroundColor: theme.bgSoft,
      marginVertical: 12,
      marginHorizontal: 4,
    },
    darkModeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginBottom: 2,
    },
    darkModeLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    darkModeText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
    },

    drawerLogout: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    drawerLogoutText: { fontSize: 14, fontWeight: "500", color: "#D32F2F" },

    langBackdrop: {
      flex: 1,
      paddingTop: 75,
      paddingRight: 16,
      alignItems: "flex-end",
    },
    langDropdown: {
      backgroundColor: theme.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      boxShadow: "0px 3px 8px rgba(26,111,168,0.12)",
      minWidth: 130,
      overflow: "hidden",
    },
    langOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    langOptionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.bgSoft,
    },
    langOptionActive: { backgroundColor: theme.bg },
    langOptionText: { fontSize: 13, fontWeight: "500", color: theme.textSecondary },
    langOptionTextActive: { fontWeight: "700", color: "#1A6FA8" },
  });
}
