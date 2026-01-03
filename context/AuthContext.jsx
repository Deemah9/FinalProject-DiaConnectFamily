// context/AuthContext.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

export const AuthContext = createContext(null);

const TOKEN_KEY = "token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // ممكن نخليه null بالبداية
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // loading أثناء auto-login
  const [authError, setAuthError] = useState(""); // رسالة خطأ عامة (اختياري)

  // ✅ Auto-login: إذا في توكن مخزّن
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (savedToken) {
          setToken(savedToken);

          // (اختياري) إذا عندكم endpoint يجيب بيانات المستخدم:
          // const me = await api.get("/auth/me");
          // setUser(me.data);

          setUser({}); // placeholder لحد ما يتوفر /me من الباكند
        }
      } catch (e) {
        console.log("Auth bootstrap error:", e?.message || e);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  // ✅ Login
  const login = async ({ email, password }) => {
    setAuthError("");
    try {
      // عدّل المسار حسب الباكند عند ديمة:
      // مثال شائع: /auth/login
      const res = await api.post("/auth/login", { email, password });

      // نتوقع يرجع: { token: "..." , user: {...} } (حسب الباكند)
      const newToken = res.data?.token;
      const newUser = res.data?.user;

      if (!newToken) throw new Error("Token not found in response");

      await AsyncStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(newUser || {});
      return { ok: true };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login failed";
      setAuthError(msg);
      return { ok: false, message: msg };
    }
  };

  // ✅ Register
  const register = async (payload) => {
    setAuthError("");
    try {
      // عدّل المسار حسب الباكند:
      const res = await api.post("/auth/register", payload);

      // بعض الباكند يرجع token مباشرة بعد التسجيل
      const newToken = res.data?.token;
      const newUser = res.data?.user;

      if (newToken) {
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser || {});
      }

      return { ok: true };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Register failed";
      setAuthError(msg);
      return { ok: false, message: msg };
    }
  };

  // ✅ Logout
  const logout = async () => {
    setAuthError("");
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authError,
      login,
      register,
      logout,
      isLoggedIn: !!token,
      setAuthError,
    }),
    [user, token, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
