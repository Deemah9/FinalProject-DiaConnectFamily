import { darkColors, lightColors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

export type AppTheme = typeof lightColors;
