// Settings API service functions
import { api } from "../lib/api";
import type { User } from "../types";

export interface UpdateProfileData {
  name?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UserSettings {
  currency: "USD" | "EUR" | "TND";
  // Add more settings as needed
}

export const updateProfile = async (
  data: UpdateProfileData
): Promise<{ user: User }> => {
  const response = await api.put("/users/profile", data);
  return { user: response.data.data };
};

export const changePassword = async (
  data: ChangePasswordData
): Promise<void> => {
  await api.put("/users/change-password", data);
};

export const getUserSettings = async (): Promise<{
  settings: UserSettings;
}> => {
  const response = await api.get("/users/settings");
  return { settings: response.data.data || { currency: "USD" } };
};

export const updateUserSettings = async (
  settings: Partial<UserSettings>
): Promise<{ settings: UserSettings }> => {
  const response = await api.put("/users/settings", settings);
  return { settings: response.data.data };
};

// Combined function to update both database and context
export const updateUserSettingsAndContext = async (
  settings: Partial<UserSettings>,
  setCurrency: (currency: string) => void,
  refreshUser: () => Promise<void>
): Promise<{ settings: UserSettings }> => {
  // Update database first
  const result = await updateUserSettings(settings);

  // Update currency context immediately if currency was changed
  if (settings.currency) {
    setCurrency(settings.currency);
  }

  // Refresh user data in AuthContext (background update)
  refreshUser().catch(console.error);

  return result;
};

export const exportUserData = async (format: "csv" | "json"): Promise<Blob> => {
  const response = await api.get(`/export/transactions?format=${format}`, {
    responseType: "blob",
  });
  return response.data;
};

export const deleteAccount = async (): Promise<void> => {
  await api.delete("/users/profile");
};
