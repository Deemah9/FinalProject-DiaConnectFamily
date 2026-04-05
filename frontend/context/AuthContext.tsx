import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getProfile,
} from "../services/api";
import { setAppLanguage } from "../src/i18n";

// ==========================================
// Types
// ==========================================

interface User {
  token: string;
  role: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "patient" | "family_member";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

// ==========================================
// Context
// ==========================================

const AuthContext = createContext<AuthContextType | null>(null);

// ==========================================
// Provider
// ==========================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");
      if (token && role) {
        setUser({ token, role });
      }
      setLoading(false);
    };
    checkToken();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    const token: string = data.accessToken;
    const role: string = data.role;
    await AsyncStorage.setItem("token", token);
    await AsyncStorage.setItem("role", role);
    setUser({ token, role });

    let profileComplete = false;
    try {
      const profile = await getProfile();
      const lifestyle = profile?.lifestyle || {};
      profileComplete = !!(lifestyle.activity_level && lifestyle.sleep_hours != null);
      const lang = profile?.language;
      if (lang === "en" || lang === "ar" || lang === "he") {
        await setAppLanguage(lang);
      }
    } catch {
      // if profile fetch fails, send to onboarding to be safe
    }

    router.replace(profileComplete ? "/(tabs)" : "/onboarding");
  };

  const register = async (userData: RegisterPayload) => {
    await apiRegister(userData);
    await login(userData.email, userData.password);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      router.replace("/welcome");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ==========================================
// Hook
// ==========================================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
