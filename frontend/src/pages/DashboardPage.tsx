// Dashboard page with charts and overview
import React from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboardData } from "../hooks/useDashboard";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import type { Transaction } from "../types";
import { FiArrowUp, FiArrowDown, FiActivity, FiPieChart } from "react-icons/fi";

const DashboardPage: React.FC = () => {
  const { stats, monthlyData, categoryBreakdown, isLoading, transactions } =
    useDashboardData();
  const { formatCurrency } = useCurrency();

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner />
        </div>
    );
  }

  // Chahrity Theme Colors
  const COLORS = {
      income: '#10b981', // Emerald 500
      expense: '#ef4444', // Red 500
      balance: '#3b82f6', // Blue 500
      chart: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1']
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
            Welcome back to <span className="font-semibold text-primary-600">Chahrity</span>. Here's your financial overview.
            </p>
        </div>
        <div className="flex gap-2">
            {/* Action buttons could go here */}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Income</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalIncome)}</h3>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <FiArrowUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-red-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Expenses</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalExpenses)}</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <FiArrowDown className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Net Balance</p>
              <h3 className={`mt-1 text-2xl font-bold ${stats.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {formatCurrency(stats.balance)}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <FiActivity className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Budget Usage</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-slate-900">{stats.budgetUsed.toFixed(1)}%</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    stats.budgetUsed > 90 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                    {stats.budgetUsed > 90 ? 'Critical' : 'Healthy'}
                </span>
              </div>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <FiPieChart className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Monthly Overview</h3>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    tickFormatter={(value) => `$${value}`} 
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill={COLORS.expense} radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Expense Distribution</h3>
          <div className="flex-1 w-full min-h-[300px]">
             {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS.chart[index % COLORS.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
             ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                     <FiPieChart className="w-12 h-12 mb-2 opacity-50" />
                     <p>No expense data yet</p>
                 </div>
             )}
          </div>
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categoryBreakdown.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex items-center text-xs text-slate-600">
                      <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                  </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
            <Link to="/transactions" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View All
            </Link>
        </div>
        <div className="divide-y divide-slate-50">
            {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                    <p>No transactions found.</p>
                </div>
            ) : (
                transactions.slice(0, 5).map((transaction: Transaction) => (
                    <div key={transaction._id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center
                                ${transaction.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}
                            `}>
                                {transaction.type === 'income' ? <FiArrowUp /> : <FiArrowDown />}
                            </div>
                            <div>
                                <p className="font-medium text-slate-900">{transaction.description}</p>
                                <p className="text-sm text-slate-500">{transaction.category?.name || 'Uncategorized'} • {new Date(transaction.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className={`
                            font-semibold
                            ${transaction.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}
                        `}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </span>
                    </div>
                ))
            )}
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
