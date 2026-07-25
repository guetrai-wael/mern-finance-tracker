import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiRepeat,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiPause,
  FiPlay,
  FiCalendar,
  FiArrowUpRight,
  FiArrowDownRight,
  FiRotateCcw,
} from "react-icons/fi";
import {
  getRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  undoRecurringGenerated,
} from "../services/recurring";
import { getCategories } from "../services/categories";
import { useCurrency } from "../hooks/useCurrency";
import { useToast } from "../hooks/useToast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import type { RecurringTransaction, RecurringInput } from "../types";

const recurringSchema = z.object({
  name: z.string().min(2, "Name is required").max(100, "Name is too long"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  type: z.enum(["income", "expense"]),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const today = () => new Date().toISOString().split("T")[0];

const RecurringPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringTransaction | null>(
    null
  );

  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const { showSuccess, showError } = useToast();

  const { data: recurringData, isLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn: getRecurring,
  });
  const rules = recurringData?.rules || [];

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories = categoriesData?.categories || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: { type: "expense", frequency: "monthly", startDate: today() },
  });

  // Generated transactions change too, so the transaction list must refetch.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const createMutation = useMutation({
    mutationFn: createRecurring,
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      reset();
      showSuccess("Recurring transaction created");
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.message || "Failed to create recurring transaction"
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringInput> }) =>
      updateRecurring(id, data),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setEditingRule(null);
      reset();
      showSuccess("Recurring transaction updated");
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.message || "Failed to update recurring transaction"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurring,
    onSuccess: () => {
      invalidate();
      showSuccess("Recurring transaction deleted");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to delete");
    },
  });

  const undoMutation = useMutation({
    mutationFn: undoRecurringGenerated,
    onSuccess: (result) => {
      invalidate();
      showSuccess(`Removed ${result.deleted} generated transaction(s)`);
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to undo");
    },
  });

  const onSubmit = (data: RecurringFormData) => {
    const payload: RecurringInput = {
      ...data,
      category: data.category || undefined,
      endDate: data.endDate || undefined,
      description: data.description || undefined,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openModal = () => {
    setEditingRule(null);
    reset({
      name: "",
      amount: undefined as unknown as number,
      type: "expense",
      frequency: "monthly",
      startDate: today(),
      endDate: "",
      category: "",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleEdit = (rule: RecurringTransaction) => {
    setEditingRule(rule);
    setValue("name", rule.name);
    setValue("amount", rule.amount);
    setValue("type", rule.type);
    setValue("frequency", rule.frequency);
    setValue("startDate", rule.startDate?.split("T")[0] || today());
    setValue("endDate", rule.endDate?.split("T")[0] || "");
    setValue("category", rule.category?._id || "");
    setValue("description", rule.description || "");
    setIsModalOpen(true);
  };

  const handleDelete = (rule: RecurringTransaction) => {
    if (
      confirm(
        `Delete "${rule.name}"? This stops future entries. Transactions already created are kept.`
      )
    ) {
      deleteMutation.mutate(rule._id);
    }
  };

  const handleUndo = (rule: RecurringTransaction) => {
    if (
      confirm(
        `Delete every transaction "${rule.name}" has already created? This cannot be undone.`
      )
    ) {
      undoMutation.mutate(rule._id);
    }
  };

  const togglePaused = (rule: RecurringTransaction) => {
    updateMutation.mutate({
      id: rule._id,
      data: { isActive: !rule.isActive },
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const activeRules = rules.filter((r) => r.isActive);
  const monthlyOutflow = activeRules
    .filter((r) => r.type === "expense" && r.frequency === "monthly")
    .reduce((sum, r) => sum + r.amount, 0);
  const monthlyInflow = activeRules
    .filter((r) => r.type === "income" && r.frequency === "monthly")
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rent, salary, subscriptions — entered once, posted automatically
          </p>
        </div>
        <Button onClick={openModal} icon={<FiPlus className="w-4 h-4" />}>
          Add Recurring
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <FiRepeat className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Rules</p>
            <p className="text-xl font-bold text-slate-900">
              {activeRules.length}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <FiArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Monthly In</p>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(monthlyInflow)}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <FiArrowDownRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Monthly Out</p>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(monthlyOutflow)}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rules.length === 0 ? (
          <div className="col-span-full">
            <Card className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiRepeat className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No recurring transactions
              </h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Set up the payments that repeat — rent, salary, subscriptions —
                and they'll be entered for you on schedule.
              </p>
              <Button onClick={openModal}>Add Your First One</Button>
            </Card>
          </div>
        ) : (
          rules.map((rule) => {
            const isIncome = rule.type === "income";
            return (
              <Card
                key={rule._id}
                className={`p-5 flex flex-col ${
                  rule.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {rule.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {FREQUENCY_LABELS[rule.frequency] || rule.frequency}
                      {rule.category ? ` · ${rule.category.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-bold whitespace-nowrap ${
                      isIncome ? "text-emerald-600" : "text-slate-900"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatCurrency(rule.amount)}
                  </span>
                </div>

                <div className="mt-4 flex items-center text-sm text-slate-500">
                  <FiCalendar className="w-4 h-4 mr-2 flex-shrink-0" />
                  {rule.isActive ? (
                    <span>
                      Next {new Date(rule.nextDue).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>Paused</span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePaused(rule)}
                    icon={
                      rule.isActive ? (
                        <FiPause className="w-4 h-4" />
                      ) : (
                        <FiPlay className="w-4 h-4" />
                      )
                    }
                  >
                    {rule.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(rule)}
                    icon={<FiEdit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title="Delete transactions this rule created"
                      onClick={() => handleUndo(rule)}
                      className="p-2 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <FiRotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete rule"
                      onClick={() => handleDelete(rule)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
          reset();
        }}
        title={editingRule ? "Edit Recurring" : "New Recurring"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Name"
            placeholder="e.g., Rent"
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register("amount", { valueAsNumber: true })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Type
              </label>
              <select
                className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
                {...register("type")}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Frequency
            </label>
            <select
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
              {...register("frequency")}
            >
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Starts"
              type="date"
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <Input
              label="Ends (optional)"
              type="date"
              error={errors.endDate?.message}
              {...register("endDate")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Category (optional)
            </label>
            <select
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
              {...register("category")}
            >
              <option value="">None</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={2}
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
              {...register("description")}
            />
          </div>

          <p className="text-xs text-slate-500">
            A start date in the past begins at the next upcoming occurrence — no
            back-dated entries are created.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingRule(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingRule ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecurringPage;
