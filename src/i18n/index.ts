import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { applyRtlIfNeeded } from "./rtl";

const LANG_KEY = "app_lang";

const resources = {
  en: {
    translation: {
      // General
      language: "Language",
      chooseLanguage: "Choose language",
      footer: "Decision-support application",

      // App name
      appName1: "DiaConnect",
      appName2: "Family",

      // Auth
      signup: "Sign up",
      login: "Log in",
      loading: "Loading...",
      creating: "Creating...",
      createAccount: "Create account",

      // Fields
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm password",

      // Links
      dontHave: "Don’t have an account?",
      alreadyHave: "Already have an account?",

      // Errors
      errors: {
        emailRequired: "Email is required",
        emailInvalid: "Invalid email",
        passwordRequired: "Password is required",
        passwordMin: "Min 6 characters",
        firstNameRequired: "First name is required",
        lastNameRequired: "Last name is required",
        confirmRequired: "Confirm your password",
        passwordsMismatch: "Passwords do not match",
        loginFailed: "Login failed. Please try again.",
        signupFailed: "Sign up failed. Please try again.",
      },
    },
  },

  ar: {
    translation: {
      language: "اللغة",
      chooseLanguage: "اختر اللغة",
      footer: "تطبيق لدعم اتخاذ القرار",

      appName1: "DiaConnect",
      appName2: "Family",

      signup: "إنشاء حساب",
      login: "تسجيل الدخول",
      loading: "جاري التحميل...",
      creating: "جاري الإنشاء...",
      createAccount: "إنشاء حساب",

      firstName: "الاسم",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",

      dontHave: "ليس لديك حساب؟",
      alreadyHave: "لديك حساب؟",

      errors: {
        emailRequired: "البريد الإلكتروني مطلوب",
        emailInvalid: "بريد إلكتروني غير صالح",
        passwordRequired: "كلمة المرور مطلوبة",
        passwordMin: "الحد الأدنى 6 أحرف",
        firstNameRequired: "الاسم مطلوب",
        lastNameRequired: "اسم العائلة مطلوب",
        confirmRequired: "يرجى تأكيد كلمة المرور",
        passwordsMismatch: "كلمتا المرور غير متطابقتين",
        loginFailed: "فشل تسجيل الدخول. حاول مرة أخرى.",
        signupFailed: "فشل إنشاء الحساب. حاول مرة أخرى.",
      },
    },
  },

  he: {
    translation: {
      language: "שפה",
      chooseLanguage: "בחר שפה",
      footer: "אפליקציה לתמיכה בקבלת החלטות",

      appName1: "DiaConnect",
      appName2: "Family",

      signup: "הרשמה",
      login: "התחברות",
      loading: "טוען...",
      creating: "יוצר...",
      createAccount: "צור חשבון",

      firstName: "שם פרטי",
      lastName: "שם משפחה",
      email: "אימייל",
      password: "סיסמה",
      confirmPassword: "אימות סיסמה",

      dontHave: "אין לך חשבון?",
      alreadyHave: "כבר יש לך חשבון?",

      errors: {
        emailRequired: "נדרש אימייל",
        emailInvalid: "אימייל לא תקין",
        passwordRequired: "נדרשת סיסמה",
        passwordMin: "מינימום 6 תווים",
        firstNameRequired: "נדרש שם פרטי",
        lastNameRequired: "נדרש שם משפחה",
        confirmRequired: "נא לאשר סיסמה",
        passwordsMismatch: "הסיסמאות אינן תואמות",
        loginFailed: "ההתחברות נכשלה. נסה שוב.",
        signupFailed: "ההרשמה נכשלה. נסה שוב.",
      },
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