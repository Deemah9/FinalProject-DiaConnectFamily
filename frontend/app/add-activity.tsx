import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { addActivity } from "@/services/api";

export default function AddActivityScreen() {
const { t } = useTranslation();
const [type, setType] = useState("");
const [durationMinutes, setDurationMinutes] = useState("");
const [notes, setNotes] = useState("");
const [timestamp, setTimestamp] = useState("");

const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

const onSave = async () => {
try {
setErrorMsg("");

if (!type.trim()) {
setErrorMsg(t("enterActivityType"));
return;
}

const durationValue = Number(durationMinutes);
if (
!durationMinutes ||
Number.isNaN(durationValue) ||
durationValue <= 0
) {
setErrorMsg(t("invalidDuration"));
return;
}

setSaving(true);

await addActivity({
type: type.trim(),
duration_minutes: durationValue,
notes: notes.trim(),
timestamp: timestamp?.trim()
? new Date(timestamp).toISOString()
: new Date().toISOString(),
});

router.back();
} catch (error: any) {
console.log("add activity error:", error);
setErrorMsg(error?.message || "Failed to add activity");
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
<Text style={styles.logoTitle}>{t("diaConnect")}</Text>
<Text style={styles.logoSub}>{t("family")}</Text>
</View>
</View>

<View style={styles.placeholder} />
</View>

<View style={styles.hero}>
<Text style={styles.screenTitle}>{t("addActivity")}</Text>
<Text style={styles.screenSub}>{t("trackActivity")}</Text>
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

<View style={styles.formCard}>
<View style={styles.formGroup}>
<Text style={styles.label}>{t("activityType")}</Text>
<TextInput
value={type}
onChangeText={setType}
placeholder={t("activityTypePlaceholder")}
placeholderTextColor={stylesVars.muted}
style={styles.input}
/>
</View>

<View style={styles.formGroup}>
<Text style={styles.label}>{t("durationMinutes")}</Text>
<TextInput
value={durationMinutes}
onChangeText={setDurationMinutes}
placeholder={t("durationPlaceholder")}
placeholderTextColor={stylesVars.muted}
keyboardType="number-pad"
style={styles.input}
/>
</View>

<View style={styles.formGroup}>
<Text style={styles.label}>{t("notes")}</Text>
<TextInput
value={notes}
onChangeText={setNotes}
placeholder={t("optionalNotes")}
placeholderTextColor={stylesVars.muted}
style={[styles.input, styles.textArea]}
multiline
/>
</View>

<View style={styles.formGroup}>
<Text style={styles.label}>{t("time")}</Text>
<TextInput
value={timestamp}
onChangeText={setTimestamp}
placeholder={t("optional")}
placeholderTextColor={stylesVars.muted}
style={styles.input}
/>
<Text style={styles.helperText}>
{t("leaveEmptyTime")}
</Text>
</View>

<Pressable
style={[styles.saveBtn, saving && styles.disabledBtn]}
onPress={onSave}
disabled={saving}
>
<Text style={styles.saveBtnText}>
{saving ? t("saving") : t("saveActivity")}
</Text>
</Pressable>
</View>
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
};

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: stylesVars.bg },

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

placeholder: { width: 40 },

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
marginBottom: 20,
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

formCard: {
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

formGroup: {
marginBottom: 18,
},

label: {
fontSize: 14,
fontWeight: "600",
color: "#374151",
marginBottom: 10,
},

input: {
minHeight: 52,
borderRadius: 14,
borderWidth: 1,
borderColor: "#E5E7EB",
backgroundColor: "#F9FAFB",
paddingHorizontal: 14,
paddingVertical: 14,
color: "#1F2937",
...Typography.button,
},

textArea: {
minHeight: 96,
textAlignVertical: "top",
},

helperText: {
marginTop: 8,
fontSize: 12,
color: stylesVars.muted,
},

saveBtn: {
marginTop: 10,
height: 54,
borderRadius: 14,
backgroundColor: stylesVars.primary,
alignItems: "center",
justifyContent: "center",
},

disabledBtn: {
opacity: 0.7,
},

saveBtnText: {
color: "#FFFFFF",
...Typography.button,
},
});
