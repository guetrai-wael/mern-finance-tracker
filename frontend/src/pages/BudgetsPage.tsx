// Budgets page with budget management and progress tracking
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiEdit, FiPlus, FiTrash2, FiTarget } from "react-icons/fi";
import { getBudget, upsertBudget } from "../services/budgets";
import { getCategories } from "../services/categories";
import { getTransactions } from "../services/transactions";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import type { BudgetInput } from "../types";

const budgetSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format"),
    totalBudget: z.number().min(0, "Budget must be 0 or greater"),
    categoryBudgets: z.array(
      z.object({
        category: z.string().min(1, "Category is required"),
        amount: z.number().min(0, "Amount must be 0 or greater"),
      })
    ),
  })
  .refine(
    (data) => {
      const totalAllocated = data.categoryBudgets.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      return totalAllocated <= data.totalBudget;
    },
    {
      message: "Total allocations cannot exceed the monthly budget",
      path: ["categoryBudgets"], // Attach to the array field
    }
  );

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
    watch,
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

  // Watch values for live calculation
  const watchedTotalBudget = watch("totalBudget") || 0;
  const watchedCategoryBudgets = watch("categoryBudgets") || [];
  const totalAllocated = watchedCategoryBudgets.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );
  const unallocated = watchedTotalBudget - totalAllocated;
  const isOverBudget = unallocated < 0;

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
    return "bg-emerald-500";
  };

  if (budgetLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budgets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set spending limits and track your progress
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
              className="block rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {!isEditing && (
              <Button onClick={startEditing}>
                {budget ? "Edit Budget" : "Create Budget"}
              </Button>
            )}
        </div>
      </div>

      {isEditing ? (
        // Budget Form
        <Card className="p-6">
          <div className="flex items-center mb-6 space-x-3">
             <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                 <FiTarget className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900">
                {budget ? "Edit Budget" : "Create Budget"} for{" "}
                {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
             <Input
                label="Total Monthly Budget"
                type="number"
                step="0.01"
                placeholder="0.00"
                error={errors.totalBudget?.message}
                {...register("totalBudget", { valueAsNumber: true })}
             />

             {/* Allocation Summary Box */}
             <div className={`p-4 rounded-xl border ${
                isOverBudget 
                ? "bg-red-50 border-red-200 text-red-800" 
                : "bg-blue-50 border-blue-200 text-blue-800"
             } flex justify-between items-center transition-colors duration-200`}>
                 <div>
                    <span className="block text-xs font-semibold uppercase opacity-75">
                        {isOverBudget ? "Overallocated by" : "Unallocated Amount"}
                    </span>
                    <span className="text-xl font-bold">
                        {formatCurrency(Math.abs(unallocated))}
                    </span>
                 </div>
                 <div className="text-right">
                    <span className="block text-xs font-semibold uppercase opacity-75">
                        Total Allocated
                    </span>
                    <span className="text-lg font-semibold">
                         {formatCurrency(totalAllocated)} / {formatCurrency(watchedTotalBudget)}
                    </span>
                 </div>
             </div>
             
             {errors.categoryBudgets?.message && ( // Global error for category budgets
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                    {errors.categoryBudgets.message}
                </div>
             )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Category Allocations</label>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={addCategoryBudget}
                  icon={<FiPlus className="h-3 w-3" />}
                >
                  Add Category
                </Button>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3">
                    <div className="flex-1">
                        <select
                        {...register(`categoryBudgets.${index}.category`)}
                        className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                        <option value="">Select category</option>
                        {categories.map((category) => (
                            <option key={category._id} value={category._id}>
                            {category.name}
                            </option>
                        ))}
                        </select>
                    </div>
                    <div className="w-32">
                        <input
                        type="number"
                        step="0.01"
                        {...register(`categoryBudgets.${index}.amount`, {
                            valueAsNumber: true,
                        })}
                        className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="0.00"
                        />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {fields.length === 0 && (
                     <div className="text-center py-6 text-slate-400 text-sm">
                        No specific category budgets added.
                        <br/>The total budget applies effectively to "Uncategorized".
                     </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
               <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={upsertMutation.isPending}
                disabled={isOverBudget} // Prevent submission if over budget (UI safeguard, in addition to validation)
              >
                {budget ? "Save Changes" : "Create Budget"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        // Budget Display
        <div className="space-y-6">
          {/* Overall Budget Progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    Monthly Overview
                  </h3>
                   <p className="text-sm text-slate-500">
                    {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                    })}
                   </p>
              </div>
              {budget && (
                 <button
                  onClick={startEditing}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <FiEdit className="h-4 w-4" />
                </button>
              )}
            </div>

            {budget ? (
              <div className="space-y-6">
                 {/* Main Progress Bar */}
                 <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex justify-between items-end mb-4">
                        <div>
                             <p className="text-sm font-medium text-slate-500 mb-1">Total Spent</p>
                             <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-sm font-medium text-slate-500 mb-1">Budget Limit</p>
                             <p className="text-xl font-semibold text-slate-700">{formatCurrency(budget.totalBudget)}</p>
                        </div>
                     </div>
                     
                    <div className="w-full bg-slate-200 rounded-full h-4 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(
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
                    <div className="flex justify-between text-xs font-medium">
                        <span className={getBudgetProgress(totalSpent, budget.totalBudget) > 100 ? "text-red-500" : "text-emerald-600"}>
                            {getBudgetProgress(totalSpent, budget.totalBudget).toFixed(1)}% Used
                        </span>
                        <span className="text-slate-500">
                            {formatCurrency(Math.max(0, budget.totalBudget - totalSpent))} Remaining
                        </span>
                    </div>
                 </div>
              </div>
            ) : (
                <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiTarget className="w-8 h-8 text-slate-400" />
               </div>
                <p className="text-slate-500 mb-6">
                  No budget set for this month. Take control of your finances now!
                </p>
                <Button onClick={startEditing}>
                  Create Budget
                </Button>
              </div>
            )}
          </Card>

          {/* Category Budgets */}
          {budget && budget.categoryBudgets.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">
                Category Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {budget.categoryBudgets.map((categoryBudget) => {
                  const spent =
                    spentByCategory[categoryBudget.category._id] || 0;
                  const progress = getBudgetProgress(
                    spent,
                    categoryBudget.amount
                  );

                  return (
                    <div key={categoryBudget.category._id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                             <span className="font-semibold text-slate-900 block">
                            {categoryBudget.category.name}
                            </span>
                            <span className="text-xs text-slate-500">
                                {formatCurrency(categoryBudget.amount)} Budget
                            </span>
                        </div>
                        <span
                            className={`text-sm font-bold ${
                              progress >= 100
                                ? "text-red-600"
                                : progress >= 90
                                ? "text-yellow-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {progress.toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(
                            progress
                          )}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      
                      <div className="text-xs text-right text-slate-500">
                          {formatCurrency(spent)} spent
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;
