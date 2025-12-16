// Types for the application
export interface User {
  id: string;
  _id?: string; // MongoDB ObjectId
  name: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  activatedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    currency?: string;
    country?: string;
    dateFormat?: string;
    numberFormat?: string;
    theme?: string;
    notifications?: {
      email?: boolean;
      budgetAlerts?: boolean;
      goalReminders?: boolean;
      monthlyReports?: boolean;
    };
  };
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  user: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  _id: string;
  user: string;
  amount: number;
  category?: Category;
  type: "income" | "expense";
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  _id: string;
  user: string;
  month: string; // YYYY-MM
  totalBudget: number;
  categoryBudgets: {
    category: Category;
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "user" | "admin";
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
}

export interface TransactionInput {
  amount: number;
  category?: string;
  type: "income" | "expense";
  date?: string;
  description?: string;
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface BudgetInput {
  month: string;
  totalBudget: number;
  categoryBudgets: {
    category: string;
    amount: number;
  }[];
}

export interface Goal {
  _id: string;
  user: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  category:
    | "emergency"
    | "vacation"
    | "house"
    | "car"
    | "retirement"
    | "education"
    | "other";
  priority: "low" | "medium" | "high";
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  category?:
    | "emergency"
    | "vacation"
    | "house"
    | "car"
    | "retirement"
    | "education"
    | "other";
  priority?: "low" | "medium" | "high";
}

export interface GoalContribution {
  amount: number;
  description?: string;
}

export interface UserSettings {
  country: string;
  currency: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  numberFormat: "1,234.56" | "1.234,56" | "1 234,56";
  theme: "light" | "dark" | "auto";
  notifications: {
    email: boolean;
    budgetAlerts: boolean;
    goalReminders: boolean;
    monthlyReports: boolean;
  };
}

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  profilePicture?: string;
  settings: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateInput {
  name?: string;
  email?: string;
}

export interface PasswordUpdateInput {
  currentPassword: string;
  newPassword: string;
}

export interface SettingsUpdateInput {
  country?: string;
  currency?: string;
  dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  numberFormat?: "1,234.56" | "1.234,56" | "1 234,56";
  theme?: "light" | "dark" | "auto";
  notifications?: {
    email?: boolean;
    budgetAlerts?: boolean;
    goalReminders?: boolean;
    monthlyReports?: boolean;
  };
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
}

export interface BudgetAnalysis {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface FinancialHealth {
  score: number;
  factors: {
    savingsRate: number;
    budgetAdherence: number;
    goalProgress: number;
  };
  recommendations: string[];
}

export interface CountryInfo {
  name: string;
  currency: string;
  symbol: string;
}

export interface CountriesResponse {
  success: boolean;
  countries: Record<string, CountryInfo>;
}
