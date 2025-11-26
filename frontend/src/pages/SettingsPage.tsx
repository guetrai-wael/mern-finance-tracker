// User settings page with profile management, currency selection, and data export
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiUser,
  FiLock,
  FiDownload,
  FiDollarSign,
  FiSave,
  FiTrash2,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../hooks/useCurrency";
import { useToast } from "../hooks/useToast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import {
  updateProfile,
  changePassword,
  getUserSettings,
  updateUserSettingsAndContext,
  exportUserData,
  deleteAccount,
} from "../services/settings";

// Form schemas
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const currencySchema = z.object({
  currency: z.enum(["USD", "EUR", "TND"], {
    required_error: "Please select a currency",
  }),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type CurrencyFormData = z.infer<typeof currencySchema>;

const currencyOptions = [
  { value: "USD", label: "US Dollar ($)", symbol: "$" },
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "TND", label: "Tunisian Dinar (د.ت)", symbol: "د.ت" },
];

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { setCurrency } = useCurrency();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Forms
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const currencyForm = useForm<CurrencyFormData>({
    resolver: zodResolver(currencySchema),
  });

  // Queries
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: getUserSettings,
  });

  // Set currency form default value when settings load
  React.useEffect(() => {
    if (settingsData?.settings?.currency) {
      currencyForm.setValue("currency", settingsData.settings.currency);
    }
  }, [settingsData, currencyForm]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      showSuccess("Profile updated successfully!");
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || "Failed to update profile");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      showSuccess("Password changed successfully!");
      passwordForm.reset();
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || "Failed to change password");
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: Partial<{ currency: "USD" | "EUR" | "TND" }>) =>
      updateUserSettingsAndContext(settings, setCurrency, refreshUser),
    onSuccess: () => {
      showSuccess("Settings updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || "Failed to update settings");
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: exportUserData,
    onSuccess: (blob, format) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess(`Data exported successfully as ${format.toUpperCase()}!`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || "Failed to export data");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      showSuccess("Account deleted successfully");
      // Redirect will happen automatically through auth context
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || "Failed to delete account");
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: PasswordFormData) => {
    const { confirmPassword, ...passwordData } = data;
    changePasswordMutation.mutate(passwordData);
  };

  const handleCurrencySubmit = (data: CurrencyFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleExportData = (format: "csv" | "json") => {
    exportDataMutation.mutate(format);
  };

  const handleDeleteAccount = () => {
    if (showDeleteConfirm) {
      deleteAccountMutation.mutate();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  if (settingsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="p-6 space-y-8">
          {/* Profile Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FiUser className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Profile Information
              </h2>
            </div>

            <form
              onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
              className="space-y-4"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    {...profileForm.register("name")}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your name"
                  />
                  {profileForm.formState.errors.name && (
                    <p className="text-red-600 text-sm mt-1">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    {...profileForm.register("email")}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                  {profileForm.formState.errors.email && (
                    <p className="text-red-600 text-sm mt-1">
                      {profileForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending
                  ? "Updating..."
                  : "Update Profile"}
              </button>
            </form>
          </div>

          {/* Password Settings */}
          <div className="space-y-4 pt-8 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <FiLock className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Change Password
              </h2>
            </div>

            <form
              onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
              className="space-y-4"
            >
              <div className="grid md:grid-cols-1 gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      {...passwordForm.register("currentPassword")}
                      type={showCurrentPassword ? "text" : "password"}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? (
                        <FiEyeOff className="w-4 h-4" />
                      ) : (
                        <FiEye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-red-600 text-sm mt-1">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      {...passwordForm.register("newPassword")}
                      type={showNewPassword ? "text" : "password"}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? (
                        <FiEyeOff className="w-4 h-4" />
                      ) : (
                        <FiEye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-red-600 text-sm mt-1">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      {...passwordForm.register("confirmPassword")}
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <FiEyeOff className="w-4 h-4" />
                      ) : (
                        <FiEye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-red-600 text-sm mt-1">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiLock className="w-4 h-4 mr-2" />
                {changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change Password"}
              </button>
            </form>
          </div>

          {/* Currency Settings */}
          <div className="space-y-4 pt-8 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <FiDollarSign className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Currency Preference
              </h2>
            </div>

            <form
              onSubmit={currencyForm.handleSubmit(handleCurrencySubmit)}
              className="space-y-4"
            >
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Currency
                </label>
                <select
                  {...currencyForm.register("currency")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {currencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {currencyForm.formState.errors.currency && (
                  <p className="text-red-600 text-sm mt-1">
                    {currencyForm.formState.errors.currency.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending
                  ? "Updating..."
                  : "Update Currency"}
              </button>
            </form>
          </div>

          {/* Data Export */}
          <div className="space-y-4 pt-8 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <FiDownload className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Export Your Data
              </h2>
            </div>

            <p className="text-gray-600">
              Download all your transaction data in CSV or JSON format.
            </p>

            <div className="flex space-x-4">
              <button
                onClick={() => handleExportData("csv")}
                disabled={exportDataMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiDownload className="w-4 h-4 mr-2" />
                {exportDataMutation.isPending ? "Exporting..." : "Export CSV"}
              </button>

              <button
                onClick={() => handleExportData("json")}
                disabled={exportDataMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiDownload className="w-4 h-4 mr-2" />
                {exportDataMutation.isPending ? "Exporting..." : "Export JSON"}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-8 border-t border-red-200">
            <div className="flex items-center space-x-2">
              <FiTrash2 className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-semibold text-red-900">
                Danger Zone
              </h2>
            </div>

            <p className="text-red-600">
              Once you delete your account, there is no going back. Please be
              certain.
            </p>

            <button
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className={`inline-flex items-center px-4 py-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                showDeleteConfirm
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-100 hover:bg-red-200 text-red-800"
              }`}
            >
              <FiTrash2 className="w-4 h-4 mr-2" />
              {deleteAccountMutation.isPending
                ? "Deleting..."
                : showDeleteConfirm
                ? "Confirm Delete Account"
                : "Delete Account"}
            </button>

            {showDeleteConfirm && (
              <div className="text-sm text-red-600">
                Click again to permanently delete your account and all data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
