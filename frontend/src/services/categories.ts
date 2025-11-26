// Category API service functions
import { api } from "../lib/api";
import type { Category, CategoryInput } from "../types";

export const getCategories = async (): Promise<{ categories: Category[] }> => {
  const response = await api.get("/categories");
  return { categories: response.data.data || [] };
};

export const createCategory = async (
  data: CategoryInput
): Promise<{ cat: Category }> => {
  const response = await api.post("/categories", data);
  return { cat: response.data.data };
};

export const updateCategory = async (
  id: string,
  data: CategoryInput
): Promise<{ cat: Category }> => {
  const response = await api.put(`/categories/${id}`, data);
  return { cat: response.data.data };
};

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/categories/${id}`);
};
