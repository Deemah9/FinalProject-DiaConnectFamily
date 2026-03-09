import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { getProfile, updateMedical } from "@/services/api";

export default function MedicalInfoScreen() {
const [isEditing, setIsEditing] = useState(false);

const [diagnosisYear, setDiagnosisYear] = useState("");
const [medications, setMedications] = useState("");

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

const loadMedicalInfo = async () => {
try {
setLoading(true);
setErrorMsg("");

const data = await getProfile();

const medical =
data?.medical ||
data?.medical_info ||
data?.medicalInfo ||
{};

setDiagnosisYear(medical?.diagnosis_year?.toString() || "");
setMedications(
Array.isArray(medical?.medications)
? medical.medications.join(", ")
: medical?.medications || ""
);
} catch (error: any) {
console.log("loadMedicalInfo error:", error);
setErrorMsg(error?.message || "Failed to load medical info");
} finally {
setLoading(false);
}
};

useEffect(() => {
loadMedicalInfo();
}, []);

useFocusEffect(
useCallback(() => {
loadMedicalInfo();
}, [])
);

const onCancel = async () => {
setIsEditing(false);
await loadMedicalInfo();
};

const onSave = async () => {
try {
setSaving(true);
setErrorMsg("");

const medicationsArray = medications
.split(",")
.map((item) => item.trim())
.filter(Boolean);

await updateMedical({
diagnosis_year: diagnosisYear ? Number(diagnosisYear) : null,
medications: medicationsArray,
});

await loadMedicalInfo();
setIsEditing(false);
} catch (error: any) {
console.log("medical save error:", error);
setErrorMsg(error?.message || "Failed to update medical info");
} finally {
setSaving(false);
}
};

return (
<View style={styles.container}>
<ScrollView
contentContainerStyle={styles.content}
keyboardShouldPersistTaps="handled"
>
<View style={styles.topHeader}>
<Pressable onPress={() => router.back()} style={styles.menuBtn}>
<Ionicons name="arrow-back" size={22} color="#374151" />
</Pressable>

<View style={styles.logoWrap}>
<Ionicons name="heart-outline" size={28} color={Colors.gold} />
<View style={{ marginLeft: 8 }}>
<Text style={styles.logoTitle}>DiaConnect</Text>
<Text style={styles.logoSub}>Family</Text>
</View>
</View>

<View style={styles.placeholder} />
</View>

<View style={styles.heroRow}>
<View style={{ flex: 1 }}>
<Text style={styles.screenTitle}>Medical Information</Text>
<Text style={styles.screenSub}>Manage your medical details</Text>
</View>

{!loading && (
<Pressable
style={styles.editBtn}
onPress={() => setIsEditing((prev) => !prev)}
>
<Ionicons
name="create-outline"
size={16}
color={stylesVars.primary}
/>
<Text style={styles.editBtnText}>{isEditing ? "Close" : "Edit"}</Text>
</Pressable>
)}
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="pulse-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>Medical Details</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>Loading medical info...</Text>
) : (
<>
<View style={styles.itemBlock}>
<Text style={styles.itemLabel}>Diagnosis Year</Text>

{isEditing ? (
<TextInput
value={diagnosisYear}
onChangeText={setDiagnosisYear}
placeholder="2020"
placeholderTextColor={stylesVars.muted}
keyboardType="number-pad"
style={styles.input}
/>
) : (
<View style={styles.rowDisplay}>
<Text style={styles.rowValue}>{diagnosisYear || "--"}</Text>
</View>
)}
</View>

<View style={styles.itemBlock}>
<Text style={styles.itemLabel}>Medications</Text>

{isEditing ? (
<TextInput
value={medications}
onChangeText={setMedications}
placeholder="Insulin, Metformin"
placeholderTextColor={stylesVars.muted}
style={styles.input}
/>
) : (
<View style={styles.rowDisplay}>
<Text style={styles.rowValue}>{medications || "--"}</Text>
</View>
)}
</View>
</>
)}
</View>

