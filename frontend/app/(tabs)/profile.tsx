import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { getProfile, updateLifestyle, updateMedical, updateProfile, deleteAccount, getHealthInfo, updateHealthInfo } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

const PRIMARY   = "#1A6FA8";
const BG        = "#FFFFFF";
const TEXT      = "#0B1A2E";
const MUTED     = "#4A6480";
const BORDER    = "#D6E8F5";
const SOFT      = "#E8F1F8";
const INPUT_BDR = "#B8D0E8";

const CONDITION_IDS  = ["hypertension", "kidney_disease", "heart_disease", "dyslipidemia", "obesity", "neuropathy"] as const;
const SLOW_INSULIN_IDS = ["insulin_lantus", "insulin_tresiba", "insulin_toujeo", "insulin_basaglar", "insulin_levemir"] as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();

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
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={40} color={PRIMARY} />
          </View>
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
              <Field label={t("firstName")}>
                <TextInput value={firstName} onChangeText={setFirstName}
                  placeholder={t("firstName")} placeholderTextColor={MUTED} style={styles.input} />
              </Field>
              <Field label={t("lastName")}>
                <TextInput value={lastName} onChangeText={setLastName}
                  placeholder={t("lastName")} placeholderTextColor={MUTED} style={styles.input} />
              </Field>
              <Field label={t("phone")}>
                <TextInput value={phone} onChangeText={setPhone}
                  placeholder={t("phone")} placeholderTextColor={MUTED}
                  keyboardType="phone-pad" style={styles.input} />
              </Field>
              <SaveCancelRow
                saving={savingBasic}
                onSave={saveBasic}
                onCancel={() => { setEditBasic(false); load(); }}
                t={t}
              />
            </>
          ) : (
            <>
              <InfoRow label={t("firstName")} value={user?.firstName || "--"} />
              <InfoRow label={t("lastName")}  value={user?.lastName  || "--"} />
              <InfoRow label={t("email")}     value={user?.email     || "--"} />
              <InfoRow label={t("phone")}     value={user?.phone     || "--"} />
            </>
          )}
        </View>

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
              <Field label={t("medications")}>
                <TextInput value={medications} onChangeText={setMedications}
                  placeholder={t("medicationsPlaceholder")} placeholderTextColor={MUTED}
                  style={styles.input} />
              </Field>
              <SaveCancelRow
                saving={savingMedical}
                onSave={saveMedical}
                onCancel={() => { setEditMedical(false); load(); }}
                t={t}
              />
            </>
          ) : (
            <>
              <InfoRow label={t("medications")}   value={medicationsDisplay} isMultiLine />
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
              <Field label={t("chronicConditions")}>
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

              <Field label={t("basalInsulinLabel")}>
                <View style={styles.optionsWrap}>
                  {SLOW_INSULIN_IDS.map((id) => {
                    const selected = basalType === id;
                    return (
                      <Pressable
                        key={id}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() => setBasalType(selected ? "" : id)}
                      >
                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                          {t(id)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {!!basalType && (
                <>
                  <Field label={t("basalDose")}>
                    <TextInput
                      value={basalDose}
                      onChangeText={setBasalDose}
                      placeholder="e.g. 20"
                      placeholderTextColor={MUTED}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </Field>
                  <Field label={t("basalTime")}>
                    <TextInput
                      value={basalTime}
                      onChangeText={setBasalTime}
                      placeholder="22:00"
                      placeholderTextColor={MUTED}
                      style={styles.input}
                    />
                  </Field>
                </>
              )}

              <Field label={`${t("insulinSensitivity")} (${t("isfUnit")})`}>
                <TextInput
                  value={isf}
                  onChangeText={setIsf}
                  placeholder="30"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>

              <SaveCancelRow
                saving={savingHealth}
                onSave={saveHealth}
                onCancel={() => { setEditHealth(false); load(); }}
                t={t}
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
              />
              <InfoRow
                label={t("basalInsulinLabel")}
                value={
                  healthInfo?.basal_insulin
                    ? `${t(healthInfo.basal_insulin.type)} · ${healthInfo.basal_insulin.dose}u · ${healthInfo.basal_insulin.time}`
                    : t("notConfigured")
                }
              />
              <InfoRow
                label={t("insulinSensitivity")}
                value={`${healthInfo?.insulin_sensitivity ?? 30} ${t("isfUnit")}`}
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
              <Field label={t("activityLevel")}>
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
              <Field label={t("sleepHours")}>
                <TextInput value={sleepHours} onChangeText={setSleepHours}
                  placeholder={t("sleepHoursPlaceholder")} placeholderTextColor={MUTED}
                  keyboardType="numeric" style={styles.input} />
              </Field>
              <Field label={t("dietType")}>
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
              />
            </>
          ) : (
            <>
              <InfoRow
                label={t("activityLevel")}
                value={life?.activity_level || user?.activity_level || "--"}
              />
              <InfoRow
                label={t("sleepHours")}
                value={
                  life?.sleep_hours?.toString() ||
                  user?.sleep_hours?.toString() ||
                  "--"
                }
              />
              <InfoRow
                label={t("dietType")}
                value={life?.diet_type ? t(`diet_${life.diet_type}`) : "--"}
              />
            </>
          )}
        </View>

        {/* ── Change Password ────────────────────────────────────── */}
        <Pressable
          style={styles.changePwBtn}
          onPress={() => router.push("/change-password")}
        >
          <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
          <Text style={styles.changePwBtnText}>{t("changePassword")}</Text>
          <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
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
              placeholderTextColor="#94A3B8"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
}: {
  label: string;
  value: string;
  isMultiLine?: boolean;
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
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  t: (k: string) => string;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EBF3FA",
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
    color: TEXT,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },

  screenSub: {
    color: MUTED,
    fontSize: 14,
  },

  // Avatar card
  avatarCard: {
    backgroundColor: "#F8FBFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
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

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  nameText: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 2,
    textAlign: "center",
  },

  emailText: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 8,
    textAlign: "center",
  },

  // Section card
  card: {
    backgroundColor: BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
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
    color: TEXT,
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
    backgroundColor: SOFT,
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
    color: MUTED,
    flex: 1,
    marginRight: 12,
  },

  rowValue: {
    fontSize: 13,
    color: TEXT,
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
    color: "#1E3A52",
    marginBottom: 8,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: INPUT_BDR,
    backgroundColor: SOFT,
    paddingHorizontal: 14,
    color: TEXT,
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
    backgroundColor: SOFT,
  },

  optionChipSelected: {
    backgroundColor: "#EEF4FF",
    borderColor: PRIMARY,
  },

  optionChipText: {
    fontSize: 13,
    color: "#1E3A52",
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
    borderColor: INPUT_BDR,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: TEXT,
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
    borderColor: BORDER,
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
    backgroundColor: "#FFFFFF",
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
    color: "#0B1A2E",
    marginBottom: 14,
    textAlign: "center",
  },
  deleteModalWarning: {
    fontSize: 14,
    color: "#4A6480",
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
    color: "#94A3B8",
    fontWeight: "500",
  },
  deletePasswordInput: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 14,
    color: "#0B1A2E",
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
