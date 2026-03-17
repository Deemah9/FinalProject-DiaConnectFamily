import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { getTodayLogs } from "@/services/api";

export default function DailyLogScreen() {
const [logs, setLogs] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [errorMsg, setErrorMsg] = useState("");

const loadDailyLogs = async () => {
try {
setLoading(true);
setErrorMsg("");

const data = await getTodayLogs();
setLogs(data || {});
} catch (error: any) {
console.log("daily logs error:", error);
setErrorMsg(error?.message || "Failed to load daily logs");
setLogs({});
} finally {
setLoading(false);
}
};

useFocusEffect(
useCallback(() => {
loadDailyLogs();
}, [])
);

const meals = Array.isArray(logs?.meals) ? logs.meals : [];
const activities = Array.isArray(logs?.activities) ? logs.activities : [];
const sleepLogs = Array.isArray(logs?.sleep)
? logs.sleep
: logs?.sleep
? [logs.sleep]
: [];

const totalMeals = meals.length;
const totalActivities = activities.length;
const totalSleepEntries = sleepLogs.length;

const totalCarbs = meals.reduce(
(sum: number, meal: any) => sum + Number(meal?.carbs || 0),
0
);

const totalActivityMinutes = activities.reduce(
(sum: number, activity: any) => sum + Number(activity?.duration_minutes || 0),
0
);

const latestSleepHours =
sleepLogs.length > 0
? Number(sleepLogs[0]?.sleep_hours || 0)
: 0;

const formatDate = (dateString: string) => {
if (!dateString) return "--";
const date = new Date(dateString);
if (Number.isNaN(date.getTime())) return dateString;
return date.toLocaleString();
};

return (
<View style={styles.container}>
<ScrollView contentContainerStyle={styles.content}>
{/* Header */}
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

{/* Title */}
<View style={styles.hero}>
<Text style={styles.screenTitle}>Daily Log</Text>
<Text style={styles.screenSub}>
Track your meals, activity, and sleep for today
</Text>
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

{/* Quick Add Buttons */}
<View style={styles.section}>
<Text style={styles.sectionLabel}>QUICK ADD</Text>

<View style={styles.quickGrid}>
<Pressable
style={styles.quickCard}
onPress={() => router.push("/add-meal" as any)}
>
<View
style={[styles.quickIconCircle, { backgroundColor: "#FFF7ED" }]}
>
<Ionicons name="restaurant-outline" size={24} color="#EA580C" />
</View>
<Text style={styles.quickTitle}>Add Meal</Text>
<Text style={styles.quickSub}>Log food and carbs</Text>
</Pressable>

<Pressable
style={styles.quickCard}
onPress={() => router.push("/add-activity" as any)}
>
<View
style={[styles.quickIconCircle, { backgroundColor: "#ECFDF5" }]}
>
<Ionicons name="walk-outline" size={24} color="#16A34A" />
</View>
<Text style={styles.quickTitle}>Add Activity</Text>
<Text style={styles.quickSub}>Track movement</Text>
</Pressable>
</View>

<View style={{ marginTop: 14 }}>
<Pressable
style={styles.sleepQuickBtn}
onPress={() => router.push("/add-sleep" as any)}
>
<Ionicons name="moon-outline" size={20} color={stylesVars.primary} />
<Text style={styles.sleepQuickBtnText}>Add Sleep</Text>
</Pressable>
</View>
</View>

{/* Summary */}
<View style={styles.section}>
<Text style={styles.sectionLabel}>TODAY&apos;S SUMMARY</Text>

<View style={styles.statsRow}>
<View style={styles.statCard}>
<Text style={styles.statLabel}>Meals</Text>
<Text style={styles.statValue}>
{loading ? "--" : totalMeals}
</Text>
</View>

<View style={styles.statCard}>
<Text style={styles.statLabel}>Carbs</Text>
<Text style={styles.statValue}>
{loading ? "--" : totalCarbs}
</Text>
</View>

<View style={styles.statCard}>
<Text style={styles.statLabel}>Activity</Text>
<Text style={styles.statValue}>
{loading ? "--" : totalActivityMinutes}
</Text>
</View>
</View>

<View style={[styles.statsRow, { marginTop: 10 }]}>
<View style={styles.statCardWide}>
<Text style={styles.statLabel}>Sleep Hours</Text>
<Text style={styles.statValue}>
{loading ? "--" : latestSleepHours || "--"}
</Text>
</View>

<View style={styles.statCardWide}>
<Text style={styles.statLabel}>Sleep Entries</Text>
<Text style={styles.statValue}>
{loading ? "--" : totalSleepEntries}
</Text>
</View>
</View>
</View>

{/* Meals */}
<View style={styles.section}>
<Text style={styles.sectionLabel}>MEALS</Text>

<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="restaurant-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>Meal Logs</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>Loading meals...</Text>
) : meals.length === 0 ? (
<View style={styles.emptyState}>
<Ionicons name="restaurant-outline" size={30} color="#94A3B8" />
<Text style={styles.emptyTitle}>No meals logged today</Text>
<Text style={styles.emptySub}>Add your first meal</Text>
</View>
) : (
<View style={styles.listWrap}>
{meals.map((meal: any, index: number) => (
<View key={meal?.id || meal?._id || index} style={styles.logRow}>
<View style={{ flex: 1 }}>
<Text style={styles.logMainText}>
{meal?.foods || meal?.name || "Meal"}
</Text>
<Text style={styles.logSubText}>
Carbs: {meal?.carbs || 0} g
</Text>
<Text style={styles.logDateText}>
{formatDate(meal?.timestamp || meal?.createdAt)}
</Text>
</View>

<View style={styles.badge}>
<Text style={styles.badgeText}>Meal</Text>
</View>
</View>
))}
</View>
)}
</View>
</View>

