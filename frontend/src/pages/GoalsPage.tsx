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
  FiPieChart,
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
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
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
    if (percentage >= 100) return "bg-emerald-500";
    if (percentage >= 75) return "bg-teal-500";
    if (percentage >= 50) return "bg-cyan-500";
    return "bg-slate-300";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      case "low": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "emergency": return "🚨";
      case "vacation": return "✈️";
      case "house": return "🏠";
      case "car": return "🚗";
      case "retirement": return "👴";
      case "education": return "🎓";
      default: return "🎯";
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Financial Goals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track and achieve your financial objectives
          </p>
        </div>
        <Button onClick={openModal} icon={<FiPlus className="w-4 h-4" />}>
          Add Goal
        </Button>
      </div>

      {/* Goals Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
               <FiTarget className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Goals</p>
              <p className="text-xl font-bold text-slate-900">{totalGoals}</p>
            </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
               <FiTrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="text-xl font-bold text-slate-900">{completedGoals}</p>
            </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
               <FiDollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Saved</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalCurrentAmount)}</p>
            </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
               <FiPieChart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Progress</p>
              <p className="text-xl font-bold text-slate-900">{overallProgress.toFixed(1)}%</p>
            </div>
        </Card>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full">
            <Card className="text-center py-16">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiTarget className="w-8 h-8 text-slate-400" />
               </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No active goals</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Setting financial goals is the first step to financial freedom. Start by creating a simple savings goal.
              </p>
              <Button onClick={openModal}>
                Create Your First Goal
              </Button>
            </Card>
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
              <Card key={goal._id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl bg-slate-50 p-2 rounded-xl border border-slate-100">
                      {getCategoryIcon(goal.category)}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
                        {goal.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border ${getPriorityColor(goal.priority)}`}>
                            {goal.priority}
                           </span>
                           {isOverdue && (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md bg-red-100 text-red-700 border border-red-200">
                                Overdue
                            </span>
                           )}
                      </div>
                    </div>
                  </div>
                  <div className="flex -space-x-1">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <FiEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                   {goal.description && (
                        <p className="text-sm text-slate-500 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Progress</span>
                        <span className="font-bold text-slate-700">
                            {progress.toFixed(0)}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>

                  {goal.targetDate && (
                    <div className="flex items-center text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                       <FiCalendar className="mr-2 text-slate-400" />
                       Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                 <div className="mt-6 pt-4 border-t border-slate-50">
                     {goal.isCompleted ? (
                         <div className="w-full py-2 bg-emerald-50 text-emerald-700 text-center rounded-xl text-sm font-bold border border-emerald-100">
                             Goal Completed! 🎉
                         </div>
                     ) : (
                        <Button
                            variant="secondary"
                            fullWidth
                            size="sm"
                            onClick={() => handleContribute(goal)}
                        >
                            Add Contribution
                        </Button>
                     )}
                 </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Goal Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
          reset();
        }}
        title={editingGoal ? "Edit Goal" : "New Goal"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Goal Name"
            placeholder="e.g., Dream Vacation"
            error={errors.name?.message}
            {...register("name")}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              {...register("description")}
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
              rows={2}
              placeholder="Optional details..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target Amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                error={errors.targetAmount?.message}
                {...register("targetAmount", { valueAsNumber: true })}
              />
              
              <Input
                label="Target Date"
                type="date"
                {...register("targetDate")}
              />
          </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                <select {...register("category")} className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5">
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <select {...register("priority")} className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
                variant="secondary"
                type="button"
                onClick={() => {
                    setIsModalOpen(false);
                    setEditingGoal(null);
                    reset();
                }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingGoal ? "Save Changes" : "Create Goal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Contribution Modal */}
      {selectedGoal && (
        <Modal
          isOpen={isContributionModalOpen}
          onClose={() => {
            setIsContributionModalOpen(false);
            setSelectedGoal(null);
            resetContribution();
          }}
          title={`Add to "${selectedGoal.name}"`}
          size="sm"
        >
          <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
            <div className="flex justify-between text-sm text-slate-500 mb-2">
                <span>Current Progress</span>
                <span>{(getProgressPercentage(selectedGoal.currentAmount, selectedGoal.targetAmount)).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
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
              <p className="text-center mt-2 font-semibold text-slate-700">
              {formatCurrency(selectedGoal.currentAmount)} <span className="text-slate-400 font-normal">/ {formatCurrency(selectedGoal.targetAmount)}</span>
            </p>
          </div>

          <form
            onSubmit={handleContributionSubmit(onContributionSubmit)}
            className="space-y-4"
          >
            <Input
              label="Amount to Add"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={contributionErrors.amount?.message}
              {...registerContribution("amount", { valueAsNumber: true })}
              autoFocus
            />

            <Input
              label="Note (Optional)"
              placeholder="e.g., Monthly savings"
              {...registerContribution("description")}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                      setIsContributionModalOpen(false);
                      setSelectedGoal(null);
                      resetContribution();
                  }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={contributionMutation.isPending}
              >
                Confirm Contribution
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default GoalsPage;
