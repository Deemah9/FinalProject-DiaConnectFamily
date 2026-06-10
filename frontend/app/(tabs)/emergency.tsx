import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import AppHeader from "@/src/components/AppHeader";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
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

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

const MAX_CONTACTS = 5;
const AVATAR_COLORS = ["#E53E3E", "#1A6FA8", "#059669", "#D97706", "#7C3AED"];

export default function EmergencyScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.dir() === "rtl";
  const theme = useAppTheme();
  const styles = createStyles(theme, isRTL);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const storageKey = `emergency_contacts_${user?.email ?? "default"}`;
  const oldStorageKey = `emergency_contact_${user?.email ?? "default"}`;

  useEffect(() => {
    const load = async () => {
      // Migrate old single-contact format
      const oldVal = await AsyncStorage.getItem(oldStorageKey);
      if (oldVal) {
        const old = JSON.parse(oldVal);
        const migrated: EmergencyContact[] = [{ id: Date.now().toString(), name: old.name, phone: old.phone }];
        await AsyncStorage.setItem(storageKey, JSON.stringify(migrated));
        await AsyncStorage.removeItem(oldStorageKey);
        setContacts(migrated);
        return;
      }
      const val = await AsyncStorage.getItem(storageKey);
      if (val) setContacts(JSON.parse(val));
    };
    load();
  }, []);

  const persist = async (updated: EmergencyContact[]) => {
    setContacts(updated);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const openAdd = () => {
    setEditingIndex(null);
    setNameInput("");
    setPhoneInput("");
    setIsFormOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setNameInput(contacts[index].name);
    setPhoneInput(contacts[index].phone);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      Alert.alert(t("emergency.missingFields", "Please fill in all fields"));
      return;
    }
    if (editingIndex !== null) {
      const updated = contacts.map((c, i) =>
        i === editingIndex ? { ...c, name: nameInput.trim(), phone: phoneInput.trim() } : c
      );
      await persist(updated);
    } else {
      const newContact: EmergencyContact = {
        id: Date.now().toString(),
        name: nameInput.trim(),
        phone: phoneInput.trim(),
      };
      await persist([...contacts, newContact]);
    }
    setIsFormOpen(false);
  };

  const handleCall = (contact: EmergencyContact) => {
    Linking.openURL(`tel:${contact.phone}`).catch(() =>
      Alert.alert(t("emergency.callFailed", "Could not open phone app"))
    );
  };

  const confirmDelete = async () => {
    if (deleteIndex === null) return;
    await persist(contacts.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader />

      {/* ── Page title ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t("emergency.title", "Emergency Contact")}</Text>
        <Text style={styles.pageSub}>{t("emergency.sub", "Call for help instantly")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Empty state ── */}
        {contacts.length === 0 && (
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
            <Pressable style={styles.addBtn} onPress={openAdd}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.addBtnText}>
                {t("emergency.addContact", "Add Emergency Contact")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Contacts list ── */}
        {contacts.length > 0 && (
          <>
            {contacts.map((contact, index) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={[styles.contactAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
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
                    onPress={() => handleCall(contact)}
                    accessibilityLabel={t("aria.callContact", { name: contact.name })}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                  </Pressable>
                  <Pressable
                    style={styles.editSmallBtn}
                    onPress={() => openEdit(index)}
                    accessibilityLabel={t("aria.editContact")}
                    accessibilityRole="button"
                  >
                    <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                  </Pressable>
                  <Pressable
                    style={styles.deleteSmallBtn}
                    onPress={() => setDeleteIndex(index)}
                    accessibilityLabel={t("aria.deleteContact")}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Add another contact button */}
            {contacts.length < MAX_CONTACTS && (
              <Pressable style={styles.addMoreBtn} onPress={openAdd}>
                <Ionicons name="add-circle-outline" size={18} color="#E53E3E" />
                <Text style={styles.addMoreText}>
                  {t("emergency.addContact", "Add Emergency Contact")}
                </Text>
              </Pressable>
            )}

            {contacts.length >= MAX_CONTACTS && (
              <Text style={styles.maxNote}>
                {t("emergency.maxContacts", { max: MAX_CONTACTS })}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Add / Edit Form Modal ── */}
      <Modal
        visible={isFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFormOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.formBackdrop} onPress={() => setIsFormOpen(false)} />
          <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <Text style={styles.formTitle}>
              {editingIndex !== null
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
                placeholder="e.g. +972501234"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.formBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setIsFormOpen(false)}>
                <Text style={styles.cancelBtnText}>{t("cancel", "Cancel")}</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t("emergency.save", "Save")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={deleteIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteIndex(null)}
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
              <Pressable style={styles.modalCancelBtn} onPress={() => setDeleteIndex(null)}>
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

function createStyles(theme: ReturnType<typeof useAppTheme>, isRTL: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },

    // Page header
    pageHeader: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      gap: 4,
    },
    pageTitle: { fontSize: 20, fontWeight: "700", color: theme.text, textAlign: isRTL ? "right" : "left" },
    pageSub: { fontSize: 13, color: theme.textMuted, lineHeight: 19, textAlign: isRTL ? "right" : "left" },

    content: { padding: 20, gap: 14, paddingBottom: 40 },

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
      width: 48, height: 48, borderRadius: 24,
      alignItems: "center", justifyContent: "center",
    },
    contactAvatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
    contactInfo: { flex: 1 },
    contactName: { fontSize: 15, fontWeight: "700", color: theme.text },
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

    // Add more button
    addMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed" as any,
      borderColor: "#E53E3E",
    },
    addMoreText: { color: "#E53E3E", fontWeight: "600", fontSize: 14 },
    maxNote: { fontSize: 12, color: theme.textMuted, textAlign: "center" },

    // Form sheet (bottom modal)
    formBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    formSheet: {
      backgroundColor: theme.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingTop: 12,
      gap: 16,
    },
    formHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 8,
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
  });
}