{isEditing && !loading && (
<View style={styles.bottomActions}>
<Pressable
style={styles.cancelBtn}
onPress={onCancel}
disabled={saving}
>
<Text style={styles.cancelBtnText}>Cancel</Text>
</Pressable>

<Pressable
style={[styles.saveBtn, saving && styles.disabledBtn]}
onPress={onSave}
disabled={saving}
>
<Text style={styles.saveBtnText}>
{saving ? "Saving..." : "Save Changes"}
</Text>
</Pressable>
</View>
)}

<View style={{ height: 24 }} />
</ScrollView>
</View>
);
}

const stylesVars = {
primary: "#4A7DC9",
bg: "#FFFFFF",
text: "#1F2937",
muted: "#6B7280",
border: "#E5E7EB",
soft: "#F9FAFB",
};

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: stylesVars.bg,
},

content: {
paddingHorizontal: 24,
paddingTop: 20,
paddingBottom: 40,
},

topHeader: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
paddingBottom: 16,
borderBottomWidth: 1,
borderBottomColor: "#F3F4F6",
},

menuBtn: {
width: 40,
height: 40,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
},

placeholder: {
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

heroRow: {
marginTop: 28,
marginBottom: 20,
flexDirection: "row",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 12,
},

screenTitle: {
color: stylesVars.text,
fontSize: 28,
fontWeight: "700",
marginBottom: 8,
},

screenSub: {
color: stylesVars.muted,
fontSize: 14,
},

editBtn: {
flexDirection: "row",
alignItems: "center",
gap: 6,
paddingHorizontal: 14,
paddingVertical: 10,
borderRadius: 14,
backgroundColor: "#EEF4FF",
},

editBtnText: {
color: stylesVars.primary,
fontSize: 14,
fontWeight: "600",
},

errorBox: {
marginBottom: 16,
backgroundColor: "#FEF2F2",
borderWidth: 1,
borderColor: "#FECACA",
borderRadius: 14,
padding: 12,
},

errorText: {
color: "#B91C1C",
fontSize: 13,
fontWeight: "500",
},

card: {
backgroundColor: "#FFFFFF",
borderRadius: 24,
borderWidth: 1,
borderColor: "#F3F4F6",
padding: 24,
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 8,
shadowOffset: { width: 0, height: 3 },
elevation: 2,
},

cardHeader: {
flexDirection: "row",
alignItems: "center",
gap: 8,
marginBottom: 18,
},

cardTitle: {
fontSize: 16,
fontWeight: "700",
color: stylesVars.text,
},

loadingText: {
fontSize: 14,
color: stylesVars.muted,
},

itemBlock: {
marginBottom: 18,
},

itemLabel: {
fontSize: 14,
fontWeight: "600",
color: "#374151",
marginBottom: 10,
},

rowDisplay: {
paddingVertical: 10,
borderBottomWidth: 1,
borderBottomColor: "#ECEFF3",
},

rowValue: {
fontSize: 15,
fontWeight: "600",
color: stylesVars.text,
},

input: {
height: 52,
borderRadius: 14,
borderWidth: 1,
borderColor: "#E5E7EB",
backgroundColor: "#F9FAFB",
paddingHorizontal: 14,
color: "#1F2937",
...Typography.button,
},

bottomActions: {
marginTop: 20,
flexDirection: "row",
gap: 12,
},

cancelBtn: {
flex: 1,
height: 54,
borderRadius: 14,
borderWidth: 1,
borderColor: "#E5E7EB",
backgroundColor: "#FFFFFF",
alignItems: "center",
justifyContent: "center",
},

cancelBtnText: {
color: "#1F2937",
...Typography.button,
},

saveBtn: {
flex: 1,
height: 54,
borderRadius: 14,
backgroundColor: stylesVars.primary,
alignItems: "center",
justifyContent: "center",
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 6,
shadowOffset: { width: 0, height: 2 },
elevation: 2,
},

disabledBtn: {
opacity: 0.7,
},

saveBtnText: {
color: "#FFFFFF",
...Typography.button,
},
});