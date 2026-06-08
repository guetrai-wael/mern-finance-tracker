// Authentication context and provider with secure cookie-based auth
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, LoginCredentials, SignupCredentials } from "../types";
import { authStorage } from "../lib/api";
import * as authApi from "../services/auth";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  updateUser?: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check if user is logged in on mount (cookies are sent automatically)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      } catch (error) {
        // No valid session, user needs to login
        console.warn("No valid session found");
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Keep auth state fresh without forcing reloads. Two triggers:
  //   - every 5 minutes while the tab is visible (catches admin extends/deactivations)
  //   - on tab visibility change (catches the "I left for an hour" case)
  // No-op when not authenticated.
  useEffect(() => {
    if (!user) return;

    const silentRefresh = async () => {
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      } catch {
        // Don't log out on transient failures — the next refresh attempt will retry.
      }
    };

    const POLL_MS = 5 * 60 * 1000;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") silentRefresh();
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") silentRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Re-create the interval only when the authenticated user identity changes,
    // not when arbitrary user fields change (the silentRefresh closure reads the
    // newest user via setUser).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id || user?.id]);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authApi.login(credentials);
      setUser(response.user);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    try {
      await authApi.signup(credentials);
      // After signup, user needs to login
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authStorage.clearAuth();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
