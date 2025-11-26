// React Query configuration and setup
import { QueryClient } from "@tanstack/react-query";
import type { TransactionFilters } from "../services/transactions";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  auth: ["auth"],
  user: (id?: string) => ["user", id].filter(Boolean),
  users: ["users"],
  transactions: (filters?: TransactionFilters) =>
    ["transactions", filters].filter(Boolean),
  transaction: (id: string) => ["transaction", id],
  categories: ["categories"],
  category: (id: string) => ["category", id],
  budgets: (month?: string) => ["budgets", month].filter(Boolean),
  budget: (month: string) => ["budget", month],
} as const;
