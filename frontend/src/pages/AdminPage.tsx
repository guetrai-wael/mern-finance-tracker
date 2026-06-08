// Admin page with complete user management functionality
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiEdit,
  FiTrash2,
  FiDownload,
  FiUserCheck,
  FiUserX,
  FiKey,
  FiClock,
} from "react-icons/fi";
import {
  getUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
  exportUsers,
  extendSubscription,
} from "../services/users";
import { getSubscriptionInfo } from "../lib/subscription";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";
import { Modal } from "../components/common/Modal";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import type { User } from "../types";

const userUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["user", "admin"], { required_error: "Role is required" }),
  isActive: z.boolean(),
});

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/\d/, "Password must contain at least 1 number"),
});

type UserUpdateFormData = z.infer<typeof userUpdateSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const AdminPage: React.FC = () => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [extendUser, setExtendUser] = useState<User | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);

  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { user: currentAdmin, refreshUser } = useAuth();

  // Queries
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const users = usersData?.users || [];

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      updateUser(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      const adminId = currentAdmin?._id || currentAdmin?.id;
      if (adminId && variables.id === adminId) {
        refreshUser();
      }
      setIsEditModalOpen(false);
      setEditingUser(null);
      reset();
      showSuccess("User updated successfully");
    },
    onError: (error: any) => {
      console.error("Update user error:", error);
      showError(error?.response?.data?.message || "Failed to update user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteConfirmUser(null);
      showSuccess("User deleted successfully");
    },
    onError: (error: any) => {
      console.error("Delete user error:", error);
      showError(error?.response?.data?.message || "Failed to delete user");
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportUsers,
    onSuccess: (blob, format) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `users_export_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess(`Users exported as ${format.toUpperCase()} successfully`);
    },
    onError: (error: any) => {
      console.error("Export error:", error);
      showError(error?.response?.data?.message || "Failed to export users");
    },
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetPasswordForm,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = (data: UserUpdateFormData) => {
    if (!editingUser) return;

    const userId = editingUser._id || editingUser.id;
    console.log("Submitting edit for ID:", userId, "Data:", data);
    updateMutation.mutate({
      id: userId,
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      },
    });
  };

  const extendMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      extendSubscription(id, days),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // If the admin just extended their own account, refresh the auth
      // context so the new expiry is reflected in TrialBanner + ProtectedRoute
      // without forcing a hard reload.
      const adminId = currentAdmin?._id || currentAdmin?.id;
      if (adminId && variables.id === adminId) {
        refreshUser();
      }
      setExtendUser(null);
      setExtendDays(30);
      showSuccess("Subscription extended");
    },
    onError: (error: any) => {
      showError(error?.response?.data?.message || "Failed to extend subscription");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetUserPassword(id, newPassword),
    onSuccess: () => {
      setIsResetModalOpen(false);
      setResetUser(null);
      resetPasswordForm();
      showSuccess("Password reset successfully");
    },
    onError: (error: any) => {
      console.error("Reset password error:", error);
      showError(error?.response?.data?.message || "Failed to reset password");
    },
  });

  const handleEdit = (user: User) => {
    console.log("Editing user:", user);
    setEditingUser(user);
    setValue("name", user.name);
    setValue("email", user.email);
    setValue("role", user.role);
    setValue("isActive", user.isActive);
    setIsEditModalOpen(true);
  };

  const handleDelete = (user: User) => {
    console.log("Deleting user:", user);
    setDeleteConfirmUser(user);
  };

  const handleResetPassword = (user: User) => {
    setResetUser(user);
    setIsResetModalOpen(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmUser) {
      const userId = deleteConfirmUser._id || deleteConfirmUser.id;
      console.log("Confirming delete for ID:", userId);
      deleteMutation.mutate(userId);
    }
  };

  const onResetPassword = (data: ResetPasswordFormData) => {
    if (!resetUser) return;

    const userId = resetUser._id || resetUser.id;
    resetPasswordMutation.mutate({ id: userId, newPassword: data.newPassword });
  };

  const toggleUserStatus = (user: User) => {
    const userId = user._id || user.id;
    console.log("Toggling user status for ID:", userId, "User object:", user);
    updateMutation.mutate({
      id: userId,
      data: { isActive: !user.isActive },
    });
  };

  const handleExport = (format: "csv" | "json") => {
    exportMutation.mutate(format);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage users and export data
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => handleExport("csv")}
              isLoading={exportMutation.isPending}
              icon={<FiDownload className="h-4 w-4" />}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport("json")}
              isLoading={exportMutation.isPending}
              icon={<FiDownload className="h-4 w-4" />}
            >
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Users</h3>
          <p className="text-sm text-slate-500">Total users: {users.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id || user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-slate-500">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        // Shared with App.tsx, TrialBanner, SubscriptionPage —
                        // see lib/subscription.ts. Never re-implement this rule.
                        const info = getSubscriptionInfo(user);
                        const { status, daysRemaining: days, isEffectivelyActive } = info;

                        const pill =
                          status === "deactivated"
                            ? { label: "Deactivated", cls: "bg-red-100 text-red-700" }
                            : status === "expired"
                            ? { label: "Expired", cls: "bg-amber-100 text-amber-700" }
                            : { label: "Active", cls: "bg-emerald-100 text-emerald-700" };

                        return (
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${pill.cls}`}
                            >
                              {pill.label}
                            </span>
                            {days !== null && (
                              <span className={`text-xs ${
                                info.isExpired ? "text-red-600 font-medium" :
                                isEffectivelyActive && days <= 7 ? "text-amber-600 font-medium" :
                                "text-slate-500"
                              }`}>
                                {info.isExpired
                                  ? `Expired ${Math.abs(days)}d ago`
                                  : `${days}d left`}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          disabled={updateMutation.isPending}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.isActive
                              ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={
                            user.isActive ? "Deactivate user" : "Activate user"
                          }
                        >
                          {user.isActive ? (
                            <FiUserX className="h-4 w-4" />
                          ) : (
                            <FiUserCheck className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setExtendUser(user); setExtendDays(30); }}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Extend subscription"
                        >
                          <FiClock className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Reset password"
                        >
                          <FiKey className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          disabled={deleteMutation.isPending}
                          title="Delete user"
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
        </div>
      </Card>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingUser(null);
          reset();
        }}
        title={`Edit User: ${editingUser?.name}`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
           <Input
            label="Name"
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select 
                {...register("role")} 
                className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <p className="text-red-500 text-sm mt-1">
                {errors.role.message}
              </p>
            )}
          </div>

          <div className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="isActive"
              {...register("isActive")}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded"
            />
            <label htmlFor="isActive" className="ml-3 block text-sm font-medium text-slate-900 cursor-pointer select-none">
              Account Active
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingUser(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => {
          setIsResetModalOpen(false);
          setResetUser(null);
          resetPasswordForm();
        }}
        title={`Reset Password: ${resetUser?.name || ""}`}
      >
        <form onSubmit={handleResetSubmit(onResetPassword)} className="space-y-5">
          <Input
            label="New Password"
            type="password"
            error={resetErrors.newPassword?.message}
            {...registerReset("newPassword")}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsResetModalOpen(false);
                setResetUser(null);
                resetPasswordForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={resetPasswordMutation.isPending}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Extend Subscription Modal */}
      <Modal
        isOpen={!!extendUser}
        onClose={() => setExtendUser(null)}
        title={`Extend subscription: ${extendUser?.name || ""}`}
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            {extendUser?.expiresAt
              ? (() => {
                  const days = Math.ceil(
                    (new Date(extendUser.expiresAt).getTime() - Date.now()) / 86400000
                  );
                  return days < 0
                    ? `Currently expired ${Math.abs(days)} day(s) ago. New expiry will be ${extendDays} days from today.`
                    : `Currently ${days} day(s) left. Adding ${extendDays} days will stack onto the existing expiry.`;
                })()
              : `New expiry will be ${extendDays} days from today.`}
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Days to add
            </label>
            <div className="flex gap-2">
              {[7, 30, 60, 90].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setExtendDays(preset)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    extendDays === preset
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset}d
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setExtendUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (extendUser) {
                  const id = extendUser._id || extendUser.id;
                  extendMutation.mutate({ id, days: extendDays });
                }
              }}
              isLoading={extendMutation.isPending}
            >
              Extend {extendDays} days
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
            <div className="p-4 bg-red-50 text-red-800 rounded-xl border border-red-100 text-sm">
                <div className="flex gap-2">
                    <FiTrash2 className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-semibold mb-1">Permanent Action</p>
                        <p>
                        Are you sure you want to delete <strong>{deleteConfirmUser?.name}</strong>?
                        This action cannot be undone and will permanently remove all data associated with this user.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirmUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                isLoading={deleteMutation.isPending}
              >
                Delete User
              </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPage;
