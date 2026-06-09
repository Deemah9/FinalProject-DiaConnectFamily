import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  I18nManager,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { getProfile, updateLifestyle, updateMedical, updateProfile, deleteAccount, getHealthInfo, updateHealthInfo } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/useAppTheme";

const PRIMARY   = "#1A6FA8";

const CONDITION_IDS  = ["hypertension", "kidney_disease", "heart_disease", "dyslipidemia", "obesity", "neuropathy"] as const;
const SLOW_INSULIN_IDS = ["insulin_lantus", "insulin_tresiba", "insulin_toujeo", "insulin_basaglar", "insulin_levemir"] as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  // ── Raw data ───────────────────────────────────────────────────────────────
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Basic Info edit state ──────────────────────────────────────────────────
  const [editBasic, setEditBasic]       = useState(false);
  const [firstName, setFirstName]       = useState("");
  const [lastName, setLastName]         = useState("");
  const [phone, setPhone]               = useState("");
  const [savingBasic, setSavingBasic]   = useState(false);
  const [errorBasic, setErrorBasic]     = useState("");

  // ── Medical edit state ─────────────────────────────────────────────────────
  const [editMedical, setEditMedical]         = useState(false);
  const [medications, setMedications]         = useState("");
  const [savingMedical, setSavingMedical]     = useState(false);
  const [errorMedical, setErrorMedical]       = useState("");

  // ── Lifestyle edit state ───────────────────────────────────────────────────
  const [editLifestyle, setEditLifestyle]     = useState(false);
  const [activityLevel, setActivityLevel]     = useState("");
  const [sleepHours, setSleepHours]           = useState("");
  const [dietType, setDietType]               = useState("");
  const [savingLifestyle, setSavingLifestyle] = useState(false);
  const [errorLifestyle, setErrorLifestyle]   = useState("");

  // ── Health Info edit state ────────────────────────────────────────────────
  const [editHealth, setEditHealth]           = useState(false);
  const [conditions, setConditions]           = useState<string[]>([]);
  const [basalType, setBasalType]             = useState("");
  const [basalDose, setBasalDose]             = useState("");
  const [basalTime, setBasalTime]             = useState("");
  const [isf, setIsf]                         = useState("30");
  const [savingHealth, setSavingHealth]       = useState(false);
  const [errorHealth, setErrorHealth]         = useState("");
  const [healthInfo, setHealthInfo]           = useState<any>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [deletePassword, setDeletePassword]   = useState("");
  const [deleteError, setDeleteError]         = useState("");

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = async () => {
    try {
      setLoading(true);
      const [data, health] = await Promise.all([getProfile(), getHealthInfo().catch(() => null)]);
      setUser(data);

      const savedPhoto = await AsyncStorage.getItem(`profile_photo_${data?.email}`);
      if (savedPhoto) setPhotoUri(savedPhoto);

      setFirstName(data?.firstName || data?.first_name || "");
      setLastName(data?.lastName  || data?.last_name  || "");
      setPhone(data?.phone || "");

      const med = data?.medical || data?.medical_info || data?.medicalInfo || {};
      setMedications(
        Array.isArray(med?.medications)
          ? med.medications.join(", ")
          : med?.medications || ""
      );

      const life = data?.lifestyle || {};
      setActivityLevel(life?.activity_level || "");
      setSleepHours(
        life?.sleep_hours !== undefined && life?.sleep_hours !== null
          ? String(life.sleep_hours)
          : ""
      );
      setDietType(life?.diet_type || "");

      if (health) {
        setHealthInfo(health);
        setConditions(health.conditions || []);
        setBasalType(health.basal_insulin?.type || "");
        setBasalDose(health.basal_insulin?.dose != null ? String(health.basal_insulin.dose) : "");
        setBasalTime(health.basal_insulin?.time || "");
        setIsf(health.insulin_sensitivity != null ? String(health.insulin_sensitivity) : "30");
      }
    } catch (e: any) {
      console.log("ProfileScreen load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await deleteAccount(deletePassword);
      await logout();
    } catch (e: any) {
      setDeleting(false);
      setDeleteError(e?.message?.includes("Incorrect") ? t("deleteAccountPasswordError") : e?.message || t("saveFailed"));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      if (user?.email) {
        await AsyncStorage.setItem(`profile_photo_${user.email}`, uri);
      }
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveBasic = async () => {
    try {
      setSavingBasic(true);
      setErrorBasic("");
      await updateProfile({ firstName, lastName, phone });
      await load();
      setEditBasic(false);
    } catch (e: any) {
      setErrorBasic(e?.message || t("saveFailed"));
    } finally {
      setSavingBasic(false);
    }
  };

  const saveMedical = async () => {
    try {
      setSavingMedical(true);
      setErrorMedical("");
      const medicationsArray = medications
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await updateMedical({
        medications: medicationsArray,
      });
      await load();
      setEditMedical(false);
    } catch (e: any) {
      setErrorMedical(e?.message || t("saveFailed"));
    } finally {
      setSavingMedical(false);
    }
  };

  const saveHealth = async () => {
    try {
      setSavingHealth(true);
      setErrorHealth("");
      const payload: any = {
        conditions,
        insulin_sensitivity: isf ? Number(isf) : 30,
      };
      if (basalType && basalDose) {
        payload.basal_insulin = {
          type: basalType,
          dose: Number(basalDose),
          time: basalTime || "00:00",
        };
      } else {
        payload.basal_insulin = null;
      }
      await updateHealthInfo(payload);
      await load();
      setEditHealth(false);
    } catch (e: any) {
      setErrorHealth(e?.message || t("saveFailed"));
    } finally {
      setSavingHealth(false);
    }
  };

  const saveLifestyle = async () => {
    try {
      setSavingLifestyle(true);
      setErrorLifestyle("");
      await updateLifestyle({
        activity_level: activityLevel,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        diet_type: dietType || null,
      });
      await load();
      setEditLifestyle(false);
    } catch (e: any) {
      setErrorLifestyle(e?.message || t("saveFailed"));
    } finally {
      setSavingLifestyle(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || t("user");

  const med  = user?.medical || {};
  const life = user?.lifestyle || {};

  const medicationsDisplay = Array.isArray(med?.medications)
    ? med.medications.join(", ")
    : med?.medications || "--";

  const activityOptions = ["low", "moderate", "high"];
  const dietOptions     = ["balanced", "low_carb", "keto", "vegetarian", "vegan", "other"];

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>{t("myProfile")}</Text>
          <Text style={styles.screenSub}>
            {loading ? t("loadingProfile") : t("manageInfo")}
          </Text>
        </View>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <Pressable style={styles.avatarWrap} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>
                  {user?.firstName?.[0]?.toUpperCase() ?? ""}
                  {user?.lastName?.[0]?.toUpperCase() ?? ""}
                </Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.nameText}>
            {loading ? t("loading") : fullName}
          </Text>
          <Text style={styles.emailText}>{user?.email || "--"}</Text>
        </View>

        {/* ── Basic Info ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="person-circle-outline" size={18} color={PRIMARY} />
              <Text style={styles.cardTitle}>{t("basicInfo")}</Text>
            </View>
            {!loading && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditBasic((v) => !v); setErrorBasic(""); }}
              >
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                <Text style={styles.editBtnText}>{editBasic ? t("close") : t("edit")}</Text>
              </Pressable>
            )}
          </View>

          {!!errorBasic && <Text style={styles.errorText}>{errorBasic}</Text>}

          {editBasic ? (
            <>
              <Field label={t("firstName")} styles={styles}>
                <TextInput value={firstName} onChangeText={setFirstName}
                  placeholder={t("firstName")} placeholderTextColor={theme.textMuted} style={styles.input} />
              </Field>
              <Field label={t("lastName")} styles={styles}>
                <TextInput value={lastName} onChangeText={setLastName}
                  placeholder={t("lastName")} placeholderTextColor={theme.textMuted} style={styles.input} />
              </Field>
              <Field label={t("phone")} styles={styles}>
                <TextInput value={phone} onChangeText={setPhone}
                  placeholder={t("phone")} placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad" style={styles.input} />
              </Field>
              <SaveCancelRow
                saving={savingBasic}
                onSave={saveBasic}
                onCancel={() => { setEditBasic(false); load(); }}
                t={t}
                styles={styles}
              />
            </>
          ) : (
            <>
              <InfoRow label={t("firstName")} value={user?.firstName || "--"} styles={styles} />
              <InfoRow label={t("lastName")}  value={user?.lastName  || "--"} styles={styles} />
              <InfoRow label={t("email")}     value={user?.email     || "--"} styles={styles} />
              <InfoRow label={t("phone")}     value={user?.phone     || "--"} styles={styles} />
            </>
          )}
        </View>

        {/* ── Medical Info, Health Info, Lifestyle — patient only ─────── */}
        {user?.role !== "family_member" && (<>

        {/* ── Medical Info ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="pulse-outline" size={18} color={PRIMARY} />
              <Text style={styles.cardTitle}>{t("medicalInfo")}</Text>
            </View>
            {!loading && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditMedical((v) => !v); setErrorMedical(""); }}
              >
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                <Text style={styles.editBtnText}>{editMedical ? t("close") : t("edit")}</Text>
              </Pressable>
            )}
          </View>

          {!!errorMedical && <Text style={styles.errorText}>{errorMedical}</Text>}

          {editMedical ? (
            <>
              <Field label={t("medications")} styles={styles}>
                <TextInput value={medications} onChangeText={setMedications}
                  placeholder={t("medicationsPlaceholder")} placeholderTextColor={theme.textMuted}
                  style={styles.input} />
              </Field>
              <SaveCancelRow
                saving={savingMedical}
                onSave={saveMedical}
                onCancel={() => { setEditMedical(false); load(); }}
                t={t}
                styles={styles}
              />
            </>
          ) : (
            <>
              <InfoRow label={t("medications")}   value={medicationsDisplay} isMultiLine styles={styles} />
            </>
          )}
        </View>

        {/* ── Health Info ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="medkit-outline" size={18} color={PRIMARY} />
              <Text style={styles.cardTitle}>{t("healthInfo")}</Text>
            </View>
            {!loading && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditHealth((v) => !v); setErrorHealth(""); }}
              >
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                <Text style={styles.editBtnText}>{editHealth ? t("close") : t("edit")}</Text>
              </Pressable>
            )}
          </View>

          {!!errorHealth && <Text style={styles.errorText}>{errorHealth}</Text>}

          {editHealth ? (
            <>
              <Field label={t("chronicConditions")} styles={styles}>
                <View style={styles.optionsWrap}>
                  {CONDITION_IDS.map((id) => {
                    const selected = conditions.includes(id);
                    return (
                      <Pressable
                        key={id}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() =>
                          setConditions((prev) =>
                            selected ? prev.filter((c) => c !== id) : [...prev, id]
                          )
                        }
                      >
                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                          {t(id)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label={`${t("insulinSensitivity")} (${t("isfUnit")})`} styles={styles}>
                <TextInput
                  value={isf}
                  onChangeText={setIsf}
                  placeholder="30"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>

              <SaveCancelRow
                saving={savingHealth}
                onSave={saveHealth}
                onCancel={() => { setEditHealth(false); load(); }}
                t={t}
                styles={styles}
              />
            </>
          ) : (
            <>
              <InfoRow
                label={t("chronicConditions")}
                value={
                  healthInfo?.conditions?.length
                    ? healthInfo.conditions.map((c: string) => t(c)).join(", ")
                    : t("noConditionsSelected")
                }
                isMultiLine
                styles={styles}
              />
              <InfoRow
                label={t("insulinSensitivity")}
                value={`${healthInfo?.insulin_sensitivity ?? 30} ${t("isfUnit")}`}
                styles={styles}
              />
            </>
          )}
        </View>

        {/* ── Lifestyle Habits ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="moon-outline" size={18} color={PRIMARY} />
              <Text style={styles.cardTitle}>{t("lifestyle")}</Text>
            </View>
            {!loading && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditLifestyle((v) => !v); setErrorLifestyle(""); }}
              >
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                <Text style={styles.editBtnText}>{editLifestyle ? t("close") : t("edit")}</Text>
              </Pressable>
            )}
          </View>

          {!!errorLifestyle && <Text style={styles.errorText}>{errorLifestyle}</Text>}

          {editLifestyle ? (
            <>
              <Field label={t("activityLevel")} styles={styles}>
                <View style={styles.optionsWrap}>
                  {activityOptions.map((opt) => {
                    const selected = activityLevel === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() => setActivityLevel(opt)}
                      >
                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                          {t(`activity${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
              <Field label={t("sleepHours")} styles={styles}>
                <TextInput value={sleepHours} onChangeText={setSleepHours}
                  placeholder={t("sleepHoursPlaceholder")} placeholderTextColor={theme.textMuted}
                  keyboardType="numeric" style={styles.input} />
              </Field>
              <Field label={t("dietType")} styles={styles}>
                <View style={styles.optionsWrap}>
                  {dietOptions.map((opt) => {
                    const selected = dietType === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() => setDietType(opt)}
                      >
                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                          {t(`diet_${opt}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
              <SaveCancelRow
                saving={savingLifestyle}
                onSave={saveLifestyle}
                onCancel={() => { setEditLifestyle(false); load(); }}
                t={t}
                styles={styles}
              />
            </>
          ) : (
            <>
              <InfoRow
                label={t("activityLevel")}
                value={life?.activity_level || user?.activity_level || "--"}
                styles={styles}
              />
              <InfoRow
                label={t("sleepHours")}
                value={
                  life?.sleep_hours?.toString() ||
                  user?.sleep_hours?.toString() ||
                  "--"
                }
                styles={styles}
              />
              <InfoRow
                label={t("dietType")}
                value={life?.diet_type ? t(`diet_${life.diet_type}`) : "--"}
                styles={styles}
              />
            </>
          )}
        </View>

        </>)}

        {/* ── Change Password ────────────────────────────────────── */}
        <Pressable
          style={styles.changePwBtn}
          onPress={() => router.push("/change-password")}
        >
          <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
          <Text style={styles.changePwBtnText}>{t("changePassword")}</Text>
          <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={16} color={PRIMARY} />
        </Pressable>

        {/* Delete Account */}
        <Pressable style={styles.deleteAccountBtn} onPress={() => setShowDeleteModal(true)}>
          <Ionicons name="trash-outline" size={18} color="#D32F2F" />
          <Text style={styles.deleteAccountBtnText}>{t("deleteAccount")}</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
      >
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalBox}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="warning-outline" size={32} color="#D32F2F" />
            </View>
            <Text style={styles.deleteModalTitle}>{t("deleteAccount")}</Text>
            <Text style={styles.deleteModalWarning}>{t("deleteAccountPatientWarning")}</Text>
            <TextInput
              style={styles.deletePasswordInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={t("deleteAccountPasswordPlaceholder")}
              placeholderTextColor={theme.inactive}
              secureTextEntry
              editable={!deleting}
            />
            {!!deleteError && <Text style={styles.deletePasswordError}>{deleteError}</Text>}
            <Pressable
              style={[styles.deleteConfirmBtn, (deleting || !deletePassword.trim()) && { opacity: 0.5 }]}
              onPress={handleDeleteAccount}
              disabled={deleting || !deletePassword.trim()}
            >
              <Text style={styles.deleteConfirmText}>
                {deleting ? t("deletingAccount") : t("deleteAccountConfirm")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.deleteCancelBtn}
              onPress={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
              disabled={deleting}
            >
              <Text style={styles.deleteCancelText}>{t("deleteAccountCancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Small shared components ─────────────────────────────────────────────────

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  isMultiLine = false,
  styles,
}: {
  label: string;
  value: string;
  isMultiLine?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.rowBox, isMultiLine && styles.rowBoxMulti]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isMultiLine && styles.rowValueMulti]}>{value}</Text>
    </View>
  );
}

function SaveCancelRow({
  saving,
  onSave,
  onCancel,
  t,
  styles,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  t: (k: string) => string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.saveCancelRow}>
      <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
        <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
      </Pressable>
      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? t("saving") : t("saveChanges")}</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    content: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },

    hero: {
      marginTop: 20,
      marginBottom: 20,
    },

    screenTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 6,
    },

    screenSub: {
      color: theme.textMuted,
      fontSize: 14,
    },

    // Avatar card
    avatarCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    avatarWrap: {
      width: 88,
      height: 88,
      marginBottom: 12,
      position: "relative",
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 3,
      borderColor: PRIMARY,
    },
    avatarInitials: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: "#DBEAFE",
      borderWidth: 3,
      borderColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitialsText: {
      fontSize: 30,
      fontWeight: "800",
      color: PRIMARY,
      letterSpacing: 1,
    },
    cameraBtn: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },

    nameText: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
      textAlign: "center",
    },

    emailText: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 8,
      textAlign: "center",
    },

    // Section card
    card: {
      backgroundColor: theme.bgCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },

    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: "#EEF4FF",
    },

    editBtnText: {
      color: PRIMARY,
      fontSize: 13,
      fontWeight: "600",
    },

    errorText: {
      color: "#B91C1C",
      fontSize: 13,
      marginBottom: 10,
    },

    // Display rows
    rowBox: {
      backgroundColor: theme.bgSoft,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },

    rowBoxMulti: {
      alignItems: "flex-start",
    },

    rowLabel: {
      fontSize: 13,
      color: theme.textMuted,
      flex: 1,
      marginRight: 12,
    },

    rowValue: {
      fontSize: 13,
      color: theme.text,
      fontWeight: "600",
      flexShrink: 1,
      textAlign: "right",
    },

    rowValueMulti: {
      maxWidth: "55%",
    },

    // Edit fields
    fieldBlock: {
      marginBottom: 14,
    },

    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 8,
    },

    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgSoft,
      paddingHorizontal: 14,
      color: theme.text,
      ...Typography.button,
    },

    // Activity chips
    optionsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    optionChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      backgroundColor: theme.bgSoft,
    },

    optionChipSelected: {
      backgroundColor: "#EEF4FF",
      borderColor: PRIMARY,
    },

    optionChipText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "500",
    },

    optionChipTextSelected: {
      color: PRIMARY,
      fontWeight: "700",
    },

    // Save / cancel
    saveCancelRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },

    cancelBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },

    cancelBtnText: {
      color: theme.text,
      ...Typography.button,
    },

    saveBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    saveBtnText: {
      color: "#FFFFFF",
      ...Typography.button,
    },

    changePwBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#EEF4FF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 8,
    },

    changePwBtnText: {
      flex: 1,
      color: PRIMARY,
      fontSize: 15,
      fontWeight: "600",
    },

    deleteAccountBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#FFF0F0",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#FECACA",
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    deleteAccountBtnText: {
      flex: 1,
      color: "#D32F2F",
      fontSize: 15,
      fontWeight: "600",
    },

    deleteModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    deleteModalBox: {
      backgroundColor: theme.bgCard,
      borderRadius: 28,
      padding: 28,
      width: "100%",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    deleteModalIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: "#FEE2E2",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 14,
      textAlign: "center",
    },
    deleteModalWarning: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    deleteConfirmBtn: {
      width: "100%",
      height: 52,
      borderRadius: 16,
      backgroundColor: "#D32F2F",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    deleteConfirmText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    deleteCancelBtn: {
      paddingVertical: 10,
    },
    deleteCancelText: {
      fontSize: 14,
      color: theme.inactive,
      fontWeight: "500",
    },
    deletePasswordInput: {
      width: "100%",
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#FECACA",
      backgroundColor: theme.dangerBg,
      paddingHorizontal: 14,
      color: theme.text,
      fontSize: 14,
      marginBottom: 8,
    },
    deletePasswordError: {
      fontSize: 13,
      color: "#D32F2F",
      marginBottom: 10,
      textAlign: "center",
    },
  });
}
