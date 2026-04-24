import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";

// ==========================================
// Helper — get token from storage
// ==========================================

const getToken = async () => {
  return await AsyncStorage.getItem("token");
};

// ==========================================
// Helper — base request
// ==========================================

const request = async (method, endpoint, body = null) => {
  const token = await getToken();

  const headers = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const config = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

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

export const updateMedical = (data) =>
  request("PUT", "/users/me/medical", data);

export const updateLifestyle = (data) =>
  request("PUT", "/users/me/lifestyle", data);

// ==========================================
// Glucose APIs
// ==========================================

export const addGlucose = (value, measuredAt) =>
  request("POST", "/glucose/", { value, measuredAt });

export const getGlucoseReadings = () => request("GET", "/glucose/");

export const getLatestGlucose = () => request("GET", "/glucose/latest");

export const deleteGlucose = (id) => request("DELETE", `/glucose/${id}`);

export const getGlucoseStats = (days = 7) =>
  request("GET", `/glucose/stats?days=${days}`);

export const getGlucosePrediction = (hours = 1, lang = "ar") =>
  request("GET", `/glucose/predict?hours=${hours}&lang=${lang}`);

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
