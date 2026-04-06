import { DevSettings, I18nManager, Platform } from "react-native";

export function isRtlLanguage(lng: string) {
  return lng === "ar" || lng === "he";
}

export async function applyRtlIfNeeded(lng: "en" | "ar" | "he") {
  const shouldRTL = isRtlLanguage(lng);

  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", shouldRTL ? "rtl" : "ltr");
      document.documentElement.setAttribute("lang", lng);
    }
    return;
  }

  const currentRTL = I18nManager.isRTL;

  if (currentRTL !== shouldRTL) {
    I18nManager.allowRTL(shouldRTL);
    I18nManager.forceRTL(shouldRTL);

    setTimeout(() => {
      try {
        DevSettings.reload();
      } catch {}
    }, 50);
  }
}