{/* Activities */}
<View style={styles.section}>
<Text style={styles.sectionLabel}>ACTIVITIES</Text>

<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="walk-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>Activity Logs</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>Loading activities...</Text>
) : activities.length === 0 ? (
<View style={styles.emptyState}>
<Ionicons name="walk-outline" size={30} color="#94A3B8" />
<Text style={styles.emptyTitle}>No activities logged today</Text>
<Text style={styles.emptySub}>Add your first activity</Text>
</View>
) : (
<View style={styles.listWrap}>
{activities.map((activity: any, index: number) => (
<View
key={activity?.id || activity?._id || index}
style={styles.logRow}
>
<View style={{ flex: 1 }}>
<Text style={styles.logMainText}>
{activity?.type || "Activity"}
</Text>
<Text style={styles.logSubText}>
Duration: {activity?.duration_minutes || 0} min
</Text>
<Text style={styles.logDateText}>
{formatDate(activity?.timestamp || activity?.createdAt)}
</Text>
</View>

<View style={styles.badge}>
<Text style={styles.badgeText}>Activity</Text>
</View>
</View>
))}
</View>
)}
</View>
</View>

{/* Sleep */}
<View style={styles.section}>
<Text style={styles.sectionLabel}>SLEEP</Text>

<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="moon-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>Sleep Logs</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>Loading sleep logs...</Text>
) : sleepLogs.length === 0 ? (
<View style={styles.emptyState}>
<Ionicons name="moon-outline" size={30} color="#94A3B8" />
<Text style={styles.emptyTitle}>No sleep logged today</Text>
<Text style={styles.emptySub}>Add your sleep entry</Text>
</View>
) : (
<View style={styles.listWrap}>
{sleepLogs.map((sleep: any, index: number) => (
<View key={sleep?.id || sleep?._id || index} style={styles.logRow}>
<View style={{ flex: 1 }}>
<Text style={styles.logMainText}>
{sleep?.sleep_hours || 0} hours
</Text>
<Text style={styles.logSubText}>
{sleep?.notes || "No notes"}
</Text>
<Text style={styles.logDateText}>
{formatDate(sleep?.timestamp || sleep?.createdAt)}
</Text>
</View>

<View style={styles.badge}>
<Text style={styles.badgeText}>Sleep</Text>
</View>
</View>
))}
</View>
)}
</View>
</View>

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

hero: {
marginTop: 28,
marginBottom: 22,
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

section: {
marginBottom: 24,
},

sectionLabel: {
fontSize: 11,
fontWeight: "600",
color: "#6B7280",
marginBottom: 12,
letterSpacing: 1,
},

quickGrid: {
flexDirection: "row",
gap: 14,
},

quickCard: {
flex: 1,
backgroundColor: "#FFFFFF",
borderRadius: 20,
padding: 20,
borderWidth: 1,
borderColor: "#F3F4F6",
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 8,
shadowOffset: { width: 0, height: 3 },
elevation: 2,
alignItems: "center",
},

quickIconCircle: {
width: 48,
height: 48,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
marginBottom: 12,
},

quickTitle: {
color: "#1F2937",
fontSize: 14,
fontWeight: "600",
marginBottom: 4,
textAlign: "center",
},

quickSub: {
color: "#6B7280",
fontSize: 12,
textAlign: "center",
},

sleepQuickBtn: {
height: 54,
borderRadius: 16,
borderWidth: 1,
borderColor: "#E5E7EB",
backgroundColor: "#FFFFFF",
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
},

sleepQuickBtnText: {
color: "#1F2937",
fontSize: 14,
fontWeight: "600",
},

statsRow: {
flexDirection: "row",
gap: 10,
},

statCard: {
flex: 1,
backgroundColor: "#FFFFFF",
borderRadius: 18,
borderWidth: 1,
borderColor: "#F3F4F6",
paddingVertical: 16,
alignItems: "center",
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 8,
shadowOffset: { width: 0, height: 3 },
elevation: 2,
},

statCardWide: {
flex: 1,
backgroundColor: "#FFFFFF",
borderRadius: 18,
borderWidth: 1,
borderColor: "#F3F4F6",
paddingVertical: 16,
alignItems: "center",
shadowColor: "#000",
shadowOpacity: 0.05,
shadowRadius: 8,
shadowOffset: { width: 0, height: 3 },
elevation: 2,
},

statLabel: {
fontSize: 12,
color: stylesVars.muted,
marginBottom: 6,
},

statValue: {
fontSize: 20,
fontWeight: "700",
color: stylesVars.text,
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

emptyState: {
alignItems: "center",
justifyContent: "center",
paddingVertical: 24,
},

emptyTitle: {
marginTop: 10,
fontSize: 15,
fontWeight: "700",
color: stylesVars.text,
},

emptySub: {
marginTop: 6,
fontSize: 12,
color: stylesVars.muted,
},

listWrap: {
gap: 12,
},

logRow: {
backgroundColor: "#F9FAFB",
borderRadius: 16,
paddingHorizontal: 16,
paddingVertical: 14,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
},

logMainText: {
fontSize: 16,
fontWeight: "700",
color: stylesVars.text,
marginBottom: 4,
},

logSubText: {
fontSize: 12,
color: stylesVars.muted,
marginBottom: 4,
},

logDateText: {
fontSize: 11,
color: "#9CA3AF",
},

badge: {
paddingHorizontal: 12,
paddingVertical: 8,
borderRadius: 999,
borderWidth: 1,
borderColor: "#DBEAFE",
backgroundColor: "#EFF6FF",
},

badgeText: {
fontSize: 12,
fontWeight: "700",
color: stylesVars.primary,
},
});