// Auth API service functions with cookie-based authentication
import { api } from "../lib/api";
import type { LoginCredentials, SignupCredentials, User } from "../types";

export interface LoginResponse {
  message: string;
  user: User;
}

export const login = async (
  credentials: LoginCredentials
): Promise<LoginResponse> => {
  console.log("Making login request to:", api.defaults.baseURL + "/auth/login");
  console.log("Credentials:", { email: credentials.email, password: "***" });

  const response = await api.post("/auth/login", credentials);
  console.log("Login response:", response.data);

  return {
    message: response.data.message,
    user: response.data.data, // Backend returns user data in 'data' field
  };
};

export const signup = async (credentials: SignupCredentials): Promise<void> => {
  await api.post("/auth/signup", credentials);
};

export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get("/auth/me");
  return response.data.data;
};

export const refreshToken = async (): Promise<void> => {
  await api.post("/auth/refresh");
};
