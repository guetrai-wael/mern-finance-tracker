// Budget API service functions
import { api } from "../lib/api";
import type { Budget, BudgetInput } from "../types";

export const getBudget = async (
  month: string
): Promise<{ budget: Budget | null }> => {
  const response = await api.get(`/budgets?month=${month}`);
  return { budget: response.data.data };
};

export const upsertBudget = async (
  data: BudgetInput
): Promise<{ budget: Budget }> => {
  const response = await api.post("/budgets", data);
  return { budget: response.data.data };
};
