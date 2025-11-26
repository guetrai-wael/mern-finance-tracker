// Users API service functions (admin only)
import { api } from "../lib/api";
import type { User } from "../types";

export const getUsers = async (): Promise<{ users: User[] }> => {
  const response = await api.get("/users");
  return { users: response.data.data || [] };
};

export const getUser = async (id: string): Promise<{ user: User }> => {
  const response = await api.get(`/users/${id}`);
  return { user: response.data.data };
};

export const updateUser = async (
  id: string,
  data: Partial<User>
): Promise<{ user: User }> => {
  const response = await api.put(`/users/${id}`, data);
  return { user: response.data.data };
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

export const exportUsers = async (format: "csv" | "json"): Promise<Blob> => {
  const response = await api.get(`/export/users?format=${format}`, {
    responseType: "blob",
  });
  return response.data;
};
