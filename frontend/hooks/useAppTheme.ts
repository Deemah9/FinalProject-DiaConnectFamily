import { darkColors, lightColors } from "@/constants/Colors";
import { useFontSize } from "@/context/FontSizeContext";
import { useTheme } from "@/context/ThemeContext";

export function useAppTheme() {
  const { isDark } = useTheme();
  const { fontScale } = useFontSize();
  const colors = isDark ? darkColors : lightColors;
  return {
    ...colors,
    fontScale,
    /** Scale a font size by the user's preferred scale */
    fs: (n: number) => Math.round(n * fontScale),
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
