import { PixelRatio, Platform } from "react-native";

// Scale بسيط ومحافظ (بدون مبالغة)
const scale = (size) => {
  const newSize = size * (PixelRatio.getFontScale() || 1);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

const fontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  web: "system-ui",
  default: "System",
});

export const Typography = {
  fontFamily,

  h1: {
    fontSize: scale(30),
    lineHeight: scale(38),
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  h2: {
    fontSize: scale(24),
    lineHeight: scale(32),
    fontWeight: "700",
    letterSpacing: 0.15,
  },

  h3: {
    fontSize: scale(20),
    lineHeight: scale(28),
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  subtitle: {
    fontSize: scale(18),
    lineHeight: scale(26),
    fontWeight: "600",
  },

  body: {
    fontSize: scale(16),
    lineHeight: scale(24),
    fontWeight: "400",
  },

  bodyBold: {
    fontSize: scale(16),
    lineHeight: scale(24),
    fontWeight: "600",
  },

  caption: {
    fontSize: scale(13),
    lineHeight: scale(18),
    fontWeight: "400",
  },

  overline: {
    fontSize: scale(12),
    lineHeight: scale(16),
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
};
