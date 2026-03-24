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

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { addSleep } from "@/services/api";

export default function AddSleepScreen() {
const [sleepHours, setSleepHours] = useState("");
const [notes, setNotes] = useState("");
const [timestamp, setTimestamp] = useState("");

const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

const onSave = async () => {
try {
setErrorMsg("");

const hoursValue = Number(sleepHours);
if (!sleepHours || Number.isNaN(hoursValue) || hoursValue <= 0) {
setErrorMsg("Please enter valid sleep hours");
return;
}

setSaving(true);

await addSleep({
sleep_hours: hoursValue,
notes: notes.trim(),
timestamp: timestamp?.trim()
? new Date(timestamp).toISOString()
: new Date().toISOString(),
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

<View style={styles.hero}>
<Text style={styles.screenTitle}>Add Sleep</Text>
<Text style={styles.screenSub}>Track your sleep hours</Text>
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

<View style={styles.formCard}>
<View style={styles.formGroup}>
<Text style={styles.label}>Sleep Hours</Text>
<TextInput
value={sleepHours}
onChangeText={setSleepHours}
placeholder="e.g. 7"
placeholderTextColor={stylesVars.muted}
keyboardType="numeric"
style={styles.input}
/>
</View>

<View style={styles.formGroup}>
<Text style={styles.label}>Notes</Text>
<TextInput
value={notes}
onChangeText={setNotes}
placeholder="Optional notes"
placeholderTextColor={stylesVars.muted}
style={[styles.input, styles.textArea]}
multiline
/>
</View>

<View style={styles.formGroup}>
<Text style={styles.label}>Time</Text>
<TextInput
value={timestamp}
onChangeText={setTimestamp}
placeholder="Optional - leave empty for now"
placeholderTextColor={stylesVars.muted}
style={styles.input}
/>
<Text style={styles.helperText}>
Leave empty to use the current time.
</Text>
</View>

<Pressable
style={[styles.saveBtn, saving && styles.disabledBtn]}
onPress={onSave}
disabled={saving}
>
<Text style={styles.saveBtnText}>
{saving ? "Saving..." : "Save Sleep"}
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
