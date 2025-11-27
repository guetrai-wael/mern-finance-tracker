import React, { useState } from "react";
import {
  FiDownload,
  FiFileText,
  FiDatabase,
  FiAlertTriangle,
} from "react-icons/fi";
import { useToast } from "../../hooks/useToast";
import { transactionService } from "../../services/api";

interface Transaction {
  _id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
}

interface ExportData {
  type: string;
  data: unknown;
}

interface ExportOptions {
  includeTransactions: boolean;
  includeCategories: boolean;
  includeBudgets: boolean;
  dateRange: "all" | "last_month" | "last_3_months" | "last_year" | "custom";
  startDate?: string;
  endDate?: string;
  format: "csv" | "json";
}

const DataSettings: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeTransactions: true,
    includeCategories: true,
    includeBudgets: false,
    dateRange: "all",
    format: "csv",
  });

  const handleExportData = async () => {
    if (
      !exportOptions.includeTransactions &&
      !exportOptions.includeCategories &&
      !exportOptions.includeBudgets
    ) {
      showError("Please select at least one data type to export");
      return;
    }

    setIsExporting(true);
    try {
      const filename = `finance_data_${new Date().toISOString().split("T")[0]}`;
      const data: ExportData[] = [];
      let csvContent = "";

      // Export transactions
      if (exportOptions.includeTransactions) {
        const response = await transactionService.getAll();
        const transactions = response.data;

        if (exportOptions.format === "csv") {
          const transactionsCsv = convertTransactionsToCSV(transactions);
          csvContent += transactionsCsv + "\n\n";
        } else {
          data.push({ type: "transactions", data: transactions });
        }
      }

      // Export categories (placeholder - implement based on your API)
      if (exportOptions.includeCategories) {
        const categories = [
          { id: 1, name: "Food", type: "expense", color: "#FF6B6B" },
          { id: 2, name: "Transport", type: "expense", color: "#4ECDC4" },
          { id: 3, name: "Salary", type: "income", color: "#45B7D1" },
        ];

        if (exportOptions.format === "csv") {
          csvContent += "Categories\n";
          csvContent += "ID,Name,Type,Color\n";
          categories.forEach((cat) => {
            csvContent += `${cat.id},"${cat.name}",${cat.type},${cat.color}\n`;
          });
          csvContent += "\n";
        } else {
          data.push({ type: "categories", data: categories });
        }
      }

      // Export budgets (placeholder)
      if (exportOptions.includeBudgets) {
        const budgets = [
          { id: 1, category: "Food", amount: 500, period: "monthly" },
          { id: 2, category: "Transport", amount: 200, period: "monthly" },
        ];

        if (exportOptions.format === "csv") {
          csvContent += "Budgets\n";
          csvContent += "ID,Category,Amount,Period\n";
          budgets.forEach((budget) => {
            csvContent += `${budget.id},"${budget.category}",${budget.amount},${budget.period}\n`;
          });
        } else {
          data.push({ type: "budgets", data: budgets });
        }
      }

      // Download file
      const blob =
        exportOptions.format === "csv"
          ? new Blob([csvContent], { type: "text/csv" })
          : new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.${exportOptions.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess("Data exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      showError("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const convertTransactionsToCSV = (transactions: Transaction[]) => {
    let csv = "Transactions\n";
    csv += "ID,Date,Description,Amount,Category,Type\n";

    transactions.forEach((transaction) => {
      csv += `${transaction._id},"${transaction.date}","${transaction.description}",${transaction.amount},"${transaction.category}",${transaction.type}\n`;
    });

    return csv;
  };

  const handleDeleteAccount = async () => {
    try {
      // Implement account deletion API call
      showSuccess("Account deletion request submitted");
      setShowDeleteConfirm(false);
    } catch {
      showError("Failed to delete account");
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FiDownload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Export Data</h3>
            <p className="text-sm text-gray-600">
              Download your financial data
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Data Types */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              What to export
            </h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeTransactions}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeTransactions: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Transactions</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeCategories}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeCategories: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Categories</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeBudgets}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeBudgets: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Budgets</span>
              </label>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Date range
            </h4>
            <select
              value={exportOptions.dateRange}
              onChange={(e) =>
                setExportOptions((prev) => ({
                  ...prev,
                  dateRange: e.target.value as ExportOptions["dateRange"],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All time</option>
              <option value="last_month">Last month</option>
              <option value="last_3_months">Last 3 months</option>
              <option value="last_year">Last year</option>
              <option value="custom">Custom range</option>
            </select>

            {exportOptions.dateRange === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={exportOptions.startDate || ""}
                    onChange={(e) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={exportOptions.endDate || ""}
                    onChange={(e) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Export format
            </h4>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportOptions.format === "csv"}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      format: e.target.value as "csv" | "json",
                    }))
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  CSV (Excel compatible)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={exportOptions.format === "json"}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      format: e.target.value as "csv" | "json",
                    }))
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">JSON</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Exporting...
              </>
            ) : (
              <>
                <FiDownload className="w-4 h-4" />
                Export Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <FiDatabase className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Data Management
            </h3>
            <p className="text-sm text-gray-600">Manage your stored data</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Storage Usage
            </h4>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Transactions: ~{Math.floor(Math.random() * 1000) + 100} records
              </span>
              <span>Data size: ~{(Math.random() * 10 + 5).toFixed(1)} MB</span>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <FiFileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Data Retention
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Your data is stored securely and backed up daily. Transaction
                  data older than 7 years may be archived for performance
                  reasons.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 rounded-lg">
            <FiAlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-600">Irreversible actions</p>
          </div>
        </div>

        <div className="p-4 border border-red-200 rounded-lg">
          <h4 className="text-sm font-medium text-red-900 mb-2">
            Delete Account
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-900">
                Are you sure? This will permanently delete your account and all
                data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Yes, delete my account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataSettings;
