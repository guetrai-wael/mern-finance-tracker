import API_BASE_URL from "../config";

const API_URL = `${API_BASE_URL}/api/v1`;

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for auth
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Auth service
export const authService = {
  signup: (userData) => apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),

  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  getProfile: () => apiRequest('/auth/me'),

  updateProfile: (userData) => apiRequest('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(userData),
  }),
};

// Transaction service
export const transactionService = {
  getAll: () => apiRequest('/transactions'),

  create: (transaction) => apiRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(transaction),
  }),

  update: (id, transaction) => apiRequest(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  }),

  delete: (id) => apiRequest(`/transactions/${id}`, {
    method: 'DELETE',
  }),

  export: (format = 'csv') => apiRequest(`/export/transactions?format=${format}`),
};

// Category service
export const categoryService = {
  getAll: () => apiRequest('/categories'),

  create: (category) => apiRequest('/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  }),

  update: (id, category) => apiRequest(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
  }),

  delete: (id) => apiRequest(`/categories/${id}`, {
    method: 'DELETE',
  }),
};

// Budget service
export const budgetService = {
  getAll: () => apiRequest('/budgets'),

  create: (budget) => apiRequest('/budgets', {
    method: 'POST',
    body: JSON.stringify(budget),
  }),

  update: (id, budget) => apiRequest(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(budget),
  }),

  delete: (id) => apiRequest(`/budgets/${id}`, {
    method: 'DELETE',
  }),
};

// Goals service
export const goalsService = {
  getAll: () => apiRequest('/goals'),

  create: (goal) => apiRequest('/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  }),

  update: (id, goal) => apiRequest(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(goal),
  }),

  delete: (id) => apiRequest(`/goals/${id}`, {
    method: 'DELETE',
  }),
};

// Analytics service
export const analyticsService = {
  getSpendingByCategory: () => apiRequest('/analytics/spending-by-category'),
  getMonthlyTrends: () => apiRequest('/analytics/monthly-trends'),
  getBudgetAnalysis: () => apiRequest('/analytics/budget-analysis'),
  getGoalsProgress: () => apiRequest('/analytics/goals-progress'),
};

// Default export for backward compatibility
export default {
  authService,
  transactionService,
  categoryService,
  budgetService,
  goalsService,
  analyticsService,
};