// Account API service functions
import { api } from "../lib/api";
import type { Account, AccountInput } from "../types";

export const getAccounts = async (
  includeArchived = false
): Promise<{ accounts: Account[] }> => {
  const response = await api.get(
    `/accounts${includeArchived ? "?includeArchived=true" : ""}`
  );
  return { accounts: response.data.data || [] };
};

export const getAccount = async (id: string): Promise<{ account: Account }> => {
  const response = await api.get(`/accounts/${id}`);
  return { account: response.data.data };
};

export const createAccount = async (
  data: AccountInput
): Promise<{ account: Account }> => {
  const response = await api.post("/accounts", data);
  return { account: response.data.data };
};

export const updateAccount = async (
  id: string,
  data: Partial<AccountInput>
): Promise<{ account: Account }> => {
  const response = await api.put(`/accounts/${id}`, data);
  return { account: response.data.data };
};

export const deleteAccount = async (id: string): Promise<void> => {
  await api.delete(`/accounts/${id}`);
};

export const setDefaultAccount = async (
  id: string
): Promise<{ account: Account }> => {
  const response = await api.post(`/accounts/${id}/default`);
  return { account: response.data.data };
};
