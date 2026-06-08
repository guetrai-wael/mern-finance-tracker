// Dashboard data hooks and utilities
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../services/transactions";
import { getBudget } from "../services/budgets";
import type { Transaction, Budget } from "../types";

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

export interface PeriodDeltas {
  income: number;
  expenses: number;
  balance: number;
  budgetUsed: number;
}

export interface CategoryDelta {
  name: string;
  currentMonth: number;
  threeMonthAvg: number;
  percentChange: number;
}

export interface UseDashboardResult {
  /** Aggregates for the current calendar month. */
  stats: DashboardStats;
  /** Same shape as `stats` but for the previous calendar month. */
  lastMonthStats: { income: number; expenses: number; balance: number };
  /** Percent change of current vs last month for each KPI; 0 if last month was 0. */
  deltas: PeriodDeltas;
  /** 6 months of totals oldest → newest, used by the BarChart. */
  monthlyData: MonthlyData[];
  /** Top-8 expense categories for the current month. */
  categoryBreakdown: CategoryBreakdown[];
  /** Per-category MoM change. Used by the insights engine. Empty when <4 months of history exists. */
  categoryDeltas: CategoryDelta[];
  /** True while ANY of the three underlying queries is loading. */
  isLoading: boolean;
  /** Current month's transactions; used by "Recent Activity" and the activity-drought insight. */
  transactions: Transaction[];
  /** Current month's budget envelope (may be null if user hasn't set one). */
  budget: { budget: Budget | null } | undefined;
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

export const useDashboardData = (): UseDashboardResult => {
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

  // Last-month totals for "vs last month" trend sublines on KPI cards.
  // monthlyData is ordered oldest → newest (6 entries: [m-5, m-4, m-3, m-2, m-1, current]).
  const lastMonthStats = React.useMemo(() => {
    if (!monthlyData || monthlyData.length < 2) {
      return { income: 0, expenses: 0, balance: 0 };
    }
    const prev = monthlyData[monthlyData.length - 2];
    return {
      income: prev.income,
      expenses: prev.expenses,
      balance: prev.income - prev.expenses,
    };
  }, [monthlyData]);

  // % change of current vs last month for the 4 KPI cards. Returns 0 if last month was 0
  // (avoid Infinity). Caller can decide to show "—" instead.
  const deltas: PeriodDeltas = React.useMemo(() => {
    const pct = (current: number, prev: number) =>
      prev === 0 ? 0 : ((current - prev) / Math.abs(prev)) * 100;
    return {
      income: pct(stats.totalIncome, lastMonthStats.income),
      expenses: pct(stats.totalExpenses, lastMonthStats.expenses),
      balance: pct(stats.balance, lastMonthStats.balance),
      budgetUsed: 0, // budget % is already a "vs target" metric; no MoM delta needed
    };
  }, [stats, lastMonthStats]);

  // Per-category month-over-month deltas, comparing current month spend in each
  // category to its avg over the prior 3 months. Used by the insights engine to
  // surface "Groceries up 23% vs your 3-month avg" cards.
  const categoryDeltas: CategoryDelta[] = React.useMemo(() => {
    if (!monthlyTransactions || monthlyTransactions.length < 4) return [];

    const buckets = monthlyTransactions.map(({ transactions }) => {
      const safe = transactions || [];
      const byCat: Record<string, number> = {};
      safe
        .filter((t: Transaction) => t.type === "expense")
        .forEach((t: Transaction) => {
          const name = t.category?.name || "Uncategorized";
          byCat[name] = (byCat[name] || 0) + t.amount;
        });
      return byCat;
    });

    const currentIdx = buckets.length - 1;
    const currentBucket = buckets[currentIdx];
    const priorBuckets = buckets.slice(Math.max(0, currentIdx - 3), currentIdx);
    if (priorBuckets.length === 0) return [];

    const allCats = new Set<string>([
      ...Object.keys(currentBucket),
      ...priorBuckets.flatMap((b) => Object.keys(b)),
    ]);

    return Array.from(allCats)
      .map((name) => {
        const currentMonth = currentBucket[name] || 0;
        const priorTotal = priorBuckets.reduce((s, b) => s + (b[name] || 0), 0);
        const threeMonthAvg = priorTotal / priorBuckets.length;
        const percentChange =
          threeMonthAvg === 0
            ? currentMonth > 0
              ? 100
              : 0
            : ((currentMonth - threeMonthAvg) / threeMonthAvg) * 100;
        return { name, currentMonth, threeMonthAvg, percentChange };
      })
      .filter((d) => d.currentMonth > 0 || d.threeMonthAvg > 0);
  }, [monthlyTransactions]);

  return {
    stats,
    lastMonthStats,
    deltas,
    monthlyData,
    categoryBreakdown,
    categoryDeltas,
    isLoading: transactionsLoading || budgetLoading || monthlyLoading,
    transactions,
    budget,
  };
};

// Format currency
// formatCurrency function moved to CurrencyContext for global currency support
