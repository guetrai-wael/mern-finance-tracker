// Recurring transaction API service functions
import { api } from "../lib/api";
import type { RecurringTransaction, RecurringInput } from "../types";

export const getRecurring = async (): Promise<{
  rules: RecurringTransaction[];
}> => {
  const response = await api.get("/recurring");
  return { rules: response.data.data || [] };
};

export const createRecurring = async (
  data: RecurringInput
): Promise<{ rule: RecurringTransaction }> => {
  const response = await api.post("/recurring", data);
  return { rule: response.data.data };
};

export const updateRecurring = async (
  id: string,
  data: Partial<RecurringInput>
): Promise<{ rule: RecurringTransaction }> => {
  const response = await api.put(`/recurring/${id}`, data);
  return { rule: response.data.data };
};

export const deleteRecurring = async (id: string): Promise<void> => {
  await api.delete(`/recurring/${id}`);
};

/** Remove every transaction a rule has generated. */
export const undoRecurringGenerated = async (
  id: string
): Promise<{ deleted: number }> => {
  const response = await api.delete(`/recurring/${id}/generated`);
  return response.data.data;
};
