import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Typography } from "@/constants/Typography";
import { getProfile } from "@/services/api";
import { useTranslation } from "react-i18next";

export default function ProfileScreen() {
const { t } = useTranslation();
const [user, setUser] = useState<any>(null);
const [loadingUser, setLoadingUser] = useState(true);
const [errorUser, setErrorUser] = useState("");

const loadUser = async () => {
try {
setLoadingUser(true);
setErrorUser("");

const data = await getProfile();
setUser(data);
} catch (error: any) {
setErrorUser(error?.message || "Failed to load profile");
} finally {
setLoadingUser(false);
}
};

useFocusEffect(
useCallback(() => {
loadUser();
}, [])
);

const fullName =
user?.firstName && user?.lastName
? `${user.firstName} ${user.lastName}`
: user?.firstName || t("user");

const medical = user?.medical || {};
const lifestyle = user?.lifestyle || {};

const medicationsText = Array.isArray(medical?.medications)
? medical.medications.join(", ")
: medical?.medications || "--";

return (
<View style={styles.container}>
<ScrollView contentContainerStyle={styles.content}>
{/* Header / Logo */}
<View style={styles.topHeader}>
<View style={styles.logoWrap}>
<Ionicons name="heart-outline" size={28} color={Colors.gold} />
<View style={{ marginLeft: 8 }}>
<Text style={styles.logoTitle}>{t("diaConnect")}</Text>
<Text style={styles.logoSub}>{t("family")}</Text>
</View>
</View>
</View>

{/* Title */}
<View style={styles.hero}>
<Text style={styles.screenTitle}>{t("myProfile")}</Text>
<Text style={styles.screenSub}>
{loadingUser
? t("loadingProfile")
: errorUser || t("manageInfo")}
</Text>
</View>

{/* Main Card */}
<View style={styles.profileCard}>
{/* Profile Header */}
<View style={styles.profileHeader}>
<View style={styles.avatar}>
<Ionicons
name="person-outline"
size={40}
color={stylesVars.primary}
/>
</View>

<Text style={styles.nameText}>
{loadingUser ? t("loading") : fullName}
</Text>
<Text style={styles.emailText}>{user?.email || "--"}</Text>

<View style={styles.roleBadge}>
<Text style={styles.roleBadgeText}>{user?.role || t("patient")}</Text>
</View>
</View>

{/* Basic Info */}
<View style={styles.section}>
<View style={styles.sectionHeader}>
<Ionicons
name="person-circle-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.sectionTitle}>{t("basicInfo")}</Text>
</View>

<View style={styles.infoList}>
<InfoRow label={t("firstName")} value={user?.firstName || "--"} />
<InfoRow label={t("lastName")} value={user?.lastName || "--"} />
<InfoRow label={t("email")} value={user?.email || "--"} />
<InfoRow label={t("phone")} value={user?.phone || "--"} />
<InfoRow label={t("role")} value={user?.role || "--"} />
</View>
</View>

{/* Medical Info */}
<View style={styles.section}>
<View style={styles.sectionHeader}>
<Ionicons
name="pulse-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.sectionTitle}>{t("medicalInfo")}</Text>
</View>

<View style={styles.infoList}>
<InfoRow
label={t("diagnosisYear")}
value={medical?.diagnosis_year?.toString() || "--"}
/>
<InfoRow
label={t("medications")}
value={medicationsText}
isMultiLine
/>
</View>
</View>

{/* Lifestyle */}
<View style={styles.section}>
<View style={styles.sectionHeader}>
<Ionicons
name="moon-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.sectionTitle}>{t("lifestyle")}</Text>
</View>

<View style={styles.infoList}>
<InfoRow
label={t("activityLevel")}
value={
user?.activity_level ||
lifestyle?.activity_level ||
"--"
}
/>
<InfoRow
label={t("sleepHours")}
value={
user?.sleep_hours?.toString() ||
lifestyle?.sleep_hours?.toString() ||
"--"
}
/>
</View>
</View>

{/* Edit Button */}
<View style={styles.buttonWrap}>
<Pressable
style={styles.primaryBtn}
onPress={() => router.push("/edit-profile" as any)}
>
<Text style={styles.primaryText}>{t("editProfile")}</Text>
</Pressable>
</View>
</View>

<View style={{ height: 20 }} />
</ScrollView>
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
<Text style={[styles.rowValue, isMultiLine && styles.rowValueMulti]}>
{value}
</Text>
</View>
);
}

const stylesVars = {
primary: "#4A7DC9",
bg: "#FFFFFF",
card: "#FFFFFF",
text: "#1F2937",
muted: "#6B7280",
border: "#F3F4F6",
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
paddingBottom: 110,
},

topHeader: {
paddingBottom: 16,
borderBottomWidth: 1,
borderBottomColor: "#F3F4F6",
alignItems: "center",
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

profileCard: {
backgroundColor: "#FFFFFF",
borderRadius: 24,
borderWidth: 1,
borderColor: stylesVars.border,
overflow: "hidden",
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 8,
shadowOffset: { width: 0, height: 3 },
elevation: 2,
},

profileHeader: {
backgroundColor: "#F8FBFF",
alignItems: "center",
paddingTop: 30,
paddingBottom: 24,
paddingHorizontal: 24,
},

avatar: {
width: 82,
height: 82,
borderRadius: 999,
backgroundColor: "#DBEAFE",
alignItems: "center",
justifyContent: "center",
marginBottom: 14,
},

nameText: {
fontSize: 24,
fontWeight: "700",
color: stylesVars.text,
marginBottom: 4,
textAlign: "center",
},

emailText: {
fontSize: 13,
color: stylesVars.muted,
marginBottom: 12,
textAlign: "center",
},

roleBadge: {
paddingHorizontal: 14,
paddingVertical: 7,
borderRadius: 999,
backgroundColor: "#EFF6FF",
borderWidth: 1,
borderColor: "#DBEAFE",
},

roleBadgeText: {
fontSize: 12,
color: stylesVars.primary,
fontWeight: "600",
},

section: {
paddingHorizontal: 24,
paddingTop: 22,
paddingBottom: 6,
borderTopWidth: 1,
borderTopColor: stylesVars.border,
},

sectionHeader: {
flexDirection: "row",
alignItems: "center",
marginBottom: 14,
gap: 8,
},

sectionTitle: {
fontSize: 16,
fontWeight: "700",
color: stylesVars.text,
},

infoList: {
gap: 10,
},

rowBox: {
backgroundColor: stylesVars.soft,
borderRadius: 14,
paddingHorizontal: 16,
paddingVertical: 14,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},

rowBoxMulti: {
alignItems: "flex-start",
},

rowLabel: {
fontSize: 13,
color: stylesVars.muted,
flex: 1,
marginRight: 12,
},

rowValue: {
fontSize: 13,
color: stylesVars.text,
fontWeight: "600",
flexShrink: 1,
textAlign: "right",
},

rowValueMulti: {
maxWidth: "55%",
},

buttonWrap: {
paddingHorizontal: 24,
paddingTop: 12,
paddingBottom: 24,
},

primaryBtn: {
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

primaryText: {
color: "#FFFFFF",
...Typography.button,
},
});
