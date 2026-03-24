import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import { getGlucoseReadings } from "@/services/api";

export default function GlucoseHistoryScreen() {
const { t } = useTranslation();
const [readings, setReadings] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [errorMsg, setErrorMsg] = useState("");

const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 48 - 48;

const loadReadings = async () => {
try {
setLoading(true);
setErrorMsg("");

const data = await getGlucoseReadings();

let result = [];

if (Array.isArray(data)) {
result = data;
} else if (Array.isArray(data?.items)) {
result = data.items;
} else if (Array.isArray(data?.readings)) {
result = data.readings;
} else {
result = [];
}

const sorted = [...result].sort((a, b) => {
const dateA = new Date(
a?.measuredAt || a?.timestamp || a?.createdAt || 0
).getTime();
const dateB = new Date(
b?.measuredAt || b?.timestamp || b?.createdAt || 0
).getTime();
return dateB - dateA;
});

setReadings(sorted);
} catch (error: any) {
console.log("glucose history error:", error);
setErrorMsg(error?.message || "Failed to load glucose history");
} finally {
setLoading(false);
}
};

useFocusEffect(
useCallback(() => {
loadReadings();
}, [])
);

const getStatus = (value: number) => {
if (value < 70) return t("low");
if (value > 180) return t("high");
return t("normal");
};

const getStatusColor = (value: number) => {
if (value < 70) return "#DC2626";
if (value > 180) return "#D97706";
return "#16A34A";
};

const formatDate = (dateString: string) => {
if (!dateString) return "--";
const date = new Date(dateString);
if (Number.isNaN(date.getTime())) return dateString;
return date.toLocaleString();
};

const avg =
readings.length > 0
? Math.round(
readings.reduce((sum, item) => sum + Number(item?.value || 0), 0) /
readings.length
)
: 0;

const min =
readings.length > 0
? Math.min(...readings.map((item) => Number(item?.value || 0)))
: 0;

const max =
readings.length > 0
? Math.max(...readings.map((item) => Number(item?.value || 0)))
: 0;

const chartData = useMemo(() => {
const latestReadings = [...readings].slice(0, 6).reverse();

const labels =
latestReadings.length > 0
? latestReadings.map((item) => {
const rawDate =
item?.measuredAt || item?.timestamp || item?.createdAt || "";
const date = new Date(rawDate);

if (Number.isNaN(date.getTime())) return "--";

const hours = date.getHours().toString().padStart(2, "0");
const minutes = date.getMinutes().toString().padStart(2, "0");
return `${hours}:${minutes}`;
})
: ["--"];

const values =
latestReadings.length > 0
? latestReadings.map((item) => Number(item?.value || 0))
: [0];

return {
labels,
datasets: [
{
data: values,
strokeWidth: 2,
},
],
};
}, [readings]);

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
<Text style={styles.logoTitle}>{t("diaConnect")}</Text>
<Text style={styles.logoSub}>{t("family")}</Text>
</View>
</View>

<View style={styles.placeholder} />
</View>

{/* Title */}
<View style={styles.heroRow}>
<View style={{ flex: 1 }}>
<Text style={styles.screenTitle}>{t("glucoseHistory")}</Text>
<Text style={styles.screenSub}>
{t("trackReadingsTime")}
</Text>
</View>

<Pressable
style={styles.addBtn}
onPress={() => router.push("/add-glucose" as any)}
>
<Ionicons name="add-outline" size={16} color="#FFFFFF" />
<Text style={styles.addBtnText}>{t("add")}</Text>
</Pressable>
</View>

{!!errorMsg && (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{errorMsg}</Text>
</View>
)}

{/* Stats */}
<View style={styles.statsRow}>
<View style={styles.statCard}>
<Text style={styles.statLabel}>{t("average")}</Text>
<Text style={styles.statValue}>{avg || "--"}</Text>
</View>

<View style={styles.statCard}>
<Text style={styles.statLabel}>{t("min")}</Text>
<Text style={styles.statValue}>{min || "--"}</Text>
</View>

<View style={styles.statCard}>
<Text style={styles.statLabel}>{t("max")}</Text>
<Text style={styles.statValue}>{max || "--"}</Text>
</View>
</View>

{/* Chart Card */}
<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="analytics-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>{t("glucoseTrend")}</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>{t("loadingChart")}</Text>
) : readings.length === 0 ? (
<View style={styles.chartPlaceholder}>
<Ionicons name="pulse-outline" size={34} color="#94A3B8" />
<Text style={styles.chartPlaceholderTitle}>{t("noChartData")}</Text>
<Text style={styles.chartPlaceholderSub}>
{t("addReadingsForTrend")}
</Text>
</View>
) : (
<View style={styles.chartWrap}>
<LineChart
data={chartData}
width={chartWidth}
height={220}
fromZero={false}
yAxisSuffix=""
withInnerLines
withOuterLines={false}
withVerticalLines={false}
withHorizontalLabels
withVerticalLabels
segments={4}
bezier
chartConfig={{
backgroundColor: "#FFFFFF",
backgroundGradientFrom: "#FFFFFF",
backgroundGradientTo: "#FFFFFF",
decimalPlaces: 0,
color: (opacity = 1) => `rgba(74, 125, 201, ${opacity})`,
labelColor: (opacity = 1) =>
`rgba(107, 114, 128, ${opacity})`,
propsForDots: {
r: "4",
strokeWidth: "2",
stroke: "#4A7DC9",
},
propsForBackgroundLines: {
stroke: "#E5E7EB",
strokeDasharray: "",
},
}}
style={styles.chart}
/>
</View>
)}
</View>

