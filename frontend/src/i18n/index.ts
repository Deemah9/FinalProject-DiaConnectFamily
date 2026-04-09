import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { applyRtlIfNeeded } from "./rtl";

const LANG_KEY = "app_lang";

const resources = {
  en: {
    translation: {
      // App name
      appName1: "DiaConnect",
      appName2: "Family",
      diaConnect: "DiaConnect",
      family: "Family",

      // General
      language: "Language",
      chooseLanguage: "Choose language",
      footer: "Decision-support application",
      loading: "Loading...",
      saving: "Saving...",
      cancel: "Cancel",
      edit: "Edit",
      close: "Close",
      saveChanges: "Save Changes",
      optional: "Optional - leave empty for now",
      leaveEmptyTime: "Leave empty to use the current time.",
      notes: "Notes",
      optionalNotes: "Optional notes",
      time: "Time",
      am: "AM",
      pm: "PM",
      mgdL: "mg/dL",
      status: "Status:",
      low: "Low",
      high: "High",
      normal: "Normal",
      average: "Average",
      min: "Min",
      max: "Max",
      add: "Add",
      history: "History",
      user: "User",
      patient: "Patient",
      phone: "Phone",
      role: "Role",
      minUnit: "min",
      hoursUnit: "hours",
      noNotes: "No notes",

      // Auth
      signup: "Sign up",
      login: "Log in",
      creating: "Creating...",
      createAccount: "Create account",
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm password",
      dontHave: "Don't have an account?",
      alreadyHave: "Already have an account?",

      // Menu / Drawer
      menu: "Menu",
      profileNavigation: "PROFILE NAVIGATION",
      openProfile: "Open Profile",
      editProfile: "Edit Profile",
      medicalInfo: "Medical Info",
      lifestyleHabits: "Lifestyle Habits",
      glucoseNavigation: "GLUCOSE NAVIGATION",
      glucoseHistory: "Glucose History",
      addGlucose: "Add Glucose",
      dailyLogsSection: "DAILY LOGS",
      dailyLog: "Daily Log",
      addMeal: "Add Meal",
      addActivity: "Add Activity",
      addSleep: "Add Sleep",
      languageSection: "LANGUAGE",
      logout: "Logout",

      // Onboarding
      onboardingTitle: "Let's set up your profile",
      onboardingSubtitle: "This helps us personalize your monitoring and filter out expected fluctuations.",
      onboardingDietLabel: "Dietary Pattern",
      onboardingDietBalanced: "Balanced",
      onboardingDietLowCarb: "Low Carb",
      onboardingDietVegetarian: "Vegetarian",
      onboardingDietOther: "Other",
      onboardingSleepLabel: "Average Sleep Hours per Night",
      onboardingActivityLabel: "Physical Activity Level",
      onboardingComplete: "Complete Setup",
      onboardingSkip: "Skip for now",

      // Home screen
      welcomeBack: "Welcome Back",
      homeSubtitle: "Manage your diabetes care with ease",
      quickActions: "QUICK ACTIONS",
      quickCheck: "Quick Check",
      fastGlucoseReading: "Fast glucose reading",
      newEntry: "New Entry",
      addMeasurement: "Add measurement",
      mealsActivitySleep: "Meals • Activity • Sleep",
      alerts: "ALERTS",
      medicationReminder: "Medication Reminder",
      eveningDose: "Time for your evening dose",
      todaysOverview: "TODAY'S OVERVIEW",
      bloodGlucose: "Blood Glucose",
      trackReadings: "Track your readings and stay healthy",
      addReading: "Add Reading",
      recentAlerts: "RECENT ALERTS",
      reminder: "Reminder",
      measureAfterLunch: "Measure glucose after lunch",
      twoHoursAgo: "2 hours ago",
      tip: "Tip",
      drinkWater: "Drink water and stay active",
      fiveHoursAgo: "5 hours ago",

      // Profile
      myProfile: "My Profile",
      loadingProfile: "Loading profile...",
      manageInfo: "Manage your information",
      basicInfo: "Basic Info",
      diagnosisYear: "Diagnosis Year",
      medications: "Medications",
      lifestyle: "Lifestyle",
      activityLevel: "Activity Level",
      sleepHours: "Sleep Hours",

      // Edit Profile
      updateInfo: "Update your information",

      // Medical Info
      medicalInformation: "Medical Information",
      manageMedical: "Manage your medical details",
      medicalDetails: "Medical Details",
      loadingMedical: "Loading medical info...",
      medicationsPlaceholder: "Insulin, Metformin",
      diagnosisYearPlaceholder: "2020",

      // Lifestyle
      manageDailyHabits: "Manage your daily habits",
      lifestyleDetails: "Lifestyle Details",
      loadingLifestyle: "Loading lifestyle info...",
      activityLow: "low",
      activityModerate: "moderate",
      activityHigh: "high",

      // Daily Log
      trackDailyLog: "Track your meals, activity, and sleep for today",
      quickAdd: "QUICK ADD",
      logFoodCarbs: "Log food and carbs",
      trackMovement: "Track movement",
      trackSleep: "Track sleep",
      todaysSummary: "TODAY'S SUMMARY",
      meals: "Meals",
      carbs: "Carbs",
      activity: "Activity",
      sleepEntries: "Sleep Entries",
      mealLogs: "Meal Logs",
      loadingMeals: "Loading meals...",
      noMealsToday: "No meals logged today",
      addFirstMeal: "Add your first meal",
      meal: "Meal",
      activityLogs: "Activity Logs",
      loadingActivities: "Loading activities...",
      noActivitiesToday: "No activities logged today",
      addFirstActivity: "Add your first activity",
      sleep: "Sleep",
      sleepLogs: "Sleep Logs",
      loadingSleep: "Loading sleep logs...",
      noSleepToday: "No sleep logged today",
      addSleepEntry: "Add your sleep entry",
      carbsUnit: "g",
      activitiesSection: "ACTIVITIES",
      sleepSection: "SLEEP",
      mealsSection: "MEALS",

      // Glucose History
      trackReadingsTime: "Track your glucose readings over time",
      glucoseTrend: "Glucose Trend",
      loadingChart: "Loading chart...",
      noChartData: "No chart data yet",
      addReadingsForTrend: "Add glucose readings to view the trend",
      readingHistory: "Reading History",
      loadingReadings: "Loading glucose readings...",
      noReadingsYet: "No readings yet",
      trend: "Glucose Trend",
      addFirstReading: "Add your first glucose reading",

      // Add Glucose
      addGlucoseDesc: "Add a new glucose reading manually",
      glucoseValue: "Glucose Value (mg/dL)",
      glucosePlaceholder: "e.g. 120",
      measuredAt: "Measured At",
      leaveEmptyCurrentTime: "You can leave this empty and the current time will be used.",
      saveReading: "Save Reading",
      invalidGlucose: "Please enter a valid glucose value",
      glucoseRange: "Glucose value must be between 40 and 600 mg/dL",
      invalidDate: "Invalid date format. Use YYYY-MM-DD or leave empty.",

      // Add Meal
      logMealCarbs: "Log your meal and carbs",
      foods: "Foods",
      foodsPlaceholder: "e.g. rice, chicken, salad",
      carbsG: "Carbs (g)",
      carbsPlaceholder: "e.g. 45",
      saveMeal: "Save Meal",
      enterMealFoods: "Please enter meal foods",
      invalidCarbs: "Please enter a valid carbs value",

      // Add Activity
      trackActivity: "Track your physical activity",
      activityType: "Activity Type",
      activityTypePlaceholder: "e.g. walking, gym, running",
      durationMinutes: "Duration (minutes)",
      durationPlaceholder: "e.g. 30",
      saveActivity: "Save Activity",
      enterActivityType: "Please enter activity type",
      invalidDuration: "Please enter a valid duration",

      // Add Sleep
      trackSleepHours: "Track your sleep hours",
      sleepHoursPlaceholder: "e.g. 7",
      saveSleep: "Save Sleep",
      invalidSleepHours: "Please enter valid sleep hours",

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
      // App name
      appName1: "DiaConnect",
      appName2: "Family",
      diaConnect: "DiaConnect",
      family: "Family",

      // General
      language: "اللغة",
      chooseLanguage: "اختر اللغة",
      footer: "تطبيق لدعم اتخاذ القرار",
      loading: "جاري التحميل...",
      saving: "جاري الحفظ...",
      cancel: "إلغاء",
      edit: "تعديل",
      close: "إغلاق",
      saveChanges: "حفظ التغييرات",
      optional: "اختياري - يمكن تركه فارغاً",
      leaveEmptyTime: "اتركه فارغاً لاستخدام الوقت الحالي.",
      notes: "ملاحظات",
      optionalNotes: "ملاحظات اختيارية",
      time: "الوقت",
      am: "ص",
      pm: "م",
      mgdL: "ملغ/ديسيلتر",
      status: "الحالة:",
      low: "منخفض",
      high: "مرتفع",
      normal: "طبيعي",
      average: "المتوسط",
      min: "الأدنى",
      max: "الأعلى",
      add: "إضافة",
      history: "السجل",
      user: "مستخدم",
      patient: "مريض",
      phone: "الهاتف",
      role: "الدور",
      minUnit: "دقيقة",
      hoursUnit: "ساعات",
      noNotes: "لا توجد ملاحظات",

      // Auth
      signup: "إنشاء حساب",
      login: "تسجيل الدخول",
      creating: "جاري الإنشاء...",
      createAccount: "إنشاء حساب",
      firstName: "الاسم",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",
      dontHave: "ليس لديك حساب؟",
      alreadyHave: "لديك حساب؟",

      // Menu / Drawer
      menu: "القائمة",
      profileNavigation: "الملف الشخصي",
      openProfile: "عرض الملف الشخصي",
      editProfile: "تعديل الملف الشخصي",
      medicalInfo: "المعلومات الطبية",
      lifestyleHabits: "العادات اليومية",
      glucoseNavigation: "سكر الدم",
      glucoseHistory: "سجل السكر",
      addGlucose: "إضافة قراءة سكر",
      dailyLogsSection: "السجلات اليومية",
      dailyLog: "السجل اليومي",
      addMeal: "إضافة وجبة",
      addActivity: "إضافة نشاط",
      addSleep: "إضافة نوم",
      languageSection: "اللغة",
      logout: "تسجيل الخروج",

      // Onboarding
      onboardingTitle: "لنقم بإعداد ملفك الشخصي",
      onboardingSubtitle: "يساعدنا ذلك في تخصيص المراقبة وتصفية التقلبات المتوقعة.",
      onboardingDietLabel: "النمط الغذائي",
      onboardingDietBalanced: "متوازن",
      onboardingDietLowCarb: "قليل الكربوهيدرات",
      onboardingDietVegetarian: "نباتي",
      onboardingDietOther: "أخرى",
      onboardingSleepLabel: "متوسط ساعات النوم في الليلة",
      onboardingActivityLabel: "مستوى النشاط البدني",
      onboardingComplete: "إكمال الإعداد",
      onboardingSkip: "تخطي الآن",

      // Home screen
      welcomeBack: "مرحباً بعودتك",
      homeSubtitle: "أدر رعاية السكري بسهولة",
      quickActions: "إجراءات سريعة",
      quickCheck: "فحص سريع",
      fastGlucoseReading: "قراءة سكر سريعة",
      newEntry: "إدخال جديد",
      addMeasurement: "إضافة قياس",
      mealsActivitySleep: "وجبات • نشاط • نوم",
      alerts: "التنبيهات",
      medicationReminder: "تذكير بالدواء",
      eveningDose: "حان وقت جرعتك المسائية",
      todaysOverview: "ملخص اليوم",
      bloodGlucose: "سكر الدم",
      trackReadings: "تتبع قراءاتك وابقَ بصحة جيدة",
      addReading: "إضافة قراءة",
      recentAlerts: "التنبيهات الأخيرة",
      reminder: "تذكير",
      measureAfterLunch: "قِس السكر بعد الغداء",
      twoHoursAgo: "منذ ساعتين",
      tip: "نصيحة",
      drinkWater: "اشرب الماء وابقَ نشيطاً",
      fiveHoursAgo: "منذ 5 ساعات",

      // Profile
      myProfile: "ملفي الشخصي",
      loadingProfile: "جاري تحميل الملف الشخصي...",
      manageInfo: "إدارة معلوماتك",
      basicInfo: "المعلومات الأساسية",
      diagnosisYear: "سنة التشخيص",
      medications: "الأدوية",
      lifestyle: "نمط الحياة",
      activityLevel: "مستوى النشاط",
      sleepHours: "ساعات النوم",

      // Edit Profile
      updateInfo: "تحديث معلوماتك",

      // Medical Info
      medicalInformation: "المعلومات الطبية",
      manageMedical: "إدارة تفاصيلك الطبية",
      medicalDetails: "التفاصيل الطبية",
      loadingMedical: "جاري تحميل المعلومات الطبية...",
      medicationsPlaceholder: "أنسولين، ميتفورمين",
      diagnosisYearPlaceholder: "2020",

      // Lifestyle
      manageDailyHabits: "إدارة عاداتك اليومية",
      lifestyleDetails: "تفاصيل نمط الحياة",
      loadingLifestyle: "جاري تحميل معلومات نمط الحياة...",
      activityLow: "منخفض",
      activityModerate: "معتدل",
      activityHigh: "مرتفع",

      // Daily Log
      trackDailyLog: "تتبع وجباتك ونشاطك ونومك لهذا اليوم",
      quickAdd: "إضافة سريعة",
      logFoodCarbs: "تسجيل الطعام والكربوهيدرات",
      trackMovement: "تتبع الحركة",
      trackSleep: "تتبع النوم",
      todaysSummary: "ملخص اليوم",
      meals: "الوجبات",
      carbs: "الكربوهيدرات",
      activity: "النشاط",
      sleepEntries: "سجلات النوم",
      mealLogs: "سجلات الوجبات",
      loadingMeals: "جاري تحميل الوجبات...",
      noMealsToday: "لا توجد وجبات مسجلة اليوم",
      addFirstMeal: "أضف وجبتك الأولى",
      meal: "وجبة",
      activityLogs: "سجلات النشاط",
      loadingActivities: "جاري تحميل الأنشطة...",
      noActivitiesToday: "لا توجد أنشطة مسجلة اليوم",
      addFirstActivity: "أضف نشاطك الأول",
      sleep: "النوم",
      sleepLogs: "سجلات النوم",
      loadingSleep: "جاري تحميل سجلات النوم...",
      noSleepToday: "لم يُسجل نوم اليوم",
      addSleepEntry: "أضف سجل نومك",
      carbsUnit: "غ",
      activitiesSection: "الأنشطة",
      sleepSection: "النوم",
      mealsSection: "الوجبات",

      // Glucose History
      trackReadingsTime: "تتبع قراءات السكر عبر الزمن",
      glucoseTrend: "مؤشر السكر",
      loadingChart: "جاري تحميل الرسم البياني...",
      noChartData: "لا توجد بيانات بعد",
      addReadingsForTrend: "أضف قراءات سكر لعرض المؤشر",
      readingHistory: "سجل القراءات",
      loadingReadings: "جاري تحميل قراءات السكر...",
      noReadingsYet: "لا توجد قراءات بعد",
      trend: "مؤشر الجلوكوز",
      addFirstReading: "أضف قراءة السكر الأولى",

      // Add Glucose
      addGlucoseDesc: "إضافة قراءة سكر يدوياً",
      glucoseValue: "قيمة السكر (ملغ/ديسيلتر)",
      glucosePlaceholder: "مثال: 120",
      measuredAt: "وقت القياس",
      leaveEmptyCurrentTime: "يمكنك تركه فارغاً وسيُستخدم الوقت الحالي.",
      saveReading: "حفظ القراءة",
      invalidGlucose: "يرجى إدخال قيمة سكر صحيحة",
      glucoseRange: "يجب أن تكون قيمة السكر بين 40 و 600 ملغ/ديسيلتر",
      invalidDate: "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD أو اتركه فارغاً.",

      // Add Meal
      logMealCarbs: "تسجيل وجبتك وكربوهيدراتها",
      foods: "الأطعمة",
      foodsPlaceholder: "مثال: أرز، دجاج، سلطة",
      carbsG: "الكربوهيدرات (غ)",
      carbsPlaceholder: "مثال: 45",
      saveMeal: "حفظ الوجبة",
      enterMealFoods: "يرجى إدخال أطعمة الوجبة",
      invalidCarbs: "يرجى إدخال قيمة كربوهيدرات صحيحة",

      // Add Activity
      trackActivity: "تتبع نشاطك البدني",
      activityType: "نوع النشاط",
      activityTypePlaceholder: "مثال: مشي، صالة، جري",
      durationMinutes: "المدة (بالدقائق)",
      durationPlaceholder: "مثال: 30",
      saveActivity: "حفظ النشاط",
      enterActivityType: "يرجى إدخال نوع النشاط",
      invalidDuration: "يرجى إدخال مدة صحيحة",

      // Add Sleep
      trackSleepHours: "تتبع ساعات نومك",
      sleepHoursPlaceholder: "مثال: 7",
      saveSleep: "حفظ النوم",
      invalidSleepHours: "يرجى إدخال ساعات نوم صحيحة",

      // Errors
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
      // App name
      appName1: "DiaConnect",
      appName2: "Family",
      diaConnect: "DiaConnect",
      family: "Family",

      // General
      language: "שפה",
      chooseLanguage: "בחר שפה",
      footer: "אפליקציה לתמיכה בקבלת החלטות",
      loading: "טוען...",
      saving: "שומר...",
      cancel: "ביטול",
      edit: "עריכה",
      close: "סגור",
      saveChanges: "שמור שינויים",
      optional: "אופציונלי - ניתן להשאיר ריק",
      leaveEmptyTime: "השאר ריק לשימוש בשעה הנוכחית.",
      notes: "הערות",
      optionalNotes: "הערות אופציונליות",
      time: "זמן",
      am: "לפנה\"צ",
      pm: "אחה\"צ",
      mgdL: "מ\"ג/ד\"ל",
      status: "סטטוס:",
      low: "נמוך",
      high: "גבוה",
      normal: "תקין",
      average: "ממוצע",
      min: "מינימום",
      max: "מקסימום",
      add: "הוסף",
      history: "היסטוריה",
      user: "משתמש",
      patient: "מטופל",
      phone: "טלפון",
      role: "תפקיד",
      minUnit: "דק'",
      hoursUnit: "שעות",
      noNotes: "אין הערות",

      // Auth
      signup: "הרשמה",
      login: "התחברות",
      creating: "יוצר...",
      createAccount: "צור חשבון",
      firstName: "שם פרטי",
      lastName: "שם משפחה",
      email: "אימייל",
      password: "סיסמה",
      confirmPassword: "אימות סיסמה",
      dontHave: "אין לך חשבון?",
      alreadyHave: "כבר יש לך חשבון?",

      // Menu / Drawer
      menu: "תפריט",
      profileNavigation: "פרופיל",
      openProfile: "פתח פרופיל",
      editProfile: "ערוך פרופיל",
      medicalInfo: "מידע רפואי",
      lifestyleHabits: "הרגלי חיים",
      glucoseNavigation: "גלוקוז",
      glucoseHistory: "היסטוריית גלוקוז",
      addGlucose: "הוסף גלוקוז",
      dailyLogsSection: "יומנים יומיים",
      dailyLog: "יומן יומי",
      addMeal: "הוסף ארוחה",
      addActivity: "הוסף פעילות",
      addSleep: "הוסף שינה",
      languageSection: "שפה",
      logout: "התנתק",

      // Onboarding
      onboardingTitle: "בואו נגדיר את הפרופיל שלך",
      onboardingSubtitle: "זה עוזר לנו להתאים את המעקב ולסנן תנודות צפויות.",
      onboardingDietLabel: "דפוס תזונה",
      onboardingDietBalanced: "מאוזן",
      onboardingDietLowCarb: "דל פחמימות",
      onboardingDietVegetarian: "צמחוני",
      onboardingDietOther: "אחר",
      onboardingSleepLabel: "ממוצע שעות שינה בלילה",
      onboardingActivityLabel: "רמת פעילות גופנית",
      onboardingComplete: "השלם הגדרה",
      onboardingSkip: "דלג כעת",

      // Home screen
      welcomeBack: "ברוך שובך",
      homeSubtitle: "נהל את טיפול הסוכרת שלך בקלות",
      quickActions: "פעולות מהירות",
      quickCheck: "בדיקה מהירה",
      fastGlucoseReading: "קריאת גלוקוז מהירה",
      newEntry: "רשומה חדשה",
      addMeasurement: "הוסף מדידה",
      mealsActivitySleep: "ארוחות • פעילות • שינה",
      alerts: "התראות",
      medicationReminder: "תזכורת תרופות",
      eveningDose: "הגיע הזמן לגמילה הערב שלך",
      todaysOverview: "סקירת היום",
      bloodGlucose: "גלוקוז בדם",
      trackReadings: "עקוב אחר הקריאות שלך והישאר בריא",
      addReading: "הוסף קריאה",
      recentAlerts: "התראות אחרונות",
      reminder: "תזכורת",
      measureAfterLunch: "מדוד גלוקוז אחרי הצהריים",
      twoHoursAgo: "לפני שעתיים",
      tip: "טיפ",
      drinkWater: "שתה מים והישאר פעיל",
      fiveHoursAgo: "לפני 5 שעות",

      // Profile
      myProfile: "הפרופיל שלי",
      loadingProfile: "טוען פרופיל...",
      manageInfo: "נהל את המידע שלך",
      basicInfo: "מידע בסיסי",
      diagnosisYear: "שנת אבחון",
      medications: "תרופות",
      lifestyle: "אורח חיים",
      activityLevel: "רמת פעילות",
      sleepHours: "שעות שינה",

      // Edit Profile
      updateInfo: "עדכן את המידע שלך",

      // Medical Info
      medicalInformation: "מידע רפואי",
      manageMedical: "נהל את הפרטים הרפואיים שלך",
      medicalDetails: "פרטים רפואיים",
      loadingMedical: "טוען מידע רפואי...",
      medicationsPlaceholder: "אינסולין, מטפורמין",
      diagnosisYearPlaceholder: "2020",

      // Lifestyle
      manageDailyHabits: "נהל את ההרגלים היומיים שלך",
      lifestyleDetails: "פרטי אורח חיים",
      loadingLifestyle: "טוען מידע אורח חיים...",
      activityLow: "נמוך",
      activityModerate: "בינוני",
      activityHigh: "גבוה",

      // Daily Log
      trackDailyLog: "עקוב אחר ארוחותיך, פעילותך ושינתך להיום",
      quickAdd: "הוספה מהירה",
      logFoodCarbs: "רשום אוכל ופחמימות",
      trackMovement: "עקוב אחר תנועה",
      trackSleep: "עקוב אחר שינה",
      todaysSummary: "סיכום היום",
      meals: "ארוחות",
      carbs: "פחמימות",
      activity: "פעילות",
      sleepEntries: "רשומות שינה",
      mealLogs: "יומן ארוחות",
      loadingMeals: "טוען ארוחות...",
      noMealsToday: "לא נרשמו ארוחות היום",
      addFirstMeal: "הוסף את הארוחה הראשונה שלך",
      meal: "ארוחה",
      activityLogs: "יומן פעילות",
      loadingActivities: "טוען פעילויות...",
      noActivitiesToday: "לא נרשמו פעילויות היום",
      addFirstActivity: "הוסף את הפעילות הראשונה שלך",
      sleep: "שינה",
      sleepLogs: "יומן שינה",
      loadingSleep: "טוען רשומות שינה...",
      noSleepToday: "לא נרשמה שינה היום",
      addSleepEntry: "הוסף רשומת שינה",
      carbsUnit: "גר'",
      activitiesSection: "פעילויות",
      sleepSection: "שינה",
      mealsSection: "ארוחות",

      // Glucose History
      trackReadingsTime: "עקוב אחר קריאות הגלוקוז לאורך זמן",
      glucoseTrend: "מגמת גלוקוז",
      loadingChart: "טוען גרף...",
      noChartData: "אין נתוני גרף עדיין",
      addReadingsForTrend: "הוסף קריאות גלוקוז לצפייה במגמה",
      readingHistory: "היסטוריית קריאות",
      loadingReadings: "טוען קריאות גלוקוז...",
      noReadingsYet: "אין קריאות עדיין",
      trend: "מגמת גלוקוז",
      addFirstReading: "הוסף את קריאת הגלוקוז הראשונה שלך",

      // Add Glucose
      addGlucoseDesc: "הוסף קריאת גלוקוז חדשה ידנית",
      glucoseValue: "ערך גלוקוז (מ\"ג/ד\"ל)",
      glucosePlaceholder: "לדוגמה: 120",
      measuredAt: "נמדד ב",
      leaveEmptyCurrentTime: "ניתן להשאיר ריק והשעה הנוכחית תשמש.",
      saveReading: "שמור קריאה",
      invalidGlucose: "אנא הזן ערך גלוקוז תקין",
      glucoseRange: "ערך הגלוקוז חייב להיות בין 40 ל-600 מ\"ג/ד\"ל",
      invalidDate: "פורמט תאריך לא חוקי. השתמש ב-YYYY-MM-DD או השאר ריק.",

      // Add Meal
      logMealCarbs: "רשום את הארוחה והפחמימות שלך",
      foods: "מזונות",
      foodsPlaceholder: "לדוגמה: אורז, עוף, סלט",
      carbsG: "פחמימות (גר')",
      carbsPlaceholder: "לדוגמה: 45",
      saveMeal: "שמור ארוחה",
      enterMealFoods: "אנא הזן מזונות לארוחה",
      invalidCarbs: "אנא הזן ערך פחמימות תקין",

      // Add Activity
      trackActivity: "עקוב אחר הפעילות הגופנית שלך",
      activityType: "סוג פעילות",
      activityTypePlaceholder: "לדוגמה: הליכה, חדר כושר, ריצה",
      durationMinutes: "משך (בדקות)",
      durationPlaceholder: "לדוגמה: 30",
      saveActivity: "שמור פעילות",
      enterActivityType: "אנא הזן סוג פעילות",
      invalidDuration: "אנא הזן משך תקין",

      // Add Sleep
      trackSleepHours: "עקוב אחר שעות השינה שלך",
      sleepHoursPlaceholder: "לדוגמה: 7",
      saveSleep: "שמור שינה",
      invalidSleepHours: "אנא הזן שעות שינה תקינות",

      // Errors
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

export async function setAppLanguage(lng: "en" | "ar" | "he", syncToServer?: () => Promise<void>) {
  if (i18n.language === lng) return;

  await AsyncStorage.setItem(LANG_KEY, lng);
  await i18n.changeLanguage(lng);
  await applyRtlIfNeeded(lng);

  if (syncToServer) {
    try { await syncToServer(); } catch { /* non-critical */ }
  }
}

export default i18n;
