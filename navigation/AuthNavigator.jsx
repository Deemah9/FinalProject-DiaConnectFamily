import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import LoginScreen from "../app/(tabs)/index"; // مؤقتًا: شاشة اللوجين هي index الحالية

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      {/* لاحقًا: Register */}
    </Stack.Navigator>
  );
}
