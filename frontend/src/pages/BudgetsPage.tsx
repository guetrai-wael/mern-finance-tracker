// Budgets page with budget management and progress tracking
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi";
import { getBudget, upsertBudget } from "../services/budgets";
import { getCategories } from "../services/categories";
import { getTransactions } from "../services/transactions";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/common/LoadingSpinner";
import type { BudgetInput } from "../types";

const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format"),
  totalBudget: z.number().min(0, "Budget must be 0 or greater"),
  categoryBudgets: z.array(
    z.object({
      category: z.string().min(1, "Category is required"),
      amount: z.number().min(0, "Amount must be 0 or greater"),
    })
  ),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

const BudgetsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [isEditing, setIsEditing] = useState(false);
  const { formatCurrency } = useCurrency();

  const queryClient = useQueryClient();

  // Queries
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ["budget", selectedMonth],
    queryFn: () => getBudget(selectedMonth),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ["transactions", "budget", selectedMonth],
    queryFn: () => {
      const startDate = new Date(selectedMonth + "-01").toISOString();
      const endDate = new Date(
        new Date(selectedMonth + "-01").getFullYear(),
        new Date(selectedMonth + "-01").getMonth() + 1,
        0
      ).toISOString();
      return getTransactions({
        start: startDate,
        end: endDate,
        type: "expense",
      });
    },
  });

  const budget = budgetData?.budget;
  const categories = categoriesData?.categories || [];
  const transactions = transactionsData?.items || [];

  // Calculate spending
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const spentByCategory = transactions.reduce((acc, transaction) => {
    const categoryId = transaction.category?._id || "uncategorized";
    acc[categoryId] = (acc[categoryId] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: upsertBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      setIsEditing(false);
    },
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      month: selectedMonth,
      totalBudget: 0,
      categoryBudgets: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "categoryBudgets",
  });

  const onSubmit = (data: BudgetFormData) => {
    const budgetData: BudgetInput = {
      month: data.month,
      totalBudget: data.totalBudget,
      categoryBudgets: data.categoryBudgets,
    };

    upsertMutation.mutate(budgetData);
  };

  const startEditing = () => {
    reset({
      month: selectedMonth,
      totalBudget: budget?.totalBudget || 0,
      categoryBudgets:
        budget?.categoryBudgets.map((cb) => ({
          category: cb.category._id,
          amount: cb.amount,
        })) || [],
    });
    setIsEditing(true);
  };

  const addCategoryBudget = () => {
    append({ category: "", amount: 0 });
  };

  const getBudgetProgress = (spent: number, budgeted: number) => {
    if (budgeted === 0) return 0;
    return Math.min((spent / budgeted) * 100, 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "bg-red-500";
    if (progress >= 90) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (budgetLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
            <p className="mt-1 text-sm text-gray-600">
              Set and track your monthly budgets
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setIsEditing(false);
              }}
              className="form-input"
            />
            {!isEditing && (
              <button onClick={startEditing} className="btn-primary">
                {budget ? "Edit Budget" : "Create Budget"}
              </button>
            )}
          </div>
        </div>
      </div>

      {isEditing ? (
        // Budget Form
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {budget ? "Edit Budget" : "Create Budget"} for{" "}
            {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="form-label">Total Monthly Budget</label>
              <input
                type="number"
                step="0.01"
                {...register("totalBudget", { valueAsNumber: true })}
                className="form-input"
                placeholder="0.00"
              />
              {errors.totalBudget && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.totalBudget.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="form-label mb-0">Category Budgets</label>
                <button
                  type="button"
                  onClick={addCategoryBudget}
                  className="btn-secondary text-sm flex items-center space-x-1"
                >
                  <FiPlus className="h-3 w-3" />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-3">
                    <select
                      {...register(`categoryBudgets.${index}.category`)}
                      className="form-input flex-1"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`categoryBudgets.${index}.amount`, {
                        valueAsNumber: true,
                      })}
                      className="form-input w-32"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-500"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {fields.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  No category budgets added. Click "Add Category" to get
                  started.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  reset();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={upsertMutation.isPending}
                className="btn-primary"
              >
                {upsertMutation.isPending
                  ? "Saving..."
                  : budget
                  ? "Update Budget"
                  : "Create Budget"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Budget Display
        <div className="space-y-6">
          {/* Overall Budget Progress */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Overall Budget for{" "}
                {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              {budget && (
                <button
                  onClick={startEditing}
                  className="text-blue-600 hover:text-blue-500"
                >
                  <FiEdit className="h-4 w-4" />
                </button>
              )}
            </div>

            {budget ? (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">
                    {formatCurrency(totalSpent)} of{" "}
                    {formatCurrency(budget.totalBudget)} spent
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      getBudgetProgress(totalSpent, budget.totalBudget) >= 100
                        ? "text-red-600"
                        : getBudgetProgress(totalSpent, budget.totalBudget) >=
                          90
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {getBudgetProgress(totalSpent, budget.totalBudget).toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(
                      getBudgetProgress(totalSpent, budget.totalBudget)
                    )}`}
                    style={{
                      width: `${getBudgetProgress(
                        totalSpent,
                        budget.totalBudget
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  Remaining:{" "}
                  {formatCurrency(Math.max(0, budget.totalBudget - totalSpent))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No budget set for this month
                </p>
                <button onClick={startEditing} className="btn-primary">
                  Create Budget
                </button>
              </div>
            )}
          </div>

          {/* Category Budgets */}
          {budget && budget.categoryBudgets.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Category Budgets
              </h3>
              <div className="space-y-4">
                {budget.categoryBudgets.map((categoryBudget) => {
                  const spent =
                    spentByCategory[categoryBudget.category._id] || 0;
                  const progress = getBudgetProgress(
                    spent,
                    categoryBudget.amount
                  );

                  return (
                    <div key={categoryBudget.category._id}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-900">
                          {categoryBudget.category.name}
                        </span>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {formatCurrency(spent)} of{" "}
                            {formatCurrency(categoryBudget.amount)}
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              progress >= 100
                                ? "text-red-600"
                                : progress >= 90
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {progress.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(
                            progress
                          )}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;
