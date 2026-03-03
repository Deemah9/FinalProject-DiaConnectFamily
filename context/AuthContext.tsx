import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "../services/api";

// ==========================================
// Types
// ==========================================

interface User {
  token: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
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
    setUser({ token: data.accessToken, role: data.role }); // ← accessToken
    // @ts-ignore
    router.replace("/(tabs)");
  };

  const register = async (userData: any) => {
    await apiRegister(userData);
    await login(userData.email, userData.password);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    // @ts-ignore
    router.replace("/welcome");
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
