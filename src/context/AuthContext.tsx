"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  status: string;
  avatarUrl: string | null;
  bio?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user) {
          const socket = getSocket();
          socket.emit("user:init", { userId: data.user.id });
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
