// Analytics API service functions
import { api } from "../lib/api";
import type {
  FinancialSummary,
  BudgetAnalysis,
  FinancialHealth,
} from "../types";

export interface SummaryParams {
  period?: "month" | "year";
  year?: number;
  month?: number;
}

export const getFinancialSummary = async (
  params?: SummaryParams
): Promise<FinancialSummary> => {
  const response = await api.get("/analytics/summary", { params });
  return response.data.data;
};

export const getBudgetAnalysis = async (
  month?: string
): Promise<BudgetAnalysis> => {
  const params = month ? { month } : {};
  const response = await api.get("/analytics/budget-analysis", { params });
  return response.data.data;
};

export const getFinancialHealth = async (): Promise<FinancialHealth> => {
  const response = await api.get("/analytics/health");
  return response.data.data;
};
