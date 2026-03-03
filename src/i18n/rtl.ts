import { DevSettings, I18nManager, Platform } from "react-native";

export function isRtlLanguage(lng: string) {
  return lng === "ar" || lng === "he";
}

export async function applyRtlIfNeeded(lng: "en" | "ar" | "he") {
  if (Platform.OS === "web") return;

  const shouldRTL = isRtlLanguage(lng);
  const currentRTL = I18nManager.isRTL;

  if (currentRTL !== shouldRTL) {
    I18nManager.allowRTL(shouldRTL);
    I18nManager.forceRTL(shouldRTL);

    // Reload آمن على Expo Go أثناء التطوير
    setTimeout(() => {
      try {
        DevSettings.reload();
      } catch {}
    }, 50);
  }
}
