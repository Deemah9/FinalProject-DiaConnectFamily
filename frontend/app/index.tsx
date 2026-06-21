import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) {
    return <Redirect href={user.role === "family_member" ? "/family-home" : "/(tabs)/index"} />;
  }
  return <Redirect href="/welcome" />;
}
