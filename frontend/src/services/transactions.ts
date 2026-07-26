// Transaction API service functions
import { api } from "../lib/api";
import type { Transaction, TransactionInput } from "../types";

export interface TransactionFilters {
  start?: string;
  end?: string;
  type?: "income" | "expense" | "transfer";
  account?: string;
  limit?: number;
}

/**
 * The API defaults to 50 results and caps at 100. Anything that computes a
 * total from the returned rows must ask for the maximum, or it silently
 * reports a figure derived from a partial month — the bug that made dashboard
 * totals wrong for anyone with more than 50 transactions in a month.
 */
export const MAX_TRANSACTION_PAGE = 100;

export const getTransactions = async (
  filters?: TransactionFilters
): Promise<{ items: Transaction[] }> => {
  const params = new URLSearchParams();
  if (filters?.start) params.append("start", filters.start);
  if (filters?.end) params.append("end", filters.end);
  if (filters?.type) params.append("type", filters.type);
  if (filters?.account) params.append("account", filters.account);
  if (filters?.limit) params.append("limit", String(filters.limit));

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

export const exportTransactions = async (
  format: "csv" | "json",
  filters?: TransactionFilters
): Promise<Blob> => {
  const params = new URLSearchParams();
  params.append("format", format);
  if (filters?.start) params.append("start", filters.start);
  if (filters?.end) params.append("end", filters.end);
  if (filters?.type) params.append("type", filters.type);
  const response = await api.get(`/export/transactions?${params.toString()}`, {
    responseType: "blob",
  });
  return response.data;
};
