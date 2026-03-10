import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { getProfile } from "@/services/api";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState("");



  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, []));

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      setErrorUser("");

      const data = await getProfile();
      setUser(data);
    } catch (error: any) {
      setErrorUser(error?.message || "Failed to load profile");
    } finally {
      setLoadingUser(false);
    }
  };

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || "User";

  const role = user?.role || "Patient";

  return (
    <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu-outline" size={24} color="#374151" />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="heart-outline" size={28} color="#D4AF37" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.logoTitle}>DiaConnect</Text>
              <Text style={styles.logoSub}>Family</Text>
            </View>
          </View>

          <View style={styles.iconPlaceholder} />
        </View>

        {/* Welcome */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loadingUser
              ? "Loading..."
              : `${t("welcomeBack", { defaultValue: "Welcome Back" })}, ${fullName}!`}
          </Text>
          <Text style={styles.welcomeSub}>
            {errorUser
              ? errorUser
              : t("homeSubtitle", {
                defaultValue: "Manage your diabetes care with ease",
              })}
          </Text>
        </View>

        {/* Role Badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{role}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

          <View style={styles.quickGrid}>
            <Pressable style={styles.quickCard}>
              <View
                style={[styles.quickIconCircle, { backgroundColor: "#EFF6FF" }]}
              >
                <Ionicons name="flash-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.quickTitle}>Quick Check</Text>
              <Text style={styles.quickSub}>Fast glucose reading</Text>
            </Pressable>

            <Pressable style={styles.quickCard}>
              <View
                style={[styles.quickIconCircle, { backgroundColor: "#ECFDF5" }]}
              >
                <Ionicons name="add-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.quickTitle}>New Entry</Text>
              <Text style={styles.quickSub}>Add measurement</Text>
            </Pressable>
          </View>
        </View>

        {/* Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALERTS</Text>

          <View style={styles.alertCard}>
            <View
              style={[styles.alertIconCircle, { backgroundColor: "#FFFBEB" }]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#F59E0B"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.alertMainTitle}>Medication Reminder</Text>
              <Text style={styles.alertMainSub}>
                Time for your evening dose
              </Text>
            </View>
          </View>
        </View>

        {/* Today's Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY&apos;S OVERVIEW</Text>

          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Blood Glucose</Text>
            <Text style={styles.overviewSub}>
              Track your readings and stay healthy
            </Text>

            <View style={styles.overviewGrid}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>Morning</Text>
                <Text style={styles.overviewItemValue}>--</Text>
              </View>

              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>Afternoon</Text>
                <Text style={styles.overviewItemValue}>--</Text>
              </View>

              <View style={styles.overviewItem}>
                <Text style={styles.overviewItemLabel}>Evening</Text>
                <Text style={styles.overviewItemValue}>--</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT ALERTS</Text>

          <View style={styles.recentList}>
            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#FACC15" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>Reminder</Text>
                <Text style={styles.recentSub}>Measure glucose after lunch</Text>
                <Text style={styles.recentTime}>2 hours ago</Text>
              </View>
            </View>

            <View style={styles.recentItem}>
              <View style={[styles.dot, { backgroundColor: "#60A5FA" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>Tip</Text>
                <Text style={styles.recentSub}>Drink water and stay active</Text>
                <Text style={styles.recentTime}>5 hours ago</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Top Menu Drawer */}

      <Modal visible={menuOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.drawer} onPress={() => { }}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menu</Text>
              <Pressable onPress={() => setMenuOpen(false)}>
                <Ionicons name="close-outline" size={22} color="#374151" />
              </Pressable>
            </View>

            <Text style={styles.drawerSection}>PROFILE NAVIGATION</Text>

            <Pressable
              style={styles.drawerItem}
              onPress={() => {
                setMenuOpen(false);
                router.push("/profile");
              }}
            >
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.drawerItemText}>Open Profile</Text>
            </Pressable>

            <Pressable
              style={styles.drawerItem}
              onPress={() => {
                setMenuOpen(false);
                router.push("/edit-profile" as any);
              }}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.drawerItemText}>Edit Profile</Text>
            </Pressable>

            <Pressable
              style={styles.drawerItem}
              onPress={() => {
                setMenuOpen(false);
                router.push("/medical-info" as any);
              }}
            >
              <Ionicons
                name="pulse-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.drawerItemText}>Medical Info</Text>
            </Pressable>
            <Pressable

              style={styles.drawerItem}

              onPress={() => {

                setMenuOpen(false);

                router.push("/lifestyle-habits" as any);

              }}

            >

              <Ionicons

                name="moon-outline"

                size={18}

                color={Colors.primary}

              />

              <Text style={styles.drawerItemText}>Lifestyle Habits</Text>

            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  iconPlaceholder: {
    width: 40,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoTitle: {
    color: "#1F2937",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "600",
  },

  logoSub: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "300",
  },

  hero: {
    marginTop: 28,
    marginBottom: 16,
  },

  welcomeTitle: {
    color: "#1F2937",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  welcomeSub: {
    color: "#6B7280",
    fontSize: 14,
  },

  roleBadge: {
    alignSelf: "flex-start",
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },

  roleBadgeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },

  section: {
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    letterSpacing: 1,
  },

  quickGrid: {
    flexDirection: "row",
    gap: 14,
  },

  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    alignItems: "center",
  },

  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  quickTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },

  quickSub: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  alertMainTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  alertMainSub: {
    color: "#6B7280",
    fontSize: 12,
  },

  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  overviewTitle: {
    color: "#1F2937",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },

  overviewSub: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
  },

  overviewGrid: {
    flexDirection: "row",
    gap: 10,
  },

  overviewItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },

  overviewItemLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },

  overviewItemValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },

  recentList: {
    gap: 12,
  },

  recentItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },

  recentTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  recentSub: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 4,
  },

  recentTime: {
    color: "#9CA3AF",
    fontSize: 11,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },

  drawer: {
    marginTop: 78,
    marginLeft: 16,
    width: 240,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  drawerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  drawerSection: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
    letterSpacing: 1,
  },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },

  drawerItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
});