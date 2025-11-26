// Dashboard data hooks and utilities
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../services/transactions";
import { getBudget } from "../services/budgets";
import type { Transaction } from "../types";

export interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  budgetUsed: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
  color: string;
}

// Generate colors for pie chart
const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#EC4899",
  "#6B7280",
];

export const useDashboardData = () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Get current month transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", "current-month"],
    queryFn: () => {
      const startDate = new Date(currentMonth + "-01").toISOString();
      const endDate = new Date(
        new Date(currentMonth + "-01").getFullYear(),
        new Date(currentMonth + "-01").getMonth() + 1,
        0
      ).toISOString();
      return getTransactions({ start: startDate, end: endDate });
    },
  });

  const transactions = React.useMemo(
    () => transactionsData?.items || [],
    [transactionsData]
  );

  // Get current month budget
  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ["budget", currentMonth],
    queryFn: () => getBudget(currentMonth),
  });

  // Get last 6 months of transactions for monthly overview
  const { data: monthlyTransactions = [], isLoading: monthlyLoading } =
    useQuery({
      queryKey: ["transactions", "monthly-overview"],
      queryFn: async () => {
        const promises = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthStr = date.toISOString().slice(0, 7);
          const startDate = new Date(monthStr + "-01").toISOString();
          const endDate = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
          ).toISOString();

          promises.push(
            getTransactions({ start: startDate, end: endDate }).then(
              (data) => ({
                month: monthStr,
                transactions: data.items,
              })
            )
          );
        }
        return Promise.all(promises);
      },
    });

  // Calculate dashboard stats
  const stats: DashboardStats = React.useMemo(() => {
    const safeTransactions = transactions || [];
    const totalIncome = safeTransactions
      .filter((t: Transaction) => t.type === "income")
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const totalExpenses = safeTransactions
      .filter((t: Transaction) => t.type === "expense")
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    const budgetUsed = budget?.budget?.totalBudget
      ? (totalExpenses / budget.budget.totalBudget) * 100
      : 0;

    return {
      totalIncome,
      totalExpenses,
      balance,
      budgetUsed: Math.min(budgetUsed, 100),
    };
  }, [transactions, budget]);

  // Calculate monthly overview data
  const monthlyData: MonthlyData[] = React.useMemo(() => {
    return (monthlyTransactions || []).map(({ month, transactions }) => {
      const safeTransactions = transactions || [];
      const income = safeTransactions
        .filter((t: Transaction) => t.type === "income")
        .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

      const expenses = safeTransactions
        .filter((t: Transaction) => t.type === "expense")
        .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

      return {
        month: new Date(month + "-01").toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        income,
        expenses,
      };
    });
  }, [monthlyTransactions]);

  // Calculate category breakdown
  const categoryBreakdown: CategoryBreakdown[] = React.useMemo(() => {
    const safeTransactions = transactions || [];
    const expensesByCategory = safeTransactions
      .filter((t: Transaction) => t.type === "expense")
      .reduce((acc: Record<string, number>, t: Transaction) => {
        const categoryName = t.category?.name || "Uncategorized";
        acc[categoryName] = (acc[categoryName] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(expensesByCategory)
      .map(([name, value], index) => ({
        name,
        value: value as number,
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [transactions]);

  return {
    stats,
    monthlyData,
    categoryBreakdown,
    isLoading: transactionsLoading || budgetLoading || monthlyLoading,
    transactions,
  };
};

// Format currency
// formatCurrency function moved to CurrencyContext for global currency support
