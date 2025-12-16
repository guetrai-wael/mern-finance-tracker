// Transactions page with full CRUD functionality
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiEdit, FiTrash2, FiPlus, FiFilter, FiSearch, FiArrowUp, FiArrowDown } from "react-icons/fi";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/transactions";
import { getCategories } from "../services/categories";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import type { Transaction, TransactionInput } from "../types";

const transactionSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  type: z.enum(["income", "expense"], { required_error: "Type is required" }),
  category: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const TransactionsPage: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [filters, setFilters] = useState({
    type: "" as "" | "income" | "expense",
    startDate: "",
    endDate: "",
  });

  const queryClient = useQueryClient();

  // Queries
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.start = filters.startDate;
      if (filters.endDate) params.end = filters.endDate;
      return getTransactions(params);
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const transactions = transactionsData?.items || [];
  const categories = categoriesData?.categories || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "current-month"],
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "monthly-overview"],
      });
      setIsModalOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionInput }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "current-month"],
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "monthly-overview"],
      });
      setIsModalOpen(false);
      setEditingTransaction(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "current-month"],
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions", "monthly-overview"],
      });
    },
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    const transactionData: TransactionInput = {
      amount: data.amount,
      type: data.type,
      category: data.category || undefined,
      date: data.date ? new Date(data.date).toISOString() : undefined,
      description: data.description || undefined,
    };

    if (editingTransaction) {
      updateMutation.mutate({
        id: editingTransaction._id,
        data: transactionData,
      });
    } else {
      createMutation.mutate(transactionData);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setValue("amount", transaction.amount);
    setValue("type", transaction.type);
    setValue("category", transaction.category?._id || "");
    setValue("date", transaction.date.split("T")[0]);
    setValue("description", transaction.description || "");
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  const openModal = () => {
    setEditingTransaction(null);
    reset({
      type: "expense",
      date: new Date().toISOString().split("T")[0],
    });
    setIsModalOpen(true);
  };

  if (transactionsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track and manage your income and expenses
          </p>
        </div>
        <Button onClick={openModal} icon={<FiPlus className="w-4 h-4" />}>
          Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full sm:w-auto relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FiFilter className="h-4 w-4" />
                 </div>
                 <select
                    value={filters.type}
                    onChange={(e) =>
                    setFilters({
                        ...filters,
                        type: e.target.value as "" | "income" | "expense",
                    })
                    }
                    className="block w-full pl-10 pr-4 py-2 text-sm border-slate-200 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
            </div>
          
           <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                    }
                    className="block w-full px-4 py-2 text-sm border-slate-200 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Start Date"
                />
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                    }
                    className="block w-full px-4 py-2 text-sm border-slate-200 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                    placeholder="End Date"
                />
           </div>
          
          <Button
            variant="secondary"
            onClick={() => setFilters({ type: "", startDate: "", endDate: "" })}
            className="w-full sm:w-auto"
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Transactions Table/List */}
        <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 hidden md:table">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                            <FiSearch className="h-6 w-6 text-slate-400" />
                        </div>
                        <p>No transactions found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {transaction.description || "No description"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                             {transaction.category?.name || "Uncategorized"}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       {transaction.type === 'income' ? (
                           <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
                               <FiArrowUp className="w-3 h-3" /> Income
                           </span>
                       ) : (
                           <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
                               <FiArrowDown className="w-3 h-3" /> Expense
                           </span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      <span
                        className={
                          transaction.type === "income"
                            ? "text-emerald-600"
                            : "text-slate-900"
                        }
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction._id)}
                          className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                          disabled={deleteMutation.isPending}
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-slate-100">
            {transactions.length === 0 ? (
               <div className="p-8 text-center text-slate-500">
                    <p>No transactions found.</p>
               </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg ${transaction.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                             {transaction.type === 'income' ? <FiArrowUp className="w-4 h-4" /> : <FiArrowDown className="w-4 h-4" />}
                         </div>
                         <div>
                            <p className="font-semibold text-slate-900">{transaction.description || "No description"}</p>
                            <p className="text-xs text-slate-500">{new Date(transaction.date).toLocaleDateString()}</p>
                         </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        transaction.type === "income"
                          ? "text-emerald-600"
                          : "text-slate-900"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 text-sm">
                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {transaction.category?.name || "Uncategorized"}
                     </span>
                     <div className="flex space-x-3">
                        <button
                            onClick={() => handleEdit(transaction)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => handleDelete(transaction._id)}
                            className="text-red-600 hover:text-red-700 font-medium text-xs"
                        >
                            Delete
                        </button>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Add/Edit Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          reset();
        }}
        title={editingTransaction ? "Edit Transaction" : "New Transaction"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <input 
                        type="radio" 
                        id="type-income" 
                        value="income" 
                        {...register("type")} 
                        className="peer sr-only"
                    />
                    <label 
                        htmlFor="type-income"
                        className="flex items-center justify-center p-3 rounded-xl border border-slate-200 cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:text-emerald-600 peer-checked:bg-emerald-50 hover:bg-slate-50"
                    >
                        Income
                    </label>
                </div>
                <div className="relative">
                    <input 
                        type="radio" 
                        id="type-expense" 
                        value="expense" 
                        {...register("type")} 
                        className="peer sr-only"
                    />
                    <label 
                        htmlFor="type-expense"
                        className="flex items-center justify-center p-3 rounded-xl border border-slate-200 cursor-pointer transition-all peer-checked:border-red-500 peer-checked:text-red-600 peer-checked:bg-red-50 hover:bg-slate-50"
                    >
                        Expense
                    </label>
                </div>
            </div>
             {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <select 
                {...register("category")} 
                className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Date"
            type="date"
            {...register("date")}
          />

          <Input
            label="Description"
            placeholder="What was this for?"
            {...register("description")}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingTransaction(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingTransaction ? "Save Changes" : "Create Transaction"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
