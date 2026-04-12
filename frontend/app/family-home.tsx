import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/src/components/AppHeader";
import { applyRtlIfNeeded } from "@/src/i18n/rtl";
import { getLinkedPatients, getProfile, registerPushToken, updateProfile } from "@/services/api";
import * as Notifications from "expo-notifications";
import i18n from "@/src/i18n";

export default function FamilyHomeScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  const DRAWER_W = 270;
  const isRTL = I18nManager.isRTL;
  const slideAnim = useRef(new Animated.Value(isRTL ? DRAWER_W : -DRAWER_W)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const openDrawer = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: isRTL ? DRAWER_W : -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => { setMenuOpen(false); cb?.(); });
  };

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      setLoading(true);
      const [profileData, patientsData] = await Promise.all([
        getProfile(),
        getLinkedPatients(),
      ]);
      setUser(profileData);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const registerForPushNotifications = async () => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(tokenData.data);
    } catch {
      // silent — push notifications are non-critical
    }
  };

  const fullName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || t("user");

  return (
    <LinearGradient colors={["#FFFFFF", "#EBF3FA"]} style={styles.container}>
      <AppHeader
        left={null}
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable style={styles.topBarBtn} onPress={() => setLangOpen((v) => !v)}>
              <Ionicons name="earth-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.topBarBtn} onPress={openDrawer}>
              <Ionicons name="menu-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Welcome */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loading ? t("loading") : t("familyWelcome", { name: fullName })}
          </Text>
          <Text style={styles.welcomeSub}>{t("familyWelcomeSubtitle")}</Text>
        </View>

        {/* Patients */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("myPatients")}</Text>

          {patients.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color="#B8D0E8" />
              <Text style={styles.emptyText}>{t("noPatients")}</Text>
              <Text style={styles.emptySub}>{t("noPatientsSubtext")}</Text>
              <Pressable
                style={styles.linkBtn}
                onPress={() => router.push("/family-join" as any)}
              >
                <Ionicons name="link-outline" size={16} color="#fff" />
                <Text style={styles.linkBtnText}>{t("enterPairingCode")}</Text>
              </Pressable>
            </View>
          ) : (
            patients.map((p) => (
              <Pressable
                key={p.patient_id}
                style={styles.patientCard}
                onPress={() => router.push({
                  pathname: "/family-patient-glucose" as any,
                  params: { patientId: p.patient_id, patientName: p.patient_name },
                })}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {p.patient_name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{p.patient_name}</Text>
                  <Text style={styles.patientSub}>{t("viewGlucose")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("quickActions")}</Text>
          <View style={styles.quickRow}>
            <Pressable style={styles.quickCard} onPress={() => router.push("/family-patients" as any)}>
              <View style={[styles.quickIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="people-outline" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.quickLabel}>{t("myPatients")}</Text>
            </Pressable>
            <Pressable style={styles.quickCard} onPress={() => router.push("/family-join" as any)}>
              <View style={[styles.quickIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="link-outline" size={22} color="#10B981" />
              </View>
              <Text style={styles.quickLabel}>{t("enterPairingCode")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={langOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.langModalBackdrop} onPress={() => setLangOpen(false)}>
          <View style={styles.langDropdown}>
            {[
              { code: "en", label: "English" },
              { code: "ar", label: "العربية" },
              { code: "he", label: "עברית" },
            ].map(({ code, label }, index, arr) => {
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
                    const lng = code as "en" | "ar" | "he";
                    if (i18n.language === lng) return;
                    await AsyncStorage.setItem("app_lang", lng);
                    await i18n.changeLanguage(lng);
                    await applyRtlIfNeeded(lng);
                    updateProfile({ language: lng }).catch(() => {});
                  }}
                >
                  <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>{label}</Text>
                  {active && <Ionicons name="checkmark" size={14} color="#1A6FA8" />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Side Drawer */}
      {menuOpen && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View style={[styles.overlayBackdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </Animated.View>
          <Animated.View style={[styles.drawer, isRTL ? { right: 0 } : { left: 0 }, { transform: [{ translateX: slideAnim }] }]}>
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
                <Pressable style={styles.drawerCloseBtn} onPress={() => closeDrawer()}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.drawerScroll}>
              <Text style={styles.drawerSection}>{t("profileNavigation")}</Text>
              <Pressable style={styles.drawerItem} onPress={() => closeDrawer(() => router.push("/profile" as any))}>
                <Ionicons name="person-outline" size={17} color={Colors.primary} />
                <Text style={styles.drawerItemText}>{t("openProfile")}</Text>
              </Pressable>

              <Text style={styles.drawerSection}>{t("familySection")}</Text>
              <Pressable style={styles.drawerItem} onPress={() => closeDrawer(() => router.push("/family-patients" as any))}>
                <Ionicons name="people-outline" size={17} color={Colors.primary} />
                <Text style={styles.drawerItemText}>{t("myPatients")}</Text>
              </Pressable>
              <Pressable style={styles.drawerItem} onPress={() => closeDrawer(() => router.push("/family-join" as any))}>
                <Ionicons name="link-outline" size={17} color={Colors.primary} />
                <Text style={styles.drawerItemText}>{t("enterPairingCode")}</Text>
              </Pressable>

              <View style={styles.drawerDivider} />
              <Pressable style={styles.drawerLogout} onPress={() => closeDrawer(() => logout())}>
                <Ionicons name="log-out-outline" size={17} color="#D32F2F" />
                <Text style={styles.drawerLogoutText}>{t("logout")}</Text>
              </Pressable>
              <View style={{ height: 32 }} />
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  topBarBtn: { padding: 8 },

  hero: { marginTop: 28, marginBottom: 20 },
  welcomeTitle: { fontSize: 28, fontWeight: "700", color: "#0B1A2E", marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: "#4A6480" },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#4A6480", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#0B1A2E", marginTop: 8 },
  emptySub: { fontSize: 13, color: "#4A6480", textAlign: "center" },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  linkBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  patientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  patientName: { fontSize: 16, fontWeight: "600", color: "#0B1A2E" },
  patientSub: { fontSize: 12, color: "#4A6480", marginTop: 2 },

  quickRow: { flexDirection: "row", gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E8F5",
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#0B1A2E", textAlign: "center" },

  // Language modal
  langModalBackdrop: { flex: 1 },
  langDropdown: {
    position: "absolute", top: 60, right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14, borderWidth: 1, borderColor: "#D6E8F5",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
    minWidth: 150, overflow: "hidden",
  },
  langOption: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: "#EBF3FA" },
  langOptionActive: { backgroundColor: "#EBF3FA" },
  langOptionText: { fontSize: 14, color: "#0B1A2E" },
  langOptionTextActive: { fontWeight: "700", color: "#1A6FA8" },

  // Drawer
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  drawer: { position: "absolute", top: 0, bottom: 0, width: 270, backgroundColor: "#FFFFFF", zIndex: 101 },
  drawerHeader: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drawerSlot: { width: 36 },
  drawerLogoRow: { flexDirection: "row", alignItems: "center" },
  drawerLogoText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  drawerLogoSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  drawerCloseBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  drawerScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  drawerSection: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginTop: 16, marginBottom: 6 },
  drawerItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderRadius: 10 },
  drawerItemText: { fontSize: 14, color: "#0B1A2E", fontWeight: "500" },
  drawerDivider: { height: 1, backgroundColor: "#EBF3FA", marginVertical: 12 },
  drawerLogout: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  drawerLogoutText: { fontSize: 14, color: "#D32F2F", fontWeight: "600" },
});
