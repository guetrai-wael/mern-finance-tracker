// Financial Goals page with tracking and management
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiTarget,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiDollarSign,
  FiCalendar,
  FiTrendingUp,
} from "react-icons/fi";
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalContribution,
} from "../services/goals";
import { useCurrency } from "../hooks/useCurrency";
import { useToast } from "../hooks/useToast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import type { Goal, GoalInput, GoalContribution } from "../types";

const goalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().optional(),
  targetAmount: z.number().min(0.01, "Target amount must be greater than 0"),
  targetDate: z.string().optional(),
  category: z.enum([
    "emergency",
    "vacation",
    "house",
    "car",
    "retirement",
    "education",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high"]),
});

const contributionSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;
type ContributionFormData = z.infer<typeof contributionSchema>;

const GoalsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const { formatCurrency } = useCurrency();

  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // Queries
  const { data: goalsData, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: getGoals,
  });

  const goals = goalsData?.goals || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setIsModalOpen(false);
      reset();
      showSuccess("Goal created successfully");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to create goal");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GoalInput> }) =>
      updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setIsModalOpen(false);
      setEditingGoal(null);
      reset();
      showSuccess("Goal updated successfully");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to update goal");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      showSuccess("Goal deleted successfully");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to delete goal");
    },
  });

  const contributionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GoalContribution }) =>
      addGoalContribution(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setIsContributionModalOpen(false);
      setSelectedGoal(null);
      resetContribution();
      showSuccess("Contribution added successfully");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to add contribution");
    },
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      category: "other",
      priority: "medium",
    },
  });

  const {
    register: registerContribution,
    handleSubmit: handleContributionSubmit,
    reset: resetContribution,
    formState: { errors: contributionErrors },
  } = useForm<ContributionFormData>({
    resolver: zodResolver(contributionSchema),
  });

  const onSubmit = (data: GoalFormData) => {
    const goalData: GoalInput = {
      name: data.name,
      description: data.description || undefined,
      targetAmount: data.targetAmount,
      targetDate: data.targetDate || undefined,
      category: data.category,
      priority: data.priority,
    };

    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal._id, data: goalData });
    } else {
      createMutation.mutate(goalData);
    }
  };

  const onContributionSubmit = (data: ContributionFormData) => {
    if (!selectedGoal) return;

    contributionMutation.mutate({
      id: selectedGoal._id,
      data: {
        amount: data.amount,
        description: data.description || undefined,
      },
    });
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setValue("name", goal.name);
    setValue("description", goal.description || "");
    setValue("targetAmount", goal.targetAmount);
    setValue("targetDate", goal.targetDate?.split("T")[0] || "");
    setValue("category", goal.category);
    setValue("priority", goal.priority);
    setIsModalOpen(true);
  };

  const handleDelete = (goal: Goal) => {
    if (
      confirm(
        `Are you sure you want to delete the goal "${goal.name}"? This action cannot be undone.`
      )
    ) {
      deleteMutation.mutate(goal._id);
    }
  };

  const handleContribute = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsContributionModalOpen(true);
  };

  const openModal = () => {
    setEditingGoal(null);
    reset({
      category: "other",
      priority: "medium",
    });
    setIsModalOpen(true);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "emergency":
        return "🚨";
      case "vacation":
        return "✈️";
      case "house":
        return "🏠";
      case "car":
        return "🚗";
      case "retirement":
        return "👴";
      case "education":
        return "🎓";
      default:
        return "🎯";
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Calculate totals
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.isCompleted).length;
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress =
    totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Financial Goals
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Track and achieve your financial objectives
            </p>
          </div>
          <button
            onClick={openModal}
            className="btn-primary flex items-center space-x-2"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add Goal</span>
          </button>
        </div>
      </div>

      {/* Goals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 bg-blue-100 rounded-md">
                <FiTarget className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Goals</p>
              <p className="text-lg font-semibold text-gray-900">
                {totalGoals}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 bg-green-100 rounded-md">
                <FiTrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-lg font-semibold text-gray-900">
                {completedGoals}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 bg-purple-100 rounded-md">
                <FiDollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Saved</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(totalCurrentAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 bg-orange-100 rounded-md">
                <FiCalendar className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Progress</p>
              <p className="text-lg font-semibold text-gray-900">
                {overallProgress.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full">
            <div className="card text-center py-12">
              <FiTarget className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">
                No financial goals yet. Create your first goal to start tracking
                your progress!
              </p>
              <button onClick={openModal} className="btn-primary">
                Create Your First Goal
              </button>
            </div>
          </div>
        ) : (
          goals.map((goal) => {
            const progress = getProgressPercentage(
              goal.currentAmount,
              goal.targetAmount
            );
            const isOverdue =
              goal.targetDate &&
              new Date(goal.targetDate) < new Date() &&
              !goal.isCompleted;

            return (
              <div key={goal._id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {getCategoryIcon(goal.category)}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {goal.name}
                      </h3>
                      {goal.description && (
                        <p className="text-sm text-gray-600">
                          {goal.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="text-blue-600 hover:text-blue-500 p-1"
                      title="Edit goal"
                    >
                      <FiEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal)}
                      className="text-red-600 hover:text-red-500 p-1"
                      title="Delete goal"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                        goal.priority
                      )}`}
                    >
                      {goal.priority} priority
                    </span>
                    {goal.isCompleted && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Completed ✓
                      </span>
                    )}
                    {isOverdue && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">
                        {formatCurrency(goal.currentAmount)} /{" "}
                        {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(
                          progress
                        )}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{progress.toFixed(1)}% complete</span>
                      <span>
                        {formatCurrency(goal.targetAmount - goal.currentAmount)}{" "}
                        remaining
                      </span>
                    </div>
                  </div>

                  {goal.targetDate && (
                    <p className="text-xs text-gray-500">
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </p>
                  )}

                  {!goal.isCompleted && (
                    <button
                      onClick={() => handleContribute(goal)}
                      className="w-full btn-secondary text-sm"
                    >
                      Add Contribution
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingGoal ? "Edit Goal" : "Add New Goal"}
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="form-label">Goal Name *</label>
                <input
                  type="text"
                  {...register("name")}
                  className="form-input"
                  placeholder="e.g., Emergency Fund, Vacation, New Car"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  {...register("description")}
                  className="form-input"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="form-label">Target Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("targetAmount", { valueAsNumber: true })}
                  className="form-input"
                  placeholder="10000"
                />
                {errors.targetAmount && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.targetAmount.message}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Target Date</label>
                <input
                  type="date"
                  {...register("targetDate")}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Category *</label>
                <select {...register("category")} className="form-input">
                  <option value="emergency">Emergency Fund</option>
                  <option value="vacation">Vacation</option>
                  <option value="house">House/Property</option>
                  <option value="car">Car/Vehicle</option>
                  <option value="retirement">Retirement</option>
                  <option value="education">Education</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="form-label">Priority *</label>
                <select {...register("priority")} className="form-input">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingGoal(null);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingGoal
                    ? "Update Goal"
                    : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {isContributionModalOpen && selectedGoal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add Contribution to "{selectedGoal.name}"
            </h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">Current Progress:</p>
              <p className="text-lg font-semibold">
                {formatCurrency(selectedGoal.currentAmount)} /{" "}
                {formatCurrency(selectedGoal.targetAmount)}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(
                    getProgressPercentage(
                      selectedGoal.currentAmount,
                      selectedGoal.targetAmount
                    )
                  )}`}
                  style={{
                    width: `${getProgressPercentage(
                      selectedGoal.currentAmount,
                      selectedGoal.targetAmount
                    )}%`,
                  }}
                />
              </div>
            </div>

            <form
              onSubmit={handleContributionSubmit(onContributionSubmit)}
              className="space-y-4"
            >
              <div>
                <label className="form-label">Contribution Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  {...registerContribution("amount", { valueAsNumber: true })}
                  className="form-input"
                  placeholder="100.00"
                />
                {contributionErrors.amount && (
                  <p className="text-red-500 text-sm mt-1">
                    {contributionErrors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  {...registerContribution("description")}
                  className="form-input"
                  placeholder="e.g., Monthly savings, Bonus contribution"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsContributionModalOpen(false);
                    setSelectedGoal(null);
                    resetContribution();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contributionMutation.isPending}
                  className="btn-primary"
                >
                  {contributionMutation.isPending
                    ? "Adding..."
                    : "Add Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;
