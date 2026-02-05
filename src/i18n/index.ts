import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { applyRtlIfNeeded } from "./rtl";

const LANG_KEY = "app_lang";

const resources = {
  en: {
    translation: {
      language: "Language",
      chooseLanguage: "Choose language",
      signup: "Sign up",
      login: "Log in",
      footer: "Decision-support application",
      appName1: "DiaConnect",
      appName2: "Family",
    },
  },
  ar: {
    translation: {
      language: "اللغة",
      chooseLanguage: "اختر اللغة",
      signup: "إنشاء حساب",
      login: "تسجيل الدخول",
      footer: "تطبيق لدعم اتخاذ القرار",
      appName1: "DiaConnect",
      appName2: "Family",
    },
  },
  he: {
    translation: {
      language: "שפה",
      chooseLanguage: "בחר שפה",
      signup: "הרשמה",
      login: "התחברות",
      footer: "אפליקציה לתמיכה בקבלת החלטות",
      appName1: "DiaConnect",
      appName2: "Family",
    },
  },
};

async function getInitialLanguage(): Promise<"en" | "ar" | "he"> {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "ar" || saved === "he") return saved;

  const device = Localization.getLocales()?.[0]?.languageCode ?? "en";
  if (device === "ar" || device === "he" || device === "en") return device;

  return "en";
}

export async function setupI18n() {
  const lng = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  // ✅ عند تشغيل التطبيق: طبّق RTL لو لازم
  await applyRtlIfNeeded(lng);

  return lng;
}

export async function setAppLanguage(lng: "en" | "ar" | "he") {
  if (i18n.language === lng) return;

  await AsyncStorage.setItem(LANG_KEY, lng);
  await i18n.changeLanguage(lng);
  await applyRtlIfNeeded(lng);
}
export default i18n;
