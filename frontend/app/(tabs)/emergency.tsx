import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface EmergencyContact {
  name: string;
  phone: string;
}

export default function EmergencyScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const isFamily = user?.role === "family_member";
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const storageKey = `emergency_contact_${(user as any)?.email ?? "default"}`;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val) {
        const parsed = JSON.parse(val) as EmergencyContact;
        setContact(parsed);
        setNameInput(parsed.name);
        setPhoneInput(parsed.phone);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      Alert.alert(t("emergency.missingFields", "Please fill in all fields"));
      return;
    }
    const c: EmergencyContact = { name: nameInput.trim(), phone: phoneInput.trim() };
    await AsyncStorage.setItem(storageKey, JSON.stringify(c));
    setContact(c);
    setIsEditing(false);
  };

  const handleCall = () => {
    if (!contact?.phone) return;
    const url = `tel:${contact.phone}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(t("emergency.callFailed", "Could not open phone app"))
    );
  };

  const handleDelete = () => setShowDeleteConfirm(true);

  const confirmDelete = async () => {
    await AsyncStorage.removeItem(storageKey);
    setContact(null);
    setNameInput("");
    setPhoneInput("");
    setShowDeleteConfirm(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={["#C0392B", "#E53E3E"]}
        style={[styles.header, { paddingTop: top + 10 }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcons}>
            <View style={styles.sosCircle}>
              <Ionicons name="call" size={22} color="#fff" />
            </View>
            <View style={styles.sosCircle}>
              <Ionicons name="accessibility" size={22} color="#fff" />
            </View>
          </View>
          <Text style={styles.headerTitle}>
            {t("emergency.title", "Emergency Contact")}
          </Text>
          <Text style={styles.headerSub}>
            {isFamily
              ? t("emergency.subFamily", "Your personal emergency contact")
              : t("emergency.sub", "Call for help instantly")}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── No Contact State ── */}
        {!contact && !isEditing && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="person-add-outline" size={42} color="#E53E3E" />
            </View>
            <Text style={styles.emptyTitle}>
              {t("emergency.noContact", "No emergency contact set")}
            </Text>
            <Text style={styles.emptySub}>
              {t("emergency.noContactSub", "Add a contact to call in case of emergency")}
            </Text>
            <Pressable style={styles.addBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.addBtnText}>
                {t("emergency.addContact", "Add Emergency Contact")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Contact Card ── */}
        {contact && !isEditing && (
          <>
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <Pressable
                  style={styles.callSmallBtn}
                  onPress={handleCall}
                  accessibilityLabel={t("aria.callContact", { name: contact.name })}
                  accessibilityRole="button"
                >
                  <Ionicons name="call" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  style={styles.editSmallBtn}
                  onPress={() => setIsEditing(true)}
                  accessibilityLabel={t("aria.editContact")}
                  accessibilityRole="button"
                >
                  <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                </Pressable>
                <Pressable
                  style={styles.deleteSmallBtn}
                  onPress={handleDelete}
                  accessibilityLabel={t("aria.deleteContact")}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                </Pressable>
              </View>
            </View>

            {/* ── BIG CALL BUTTON ── */}
            <Pressable
              style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.88 }]}
              onPress={handleCall}
              accessibilityLabel={t("aria.callContact", { name: contact.name })}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={["#C0392B", "#E53E3E"]}
                style={styles.callBtnGradient}
              >
                <View style={styles.callBtnInner}>
                  <Ionicons name="call" size={40} color="#fff" />
                </View>
                <Text style={styles.callBtnText}>
                  {t("emergency.callNow", "Call Now")}
                </Text>
                <Text style={styles.callBtnPhone}>{contact.phone}</Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.callHint}>
              {t("emergency.callHint", "Press the button to call your emergency contact immediately")}
            </Text>
          </>
        )}

        {/* ── Edit / Add Form ── */}
        {isEditing && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {contact
                ? t("emergency.editContact", "Edit Contact")
                : t("emergency.addContact", "Add Emergency Contact")}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t("emergency.contactName", "Contact Name")}
              </Text>
              <TextInput
                style={[styles.input, isRTL && { textAlign: "right" }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t("emergency.namePlaceholder", "e.g. Mom, Dad, Doctor")}
                placeholderTextColor={theme.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t("emergency.contactPhone", "Phone Number")}
              </Text>
              <TextInput
                style={[styles.input, isRTL && { textAlign: "right" }]}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="e.g. +972501234567"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formBtns}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setIsEditing(false);
                  if (contact) {
                    setNameInput(contact.name);
                    setPhoneInput(contact.phone);
                  }
                }}
              >
                <Text style={styles.cancelBtnText}>{t("cancel", "Cancel")}</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t("emergency.save", "Save")}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trash-outline" size={28} color="#D32F2F" />
            </View>
            <Text style={styles.modalTitle}>
              {t("emergency.deleteTitle", "Remove Contact")}
            </Text>
            <Text style={styles.modalMsg}>
              {t("emergency.deleteConfirm", "Are you sure you want to remove this emergency contact?")}
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.modalCancelText}>{t("cancel", "Cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>{t("delete", "Remove")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },

    // Header
    header: { paddingBottom: 14 },
    headerContent: { alignItems: "center", paddingHorizontal: 24, gap: 6 },
    headerIcons: { flexDirection: "row", gap: 12, marginBottom: 2 },
    sosCircle: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
    headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center" },

    content: { padding: 20, gap: 16 },

    // Empty state
    emptyCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      padding: 32,
      alignItems: "center",
      gap: 12,
      elevation: 2,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    emptyIcon: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: theme.dangerBg,
      alignItems: "center", justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.text, textAlign: "center" },
    emptySub: { fontSize: 13, color: theme.textLight, textAlign: "center", paddingHorizontal: 16 },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "#E53E3E",
      paddingHorizontal: 24, paddingVertical: 12,
      borderRadius: 14, marginTop: 8,
    },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    // Contact card
    contactCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 18,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      elevation: 2,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    contactAvatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: "#E53E3E",
      alignItems: "center", justifyContent: "center",
    },
    contactAvatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
    contactInfo: { flex: 1 },
    contactName: { fontSize: 16, fontWeight: "700", color: theme.text },
    contactPhone: { fontSize: 13, color: theme.textLight, marginTop: 2 },
    contactActions: { flexDirection: "row", gap: 8 },
    callSmallBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#E53E3E",
      alignItems: "center", justifyContent: "center",
    },
    editSmallBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: theme.primaryBg,
      alignItems: "center", justifyContent: "center",
    },
    deleteSmallBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: theme.dangerBg,
      alignItems: "center", justifyContent: "center",
    },

    // Delete confirmation modal
    modalBackdrop: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
    },
    modalBox: {
      backgroundColor: theme.bgCard, borderRadius: 24,
      padding: 24, width: "100%", alignItems: "center",
      shadowColor: theme.shadow, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    modalIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: "#FDEDED", alignItems: "center",
      justifyContent: "center", marginBottom: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: "700", color: theme.text, marginBottom: 8 },
    modalMsg: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginBottom: 24, lineHeight: 20 },
    modalBtns: { flexDirection: "row", gap: 12, width: "100%" },
    modalCancelBtn: {
      flex: 1, height: 48, borderRadius: 14,
      borderWidth: 1, borderColor: theme.border,
      alignItems: "center", justifyContent: "center",
    },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
    modalDeleteBtn: {
      flex: 1, height: 48, borderRadius: 14,
      backgroundColor: "#D32F2F",
      alignItems: "center", justifyContent: "center",
    },
    modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

    // Call button
    callBtn: { borderRadius: 24, overflow: "hidden", elevation: 6, shadowColor: "#E53E3E", shadowOpacity: 0.4, shadowRadius: 12 },
    callBtnGradient: { padding: 28, alignItems: "center", gap: 10 },
    callBtnInner: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center", justifyContent: "center",
    },
    callBtnText: { color: "#fff", fontSize: 22, fontWeight: "800" },
    callBtnPhone: { color: "rgba(255,255,255,0.8)", fontSize: 15 },
    callHint: { fontSize: 12, color: theme.placeholder, textAlign: "center", paddingHorizontal: 32 },

    // Form
    form: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      elevation: 2,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    formTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
    input: {
      backgroundColor: theme.bgInput,
      borderWidth: 1,
      borderColor: theme.borderLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    formBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
    cancelBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 12,
      borderWidth: 1.5, borderColor: theme.borderStrong,
      alignItems: "center",
    },
    cancelBtnText: { color: theme.textLight, fontWeight: "600", fontSize: 14 },
    saveBtn: {
      flex: 1, flexDirection: "row", gap: 6,
      paddingVertical: 13, borderRadius: 12,
      backgroundColor: "#E53E3E",
      alignItems: "center", justifyContent: "center",
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}
