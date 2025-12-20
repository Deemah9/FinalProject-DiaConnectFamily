import { PixelRatio, Platform } from "react-native";

/**
 * Scale font size based on user accessibility settings
 */
const scaleFont = (size) => {
  const fontScale = PixelRatio.getFontScale
    ? PixelRatio.getFontScale()
    : 1;
  return Math.round(PixelRatio.roundToNearestPixel(size * fontScale));
};

/**
 * Global font family (safe for mobile + web)
 */
export const FontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  web: "system-ui",
});

/**
 * Typography system
 */
export const Typography = {
  /* ========================
   * HEADERS
   * ======================== */
  h1: {
    fontSize: scaleFont(32),
    lineHeight: scaleFont(40),
    fontWeight: "700",
  },
  h2: {
    fontSize: scaleFont(24),
    lineHeight: scaleFont(32),
    fontWeight: "700",
  },
  h3: {
    fontSize: scaleFont(20),
    lineHeight: scaleFont(28),
    fontWeight: "600",
  },

  /* ========================
   * BODY TEXT
   * ======================== */
  body: {
    fontSize: scaleFont(16),
    lineHeight: scaleFont(24),
    fontWeight: "400",
  },
  bodyBold: {
    fontSize: scaleFont(16),
    lineHeight: scaleFont(24),
    fontWeight: "700",
  },

  /* ========================
   * SMALL TEXT
   * ======================== */
  caption: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontWeight: "400",
  },
  captionBold: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontWeight: "600",
  },

  /* ========================
   * UI LABELS
   * ======================== */
  button: {
    fontSize: scaleFont(16),
    lineHeight: scaleFont(20),
    fontWeight: "600",
  },
  overline: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
};
