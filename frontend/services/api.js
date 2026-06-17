import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web" ? "http://localhost:8000" : "http://10.0.2.2:8000");

// ==========================================
// Helper — get token from storage
// ==========================================

const getToken = async () => {
  return await AsyncStorage.getItem("token");
};

// ==========================================
// Helper — base request
// ==========================================

const REQUEST_TIMEOUT_MS = 30000;

const request = async (method, endpoint, body = null) => {
  const token = await getToken();

  const headers = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const config = {
    method,
    headers,
    signal: controller.signal,
    ...(body && { body: JSON.stringify(body) }),
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    let detail = data && (data.detail || data.message);
    if (Array.isArray(detail)) {
      detail = detail.map((e) => e?.msg || JSON.stringify(e)).join(", ");
    } else if (detail && typeof detail !== "string") {
      detail = JSON.stringify(detail);
    }
    const msg = detail || raw || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
};

// ==========================================
// Auth APIs
// ==========================================

export const register = (userData) =>
  request("POST", "/auth/register", userData);

export const login = async (email, password) => {
  const data = await request("POST", "/auth/login", { email, password });
  const token = data?.accessToken;
  if (token) {
    await AsyncStorage.setItem("token", token);
  }
  await AsyncStorage.setItem("role", data.role);
  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("role");
};

export const deleteAccount = (password) => request("DELETE", "/auth/account", { password });

export const forgotPassword = (email) =>
  request("POST", "/auth/forgot-password", { email });

export const resetPassword = (token, new_password) =>
  request("POST", "/auth/reset-password", { token, new_password });

export const changePassword = (current_password, new_password, confirm_password) =>
  request("POST", "/auth/change-password", {
    current_password,
    new_password,
    confirm_password,
  });

// ==========================================
// User Profile APIs
// ==========================================

export const getProfile = () => request("GET", "/users/me");
export const getMe = () => request("GET", "/users/me");
export const updateProfile = (data) => request("PUT", "/users/me", data);


export const updateLifestyle = (data) =>
  request("PUT", "/users/me/lifestyle", data);

// ==========================================
// Glucose APIs
// ==========================================

export const addGlucose = (value, measuredAt) =>
  request("POST", "/glucose/", { value, measuredAt });

export const getGlucoseReadings = () => request("GET", "/glucose/?limit=500");

export const getLatestGlucose = () => request("GET", "/glucose/latest");

export const deleteGlucose = (id) => request("DELETE", `/glucose/${id}`);

export const getGlucoseStats = (days = 7) =>
  request("GET", `/glucose/stats?days=${days}`);

export const importGlucoseCSV = async (filePayload, fileName, mimeType) => {
  const token = await getToken();
  const formData = new FormData();
  // filePayload is either a web File object or a RN { uri, name, type } object
  if (filePayload instanceof File || filePayload instanceof Blob) {
    formData.append("file", filePayload, fileName || "glucose.csv");
  } else {
    formData.append("file", { uri: filePayload.uri, name: fileName || filePayload.name || "glucose.csv", type: mimeType || filePayload.type || "text/csv" });
  }

  const response = await fetch(`${BASE_URL}/glucose/import-csv`, {
    method: "POST",
    headers: {
      "bypass-tunnel-reminder": "true",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (!response.ok) {
    const msg = (data && (data.detail || data.message)) || raw || `HTTP ${response.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
};

export const getGlucosePrediction = (hours = 1, lang = "ar") =>
  request("GET", `/glucose/predict?hours=${hours}&lang=${lang}`);

export const getEstimatedA1C = () => request("GET", "/glucose/a1c");

export const getPatientPrediction = (patientId, hours = 1, lang = "ar") =>
  request("GET", `/glucose/predict/family?patient_id=${patientId}&hours=${hours}&lang=${lang}`);

// ==========================================
// Daily Logs APIs
// ==========================================

export const addMeal = (data) => request("POST", "/daily-logs/meals", data);

export const addActivity = (data) =>
  request("POST", "/daily-logs/activities", data);

export const addSleep = (data) => request("POST", "/daily-logs/sleep", data);

export const getTodayLogs = () => request("GET", "/daily-logs/today");

export const getLogsByDate = (date) => request("GET", `/daily-logs/by-date?date=${date}`);

export const getDailyLogsSummary = (days = 7) =>
  request("GET", `/daily-logs/summary?days=${days}`);

export const deleteMeal = (id) =>
  request("DELETE", `/daily-logs/meals/${id}`);

export const deleteActivity = (id) =>
  request("DELETE", `/daily-logs/activities/${id}`);

export const deleteSleep = (id) =>
  request("DELETE", `/daily-logs/sleep/${id}`);

export const getAlerts = (limit = 20) =>
  request("GET", `/alerts/?limit=${limit}`);

export const getPatientAlerts = (patientId, limit = 20) =>
  request("GET", `/alerts/patient/${patientId}?limit=${limit}`);

export const markAlertRead = (patientId, alertId) =>
  request("PATCH", `/alerts/patient/${patientId}/${alertId}/read`);

export const markAllAlertsRead = (patientId) =>
  request("PATCH", `/alerts/patient/${patientId}/read-all`);

export const markAllMyAlertsRead = () =>
  request("PATCH", `/alerts/read-all`);

export const markMyAlertRead = (alertId) =>
  request("PATCH", `/alerts/${alertId}/read`);

// ==========================================
// Family Connection APIs
// ==========================================

export const viewWithCode = (code) =>
  request("POST", "/family/view", { code });

export const generateFamilyCode = () =>
  request("POST", "/family/generate-code");

export const joinWithCode = (code) =>
  request("POST", "/family/join", { code });

export const getLinkedPatients = () => request("GET", "/family/patients");

export const getPatientGlucose = (patientId, limit = 50) =>
  request("GET", `/family/patient/${patientId}/glucose?limit=${limit}`);

export const getPatientDailyLogs = (patientId, days = 7) =>
  request("GET", `/family/patient/${patientId}/daily-logs?days=${days}`);

export const registerPushToken = (token) =>
  request("PUT", "/users/me/push-token", { token });

export const getFamilyMembers = () =>
  request("GET", "/family/my-members");

export const removeFamilyMember = (linkId) =>
  request("DELETE", `/family/members/${linkId}`);

export const removePatientLink = (linkId) =>
  request("DELETE", `/family/patients/${linkId}`);

export const getNotifications = () => request("GET", "/notifications/");
export const getUnreadCount = () => request("GET", "/notifications/unread-count");
export const markAllNotificationsRead = () => request("PATCH", "/notifications/read-all");
export const markNotificationRead = (id) => request("PATCH", `/notifications/${id}/read`);
export const deleteNotification = (id) => request("DELETE", `/notifications/${id}`);
export const deleteAllNotifications = () => request("DELETE", "/notifications/clear-all");
export const logReminderFired = (title, body) =>
  request("POST", "/notifications/reminder-fired", { title, body });

// ==========================================
// Health Info + Insulin APIs
// ==========================================

export const getHealthInfo = () => request("GET", "/health/info");
export const updateHealthInfo = (data) => request("PUT", "/health/info", data);
export const addInsulinDose = (data) => request("POST", "/health/insulin", data);
export const getInsulinToday = () => request("GET", "/health/insulin/today");

// ==========================================
// Emergency Contacts APIs
// ==========================================

export const getEmergencyContacts = () =>
  request("GET", "/users/me/emergency-contacts");

export const saveEmergencyContacts = (contacts) =>
  request("PUT", "/users/me/emergency-contacts", { contacts });

// ==========================================
// Reminder Settings APIs
// ==========================================

export const getReminderSettingsRemote = () =>
  request("GET", "/users/me/reminders");

export const saveReminderSettingsRemote = (enabled, reminders) =>
  request("PUT", "/users/me/reminders", { enabled, reminders });

export const deleteInsulinDose = (id) => request("DELETE", `/health/insulin/${id}`);

// ==========================================
// Preferences APIs
// ==========================================

export const getPreferences = () =>
  request("GET", "/users/me/preferences");

export const savePreferences = (prefs) =>
  request("PUT", "/users/me/preferences", prefs);
