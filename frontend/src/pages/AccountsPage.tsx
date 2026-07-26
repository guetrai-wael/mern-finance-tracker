import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiCreditCard,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiStar,
  FiArchive,
  FiDollarSign,
  FiHome,
  FiTrendingUp,
} from "react-icons/fi";
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  setDefaultAccount,
} from "../services/accounts";
import { useCurrency } from "../hooks/useCurrency";
import { useToast } from "../hooks/useToast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import type { Account, AccountInput, AccountType } from "../types";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Name is too long"),
  type: z.enum(["cash", "bank", "card", "savings"]),
  openingBalance: z.number(),
});

type AccountFormData = z.infer<typeof accountSchema>;

const TYPE_META: Record<
  AccountType,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  bank: { label: "Bank", icon: FiHome, tone: "bg-blue-100 text-blue-600" },
  cash: { label: "Cash", icon: FiDollarSign, tone: "bg-emerald-100 text-emerald-600" },
  card: { label: "Card", icon: FiCreditCard, tone: "bg-purple-100 text-purple-600" },
  savings: { label: "Savings", icon: FiTrendingUp, tone: "bg-amber-100 text-amber-600" },
};

const AccountsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const { showSuccess, showError } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", showArchived],
    queryFn: () => getAccounts(showArchived),
  });
  const accounts = data?.accounts || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { type: "bank", openingBalance: 0 },
  });

  // Balances are derived from transactions, so a change here can move numbers
  // on the dashboard and in reports too.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      reset();
      showSuccess("Account created");
    },
    onError: (error: any) =>
      showError(error?.response?.data?.message || "Failed to create account"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: Partial<AccountInput> }) =>
      updateAccount(id, payload),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setEditingAccount(null);
      reset();
      showSuccess("Account updated");
    },
    onError: (error: any) =>
      showError(error?.response?.data?.message || "Failed to update account"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      invalidate();
      showSuccess("Account deleted");
    },
    onError: (error: any) =>
      showError(error?.response?.data?.message || "Failed to delete account"),
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultAccount,
    onSuccess: () => {
      invalidate();
      showSuccess("Default account updated");
    },
    onError: (error: any) =>
      showError(error?.response?.data?.message || "Failed to set default"),
  });

  const onSubmit = (formData: AccountFormData) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openModal = () => {
    setEditingAccount(null);
    reset({ name: "", type: "bank", openingBalance: 0 });
    setIsModalOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setValue("name", account.name);
    setValue("type", account.type);
    setValue("openingBalance", account.openingBalance);
    setIsModalOpen(true);
  };

  const handleDelete = (account: Account) => {
    if (confirm(`Delete "${account.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(account._id);
    }
  };

  const toggleArchived = (account: Account) => {
    updateMutation.mutate({
      id: account._id,
      data: { isArchived: !account.isArchived },
    });
  };

  if (isLoading) return <LoadingSpinner />;

  const netWorth = accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Where your money actually sits
          </p>
        </div>
        <Button onClick={openModal} icon={<FiPlus className="w-4 h-4" />}>
          Add Account
        </Button>
      </div>

      <Card className="p-6">
        <p className="text-sm font-medium text-slate-500">Net Worth</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {formatCurrency(netWorth)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Total across {accounts.filter((a) => !a.isArchived).length} active
          account(s)
        </p>
      </Card>

      <div className="flex items-center justify-end">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          Show archived
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.length === 0 ? (
          <div className="col-span-full">
            <Card className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCreditCard className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No accounts yet
              </h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Add your bank account, cash, and cards to see where your money
                is, not just how much of it there is.
              </p>
              <Button onClick={openModal}>Add Your First Account</Button>
            </Card>
          </div>
        ) : (
          accounts.map((account) => {
            const meta = TYPE_META[account.type] || TYPE_META.bank;
            const Icon = meta.icon;
            const negative = account.balance < 0;

            return (
              <Card
                key={account._id}
                className={`p-5 flex flex-col ${account.isArchived ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl ${meta.tone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        {account.name}
                        {account.isDefault && (
                          <FiStar
                            className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                            title="Default account"
                          />
                        )}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {meta.label}
                        {account.isArchived ? " · Archived" : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-slate-500">Balance</p>
                  <p
                    className={`text-2xl font-bold ${
                      negative ? "text-red-600" : "text-slate-900"
                    }`}
                  >
                    {formatCurrency(account.balance)}
                  </p>
                  {account.openingBalance !== 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Started at {formatCurrency(account.openingBalance)}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1">
                  {!account.isDefault && !account.isArchived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => defaultMutation.mutate(account._id)}
                      icon={<FiStar className="w-4 h-4" />}
                    >
                      Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(account)}
                    icon={<FiEdit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={account.isArchived ? "Unarchive" : "Archive"}
                      onClick={() => toggleArchived(account)}
                      className="p-2 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <FiArchive className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(account)}
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
          setEditingAccount(null);
          reset();
        }}
        title={editingAccount ? "Edit Account" : "New Account"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Name"
            placeholder="e.g., Checking"
            error={errors.name?.message}
            {...register("name")}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Type
            </label>
            <select
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
              {...register("type")}
            >
              {(Object.keys(TYPE_META) as AccountType[]).map((key) => (
                <option key={key} value={key}>
                  {TYPE_META[key].label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Opening balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.openingBalance?.message}
            {...register("openingBalance", { valueAsNumber: true })}
          />
          <p className="-mt-3 text-xs text-slate-500">
            What was already in this account before you started tracking. Leave
            at 0 if your transaction history covers everything. Use a negative
            number for money owed on a card.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingAccount(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingAccount ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AccountsPage;
