import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import RootNavigator from "../navigation"; // navigation/index.jsx

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <RootNavigator />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