{/* History List */}
<View style={styles.card}>
<View style={styles.cardHeader}>
<Ionicons
name="time-outline"
size={18}
color={stylesVars.primary}
/>
<Text style={styles.cardTitle}>{t("readingHistory")}</Text>
</View>

{loading ? (
<Text style={styles.loadingText}>{t("loadingReadings")}</Text>
) : readings.length === 0 ? (
<View style={styles.emptyState}>
<Ionicons
name="document-text-outline"
size={30}
color="#94A3B8"
/>
<Text style={styles.emptyTitle}>{t("noReadingsYet")}</Text>
<Text style={styles.emptySub}>{t("addFirstReading")}</Text>
</View>
) : (
<View style={styles.listWrap}>
{readings.map((item, index) => {
const value = Number(item?.value || 0);
const status = getStatus(value);
const statusColor = getStatusColor(value);

return (
<View
key={item?.id || item?._id || index}
style={styles.readingRow}
>
<View style={{ flex: 1 }}>
<Text style={styles.readingValue}>
{value} <Text style={styles.readingUnit}>{t("mgdL")}</Text>
</Text>
<Text style={styles.readingDate}>
{formatDate(
item?.measuredAt || item?.timestamp || item?.createdAt
)}
</Text>
</View>

<View
style={[
styles.statusBadge,
{
backgroundColor: `${statusColor}15`,
borderColor: `${statusColor}40`,
},
]}
>
<Text
style={[styles.statusText, { color: statusColor }]}
>
{status}
</Text>
</View>
</View>
);
})}
</View>
)}
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

addBtn: {
flexDirection: "row",
alignItems: "center",
gap: 6,
paddingHorizontal: 14,
paddingVertical: 10,
borderRadius: 14,
backgroundColor: stylesVars.primary,
},

addBtnText: {
color: "#FFFFFF",
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

statsRow: {
flexDirection: "row",
gap: 10,
marginBottom: 18,
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
marginBottom: 18,
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

chartWrap: {
alignItems: "center",
justifyContent: "center",
borderRadius: 18,
backgroundColor: "#FFFFFF",
overflow: "hidden",
},

chart: {
borderRadius: 18,
},

chartPlaceholder: {
height: 180,
borderRadius: 18,
backgroundColor: "#F8FAFC",
borderWidth: 1,
borderColor: "#E2E8F0",
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 20,
},

chartPlaceholderTitle: {
marginTop: 10,
fontSize: 15,
fontWeight: "700",
color: stylesVars.text,
},

chartPlaceholderSub: {
marginTop: 6,
fontSize: 12,
color: stylesVars.muted,
textAlign: "center",
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

readingRow: {
backgroundColor: "#F9FAFB",
borderRadius: 16,
paddingHorizontal: 16,
paddingVertical: 14,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},

readingValue: {
fontSize: 18,
fontWeight: "700",
color: stylesVars.text,
marginBottom: 4,
},

readingUnit: {
fontSize: 12,
fontWeight: "500",
color: stylesVars.muted,
},

readingDate: {
fontSize: 12,
color: stylesVars.muted,
},

statusBadge: {
paddingHorizontal: 12,
paddingVertical: 8,
borderRadius: 999,
borderWidth: 1,
},

statusText: {
fontSize: 12,
fontWeight: "700",
},
});