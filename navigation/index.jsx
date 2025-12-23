import React, { useState } from "react";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";

export default function RootNavigator() {
  // مؤقتاً: false = Auth، true = Main
  const [isLoggedIn] = useState(false);

  // ⚠️ لا تضع NavigationContainer هنا لأن expo-router يضيفه تلقائياً
  return isLoggedIn ? <MainNavigator /> : <AuthNavigator />;
}
