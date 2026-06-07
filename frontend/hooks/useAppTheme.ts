import { darkColors, lightColors } from "@/constants/Colors";
import { useTheme } from "@/context/ThemeContext";

export function useAppTheme() {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
}

export type AppTheme = typeof lightColors;
