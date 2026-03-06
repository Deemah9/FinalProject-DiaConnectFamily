import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://10.0.2.2:8000";

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
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const config = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

const raw = await response.text(); // اقرأ كنص أولاً
let data = null;

try {
  data = raw ? JSON.parse(raw) : null;
} catch {
  // ليس JSON
  data = null;
}

if (!response.ok) {
  // إذا السيرفر رجّع JSON وفيه detail
  const msg =
    (data && (data.detail || data.message)) ||
    raw || // اعرض النص الخام (مثل Internal Server Error)
    `HTTP ${response.status}`;

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
  await AsyncStorage.setItem("token", data.accessToken); // ← accessToken
  await AsyncStorage.setItem("role", data.role);
  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("role");
};

// ==========================================
// User Profile APIs
// ==========================================

export const getProfile = () => request("GET", "/users/me");

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

export const getGlucoseStats = () => request("GET", "/glucose/stats");

// ==========================================
// Daily Logs APIs
// ==========================================

export const addMeal = (data) => request("POST", "/daily-logs/meals", data);

export const addActivity = (data) =>
  request("POST", "/daily-logs/activities", data);

export const addSleep = (data) => request("POST", "/daily-logs/sleep", data);

export const getTodayLogs = () => request("GET", "/daily-logs/today");
