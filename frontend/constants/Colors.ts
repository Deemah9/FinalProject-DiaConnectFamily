// ─── Light Theme ─────────────────────────────────────────────────────────────
export const lightColors = {
  // Backgrounds
  bg:          "#EBF3FA",
  bgCard:      "#FFFFFF",
  bgInput:     "#E8F1F8",
  bgSoft:      "#D6E8F5",
  bgAlt:       "#F7FAFC",

  // Text
  text:          "#0B1A2E",
  textSecondary: "#1E3A52",
  textMuted:     "#4A6480",
  textLight:     "#7A96B0",
  placeholder:   "#A0AEC0",
  inactive:      "#94A3B8",

  // Borders
  border:        "#B8D0E8",
  borderLight:   "#E2EDF5",
  borderStrong:  "#CBD5E0",

  // Brand
  primary:       "#1A6FA8",
  primaryLight:  "#2E86C1",
  primaryDark:   "#145B8A",
  primaryBg:     "#EBF8FF",
  gold:          "#E8A317",

  // Status
  statusNormal:   "#0D9E6E",
  statusNormalBg: "#E6F7F2",
  statusLow:      "#E07B00",
  statusLowBg:    "#FEF3E2",
  statusHigh:     "#D32F2F",
  statusHighBg:   "#FDEDED",

  // Feedback
  error:        "#D32F2F",
  errorBg:      "#FDEDED",
  errorBorder:  "#F5C2C2",
  errorText:    "#B91C1C",
  success:      "#0D9E6E",
  successBg:    "#E6F7F2",
  warning:      "#E07B00",
  warningBg:    "#FEF3E2",
  danger:       "#E53E3E",
  dangerBg:     "#FFF5F5",

  // UI
  white:        "#FFFFFF",
  shadow:       "#000000",
  overlay:      "rgba(0,0,0,0.4)",
  tabBar:       "#FFFFFF",
  tabBorder:    "#E2EDF5",

  // Dark-background context (Login/Signup/Welcome — unchanged in both modes)
  textMutedOnDark:   "rgba(255,255,255,0.7)",
  borderLightOnDark: "rgba(255,255,255,0.35)",
  inputBgOnDark:     "rgba(255,255,255,0.06)",
  errorOnDark:       "rgba(255,70,70,0.85)",
  textMutedLight:    "rgba(255,255,255,0.55)",
  textLabel:         "rgba(255,255,255,0.8)",
  linkText:          "rgba(255,255,255,0.9)",
  inputBorder:       "rgba(255,255,255,0.18)",
  errorBgOnDark:     "rgba(255,70,70,0.14)",
  errorBorderOnDark: "rgba(255,70,70,0.5)",
  errorTextOnDark:   "rgba(255,180,180,0.95)",

  // Gradient
  gradientHeader: ["#1A6FA8", "#1A6FA8"] as [string, string],
};

// ─── Dark Theme ──────────────────────────────────────────────────────────────
export const darkColors: typeof lightColors = {
  // Backgrounds
  bg:          "#0F1923",
  bgCard:      "#1A2535",
  bgInput:     "#1E2D3F",
  bgSoft:      "#243040",
  bgAlt:       "#161F2D",

  // Text
  text:          "#E8F0F7",
  textSecondary: "#8DA4BC",
  textMuted:     "#6B8BA4",
  textLight:     "#4A6A85",
  placeholder:   "#3D5A73",
  inactive:      "#2D4A63",

  // Borders
  border:        "#2D4A63",
  borderLight:   "#1E2D3F",
  borderStrong:  "#3D5A73",

  // Brand
  primary:       "#2B8FD4",
  primaryLight:  "#3498DB",
  primaryDark:   "#1A6FA8",
  primaryBg:     "#0D2540",
  gold:          "#E8A317",

  // Status
  statusNormal:   "#10B981",
  statusNormalBg: "#0A2A1F",
  statusLow:      "#F59E0B",
  statusLowBg:    "#2A1F0A",
  statusHigh:     "#FC5A5A",
  statusHighBg:   "#2D1A1A",

  // Feedback
  error:        "#FC5A5A",
  errorBg:      "#2D1A1A",
  errorBorder:  "#6B2020",
  errorText:    "#FCA5A5",
  success:      "#10B981",
  successBg:    "#0A2A1F",
  warning:      "#F59E0B",
  warningBg:    "#2A1F0A",
  danger:       "#FC5A5A",
  dangerBg:     "#2D1A1A",

  // UI
  white:        "#1A2535",
  shadow:       "#000000",
  overlay:      "rgba(0,0,0,0.6)",
  tabBar:       "#1A2535",
  tabBorder:    "#2D4A63",

  // Dark-background context (stays same — already on dark bg)
  textMutedOnDark:   "rgba(255,255,255,0.7)",
  borderLightOnDark: "rgba(255,255,255,0.35)",
  inputBgOnDark:     "rgba(255,255,255,0.06)",
  errorOnDark:       "rgba(255,70,70,0.85)",
  textMutedLight:    "rgba(255,255,255,0.55)",
  textLabel:         "rgba(255,255,255,0.8)",
  linkText:          "rgba(255,255,255,0.9)",
  inputBorder:       "rgba(255,255,255,0.18)",
  errorBgOnDark:     "rgba(255,70,70,0.14)",
  errorBorderOnDark: "rgba(255,70,70,0.5)",
  errorTextOnDark:   "rgba(255,180,180,0.95)",

  // Gradient
  gradientHeader: ["#0D4F7C", "#1A6FA8"] as [string, string],
};

export type AppColors = typeof lightColors;

// Named export (used by most files)
export const Colors = lightColors;

// Default export for legacy components (Card.tsx, Input.tsx)
export default {
  ...lightColors,
  // Legacy aliases
  surface:    lightColors.bgCard,
  background: lightColors.bg,
  danger:     lightColors.danger,
};
