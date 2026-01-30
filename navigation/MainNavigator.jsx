import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import ExploreScreen from "../app/(tabs)/explore";
import HomeScreen from "../app/(tabs)/index";

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
    </Tab.Navigator>
  );
}
