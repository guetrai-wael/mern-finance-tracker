export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthService {
  signup: (userData: any) => Promise<ApiResponse>;
  login: (credentials: any) => Promise<ApiResponse>;
  logout: () => Promise<ApiResponse>;
  getProfile: () => Promise<ApiResponse>;
  updateProfile: (userData: any) => Promise<ApiResponse>;
}

export interface TransactionService {
  getAll: () => Promise<ApiResponse>;
  create: (transaction: any) => Promise<ApiResponse>;
  update: (id: string, transaction: any) => Promise<ApiResponse>;
  delete: (id: string) => Promise<ApiResponse>;
  export: (format?: string) => Promise<ApiResponse>;
}

export interface CategoryService {
  getAll: () => Promise<ApiResponse>;
  create: (category: any) => Promise<ApiResponse>;
  update: (id: string, category: any) => Promise<ApiResponse>;
  delete: (id: string) => Promise<ApiResponse>;
}

export interface BudgetService {
  getAll: () => Promise<ApiResponse>;
  create: (budget: any) => Promise<ApiResponse>;
  update: (id: string, budget: any) => Promise<ApiResponse>;
  delete: (id: string) => Promise<ApiResponse>;
}

export interface GoalsService {
  getAll: () => Promise<ApiResponse>;
  create: (goal: any) => Promise<ApiResponse>;
  update: (id: string, goal: any) => Promise<ApiResponse>;
  delete: (id: string) => Promise<ApiResponse>;
}

export interface AnalyticsService {
  getSpendingByCategory: () => Promise<ApiResponse>;
  getMonthlyTrends: () => Promise<ApiResponse>;
  getBudgetAnalysis: () => Promise<ApiResponse>;
  getGoalsProgress: () => Promise<ApiResponse>;
}

export const authService: AuthService;
export const transactionService: TransactionService;
export const categoryService: CategoryService;
export const budgetService: BudgetService;
export const goalsService: GoalsService;
export const analyticsService: AnalyticsService;

declare const apiModule: {
  authService: AuthService;
  transactionService: TransactionService;
  categoryService: CategoryService;
  budgetService: BudgetService;
  goalsService: GoalsService;
  analyticsService: AnalyticsService;
};

export default apiModule;
