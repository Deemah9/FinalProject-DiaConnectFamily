import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "@/src/components/AppHeader";
import { getLinkedPatients, getProfile, getUnreadCount, registerPushToken } from "@/services/api";
import * as Notifications from "expo-notifications";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function FamilyHomeScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      getUnreadCount().then((d: any) => setUnreadCount(d?.unread_count ?? 0)).catch(() => {});
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
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const registerForPushNotifications = async () => {
    if (Platform.OS === "web") return;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "7f5f1128-2316-49d4-9446-aa05edb735d8",
      });
      await registerPushToken(tokenData.data);
    } catch {
      // silent
    }
  };

  const fullName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || t("user");

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? t("goodMorning") : t("goodEvening");
  };

  return (
    <LinearGradient colors={[theme.bgCard, theme.bg]} style={styles.container}>
      <AppHeader left={null} unreadCount={unreadCount} />

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.hero}>
          <Text style={styles.welcomeTitle}>
            {loading ? t("loading") : `${getGreeting()} ${fullName}`}
          </Text>
          <Text style={styles.welcomeSub}>{t("familyWelcomeSubtitle")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("myPatients")}</Text>

          {patients.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color={theme.border} />
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
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("quickActions")}</Text>
          <View style={styles.quickRow}>
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
    </LinearGradient>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

    hero: { marginTop: 12, marginBottom: 16 },
    welcomeTitle: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 6 },
    welcomeSub: { fontSize: 14, color: theme.textMuted },

    section: { marginBottom: 24 },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },

    emptyCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 28,
      alignItems: "center",
      gap: 8,
    },
    emptyText: { fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 8 },
    emptySub: { fontSize: 13, color: theme.textMuted, textAlign: "center" },
    linkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      marginTop: 8,
    },
    linkBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

    patientCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.bgSoft,
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
      backgroundColor: theme.primary,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
    patientName: { fontSize: 16, fontWeight: "600", color: theme.text },
    patientSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },

    quickRow: { flexDirection: "row", gap: 12 },
    quickCard: {
      flex: 1,
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.bgSoft,
      padding: 16,
      alignItems: "center",
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    quickIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    quickLabel: { fontSize: 12, fontWeight: "600", color: theme.text, textAlign: "center" },
  });
}
