// Transaction API service functions
import { api } from "../lib/api";
import type { Transaction, TransactionInput } from "../types";

export interface TransactionFilters {
  start?: string;
  end?: string;
  type?: "income" | "expense";
}

export const getTransactions = async (
  filters?: TransactionFilters
): Promise<{ items: Transaction[] }> => {
  const params = new URLSearchParams();
  if (filters?.start) params.append("start", filters.start);
  if (filters?.end) params.append("end", filters.end);
  if (filters?.type) params.append("type", filters.type);

  const response = await api.get(`/transactions?${params.toString()}`);
  return { items: response.data.data || [] };
};

export const getTransaction = async (
  id: string
): Promise<{ item: Transaction }> => {
  const response = await api.get(`/transactions/${id}`);
  return { item: response.data.data };
};

export const createTransaction = async (
  data: TransactionInput
): Promise<{ trx: Transaction }> => {
  const response = await api.post("/transactions", data);
  return { trx: response.data.data };
};

export const updateTransaction = async (
  id: string,
  data: TransactionInput
): Promise<{ trx: Transaction }> => {
  const response = await api.put(`/transactions/${id}`, data);
  return { trx: response.data.data };
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await api.delete(`/transactions/${id}`);
};
