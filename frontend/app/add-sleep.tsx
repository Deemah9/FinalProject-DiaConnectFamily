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

import AppHeader from "@/src/components/AppHeader";
import { Typography } from "@/constants/Typography";
import { addSleep } from "@/services/api";
import TimePicker, { buildTimestamp, initTime } from "@/components/TimePicker";

export default function AddSleepScreen() {
const { t } = useTranslation();
const [sleepHours, setSleepHours] = useState("");
const [notes, setNotes] = useState("");
const [timeState, setTime] = useState(initTime);
const { hours, minutes, isPM } = timeState;

const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

const onSave = async () => {
try {
setErrorMsg("");

const hoursValue = Number(sleepHours);
if (!sleepHours || Number.isNaN(hoursValue) || hoursValue <= 0) {
setErrorMsg(t("invalidSleepHours"));
return;
}

setSaving(true);

await addSleep({
sleep_hours: hoursValue,
notes: notes.trim(),
timestamp: buildTimestamp(hours, minutes, isPM),
});

router.back();
} catch (error: any) {
console.log("add sleep error:", error);
setErrorMsg(error?.message || "Failed to add sleep log");
} finally {
setSaving(false);
}
};

return (
<View style={styles.container}>
<AppHeader />
<ScrollView
contentContainerStyle={styles.content}
keyboardShouldPersistTaps="handled"
>

<View style={styles.hero}>
<Text style={styles.screenTitle}>{t("addSleep")}</Text>
<Text style={styles.screenSub}>{t("trackSleepHours")}</Text>
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

<View style={styles.formCard}>
<View style={styles.formGroup}>
<Text style={styles.label}>{t("sleepHours")}</Text>
<TextInput
value={sleepHours}
onChangeText={setSleepHours}
placeholder={t("sleepHoursPlaceholder")}
placeholderTextColor={stylesVars.muted}
keyboardType="numeric"
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
<TimePicker
label={t("time")}
hours={hours}
minutes={minutes}
isPM={isPM}
onHoursChange={(v) => setTime((prev) => ({ ...prev, hours: v }))}
onMinutesChange={(v) => setTime((prev) => ({ ...prev, minutes: v }))}
onTogglePeriod={(v) => setTime((prev) => ({ ...prev, isPM: v }))}
/>
</View>

<Pressable
style={[styles.saveBtn, saving && styles.disabledBtn]}
onPress={onSave}
disabled={saving}
>
<Text style={styles.saveBtnText}>
{saving ? t("saving") : t("saveSleep")}
</Text>
</Pressable>
</View>
</ScrollView>
</View>
);
}

const stylesVars = {
primary: "#1A6FA8",
bg: "#EBF3FA",
text: "#0B1A2E",
muted: "#4A6480",
border: "#B8D0E8",
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
backgroundColor: "#1A6FA8",
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
    flex: 1,
    justifyContent: 'center',
flexDirection: "row",
alignItems: "center",
},

logoTitle: {
color: "#FFFFFF",
fontSize: 16,
lineHeight: 18,
fontWeight: "600",
},

logoSub: {
color: "rgba(255,255,255,0.75)",
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
backgroundColor: "#FDEDED",
borderWidth: 1,
borderColor: "#F5C2C2",
borderRadius: 16,
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
borderColor: "#D6E8F5",
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
color: "#1E3A52",
marginBottom: 10,
},

input: {
minHeight: 52,
borderRadius: 16,
borderWidth: 1,
borderColor: "#B8D0E8",
backgroundColor: "#E8F1F8",
paddingHorizontal: 14,
paddingVertical: 14,
color: "#0B1A2E",
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
height: 48,
borderRadius: 16,
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
