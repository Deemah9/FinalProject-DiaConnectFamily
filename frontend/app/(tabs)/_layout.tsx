import { HapticTab } from "@/components/haptic-tab";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { getEmergencyContacts, saveEmergencyContacts } from "@/services/api";
import * as Linking from "expo-linking";
import { Redirect, Tabs } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

const AVATAR_COLORS = ["#E53E3E", "#1A6FA8", "#059669", "#D97706", "#7C3AED"];

function isValidIsraeliPhone(raw: string): boolean {
  const phone = raw.replace(/[\s\-]/g, "");
  if (/^10[0-4]$/.test(phone)) return true;
  if (/^05[0-9]\d{7}$/.test(phone)) return true;
  if (/^0[2-9]\d{7,8}$/.test(phone)) return true;
  return false;
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [sosOpen, setSosOpen] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const openSOS = useCallback(async () => {
    try {
      const res = await getEmergencyContacts();
      setContacts(res?.contacts ?? []);
    } catch {
      setContacts([]);
    }
    setShowAddForm(false);
    setSosOpen(true);
  }, []);

  const callContact = (contact: EmergencyContact) => {
    setSosOpen(false);
    Linking.openURL(`tel:${contact.phone}`).catch(() =>
      Alert.alert(t("emergency.callFailed", "Could not open phone app"))
    );
  };

  const handleAddContact = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      Alert.alert(t("emergency.missingFields", "Please fill in all fields"));
      return;
    }
    if (!isValidIsraeliPhone(phoneInput.trim())) {
      Alert.alert(
        t("emergency.invalidPhone", "Invalid phone number"),
        t("emergency.phoneHint", "Enter an Israeli mobile (05X-XXXXXXX), landline, or emergency number (100–104)")
      );
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: nameInput.trim(),
      phone: phoneInput.trim(),
    };
    const updated = [...contacts, newContact];
    setContacts(updated);
    await saveEmergencyContacts(updated);
    setNameInput("");
    setPhoneInput("");
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/welcome" />;
  }

  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.inactive,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: theme.tabBorder,
            backgroundColor: theme.tabBar,
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("aria.tabHome"),
            tabBarAccessibilityLabel: t("aria.tabHome"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="emergency"
          options={{
            title: "SOS",
            tabBarButton: () => (
              <Pressable style={tabStyles.sosWrapper} onPress={openSOS}>
                <View style={tabStyles.sosButton}>
                  <Ionicons name="call" size={26} color="#fff" />
                </View>
                <Text style={tabStyles.sosLabel}>SOS</Text>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("aria.tabProfile"),
            tabBarAccessibilityLabel: t("aria.tabProfile"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden tabs — authenticated screens with tab bar */}
        <Tabs.Screen name="stats"                   options={{ href: null }} />
        <Tabs.Screen name="explore"                 options={{ href: null }} />
        <Tabs.Screen name="reminder-settings"       options={{ href: null }} />
        <Tabs.Screen name="a1c"                     options={{ href: null }} />
        <Tabs.Screen name="add-activity"            options={{ href: null }} />
        <Tabs.Screen name="add-glucose"             options={{ href: null }} />
        <Tabs.Screen name="add-insulin"             options={{ href: null }} />
        <Tabs.Screen name="add-meal"                options={{ href: null }} />
        <Tabs.Screen name="add-sleep"               options={{ href: null }} />
        <Tabs.Screen name="change-password"         options={{ href: null }} />
        <Tabs.Screen name="daily-log"               options={{ href: null }} />
        <Tabs.Screen name="edit-profile"            options={{ href: null }} />
        <Tabs.Screen name="family-access"           options={{ href: null }} />
        <Tabs.Screen name="family-home"             options={{ href: null }} />
        <Tabs.Screen name="family-invite"           options={{ href: null }} />
        <Tabs.Screen name="family-join"             options={{ href: null }} />
        <Tabs.Screen name="family-patient-glucose"  options={{ href: null }} />
        <Tabs.Screen name="family-patients"         options={{ href: null }} />
        <Tabs.Screen name="family-profile"          options={{ href: null }} />
        <Tabs.Screen name="glucose-history"         options={{ href: null }} />
        <Tabs.Screen name="glucose-stats"           options={{ href: null }} />
        <Tabs.Screen name="lifestyle-habits"        options={{ href: null }} />
        <Tabs.Screen name="notifications"           options={{ href: null }} />
      </Tabs>

      {/* ── SOS Quick-Call Modal ── */}
      <Modal
        visible={sosOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSosOpen(false)}
      >
        <Pressable style={tabStyles.backdrop} onPress={() => setSosOpen(false)}>
          <Pressable style={[tabStyles.sheet, { backgroundColor: theme.bgCard }]} onPress={(e) => e.stopPropagation()}>

            {/* Header */}
            <View style={tabStyles.sheetHeader}>
              <View style={tabStyles.sheetIconCircle}>
                <Ionicons name="call" size={20} color="#E53E3E" />
              </View>
              <Text style={[tabStyles.sheetTitle, { color: theme.text }]}>
                {t("emergency.title", "Emergency Contact")}
              </Text>
              <Pressable onPress={() => setSosOpen(false)} style={tabStyles.sheetClose}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            <View style={[tabStyles.divider, { backgroundColor: theme.bgSoft }]} />

            {/* Contacts list */}
            {!showAddForm ? (
              <>
                {contacts.length === 0 ? (
                  <View style={tabStyles.emptyWrap}>
                    <Ionicons name="person-add-outline" size={36} color={theme.inactive} />
                    <Text style={[tabStyles.emptyText, { color: theme.textMuted }]}>
                      {t("emergency.noContact", "No emergency contact set")}
                    </Text>
                  </View>
                ) : (
                  contacts.map((c, i) => (
                    <Pressable
                      key={c.id}
                      style={({ pressed }) => [
                        tabStyles.contactRow,
                        { backgroundColor: pressed ? theme.bg : "transparent" },
                      ]}
                      onPress={() => callContact(c)}
                    >
                      <View style={[tabStyles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                        <Text style={tabStyles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={tabStyles.contactInfo}>
                        <Text style={[tabStyles.contactName, { color: theme.text }]}>{c.name}</Text>
                        <Text style={[tabStyles.contactPhone, { color: theme.textMuted }]}>{c.phone}</Text>
                      </View>
                      <View style={tabStyles.callChip}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </View>
                    </Pressable>
                  ))
                )}
                {contacts.length < 5 && (
                  <Pressable style={tabStyles.addMoreRow} onPress={() => setShowAddForm(true)}>
                    <Ionicons name="add-circle-outline" size={18} color="#E53E3E" />
                    <Text style={tabStyles.addMoreRowText}>{t("emergency.addContact", "Add Emergency Contact")}</Text>
                  </Pressable>
                )}
              </>
            ) : (
              /* Inline add form */
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={tabStyles.inlineForm}>
                  <Text style={[tabStyles.inlineFormTitle, { color: theme.text }]}>
                    {t("emergency.addContact", "Add Emergency Contact")}
                  </Text>
                  <TextInput
                    style={[tabStyles.inlineInput, { backgroundColor: theme.bgInput, borderColor: theme.borderLight, color: theme.text }]}
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder={t("emergency.namePlaceholder", "e.g. Mom, Dad, Doctor")}
                    placeholderTextColor={theme.placeholder}
                  />
                  <TextInput
                    style={[tabStyles.inlineInput, { backgroundColor: theme.bgInput, borderColor: theme.borderLight, color: theme.text }]}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    placeholder="e.g. 0501234567 / 101"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  <View style={tabStyles.inlineFormBtns}>
                    <Pressable style={tabStyles.inlineCancelBtn} onPress={() => { setShowAddForm(false); setNameInput(""); setPhoneInput(""); }}>
                      <Text style={[tabStyles.inlineCancelText, { color: theme.textLight }]}>{t("cancel", "Cancel")}</Text>
                    </Pressable>
                    <Pressable style={tabStyles.inlineSaveBtn} onPress={handleAddContact}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={tabStyles.inlineSaveText}>{t("emergency.save", "Save")}</Text>
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            <View style={{ height: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const tabStyles = StyleSheet.create({
  sosWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  sosButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E53E3E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    boxShadow: "0px 4px 10px rgba(229,62,62,0.45)",
  },
  sosLabel: {
    color: "#E53E3E",
    fontSize: 11,
    fontWeight: "800",
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    paddingTop: 8,
    boxShadow: "0px 0px 20px rgba(0,0,0,0.15)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  sheetIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FDEDED",
    alignItems: "center", justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, marginHorizontal: 8 },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderRadius: 12,
    marginHorizontal: 8,
    marginTop: 4,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "700" },
  contactPhone: { fontSize: 12, marginTop: 2 },
  callChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#E53E3E",
    alignItems: "center", justifyContent: "center",
  },
  addContactBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#E53E3E",
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, marginTop: 12,
  },
  addContactText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  addMoreRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginTop: 4,
    borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)",
  },
  addMoreRowText: { color: "#E53E3E", fontWeight: "600", fontSize: 13 },
  inlineForm: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 12 },
  inlineFormTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2, textAlign: "right" },
  inlineInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14,
  },
  inlineFormBtns: { flexDirection: "row", gap: 10, marginTop: 6 },
  inlineCancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
  },
  inlineCancelText: { fontWeight: "600", fontSize: 13 },
  inlineSaveBtn: {
    flex: 1, flexDirection: "row", gap: 5,
    paddingVertical: 11, borderRadius: 10,
    backgroundColor: "#E53E3E",
    alignItems: "center", justifyContent: "center",
  },
  inlineSaveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
