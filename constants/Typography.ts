import { PixelRatio, Platform, TextStyle } from "react-native";

const scaleFont = (size: number) => {
  const scale = PixelRatio.getFontScale ? PixelRatio.getFontScale() : 1;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

export const FontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  web: "system-ui",
  default: "System",
}) as string;

type Weight = TextStyle["fontWeight"];

export const Typography: Record<string, TextStyle> = {
  h1: { fontSize: scaleFont(32), lineHeight: scaleFont(40), fontWeight: "700" as Weight },
  h2: { fontSize: scaleFont(24), lineHeight: scaleFont(32), fontWeight: "700" as Weight },
  h3: { fontSize: scaleFont(20), lineHeight: scaleFont(28), fontWeight: "600" as Weight },

  body: { fontSize: scaleFont(16), lineHeight: scaleFont(24), fontWeight: "400" as Weight },
  bodyBold: { fontSize: scaleFont(16), lineHeight: scaleFont(24), fontWeight: "700" as Weight },

  caption: { fontSize: scaleFont(12), lineHeight: scaleFont(16), fontWeight: "400" as Weight },
  button: { fontSize: scaleFont(16), lineHeight: scaleFont(20), fontWeight: "600" as Weight },
};
