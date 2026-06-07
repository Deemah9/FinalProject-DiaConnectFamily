import { darkColors, darkContrastColors, lightColors, lightContrastColors } from "@/constants/Colors";
import { useFontSize } from "@/context/FontSizeContext";
import { useHighContrast } from "@/context/HighContrastContext";
import { useTheme } from "@/context/ThemeContext";

export function useAppTheme() {
  const { isDark } = useTheme();
  const { isHighContrast } = useHighContrast();
  const { fontScale } = useFontSize();

  const colors =
    isDark
      ? isHighContrast ? darkContrastColors  : darkColors
      : isHighContrast ? lightContrastColors : lightColors;

  return {
    ...colors,
    isHighContrast,
    fontScale,
    fs: (n: number) => Math.round(n * fontScale),
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
