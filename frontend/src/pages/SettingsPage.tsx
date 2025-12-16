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

  FiSave,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiShield,
  FiCreditCard,
  FiLogOut
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../hooks/useCurrency";
import { useToast } from "../hooks/useToast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
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

type SettingsTab = "profile" | "security" | "preferences" | "data" | "danger";

const SettingsPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { setCurrency } = useCurrency();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
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
    onSuccess: () => {
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

  const renderTabButton = (tab: SettingsTab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === tab
          ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className={`text-xl ${activeTab === tab ? "text-primary-600" : "text-slate-400"}`}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      {activeTab === tab && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600" />
      )}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
       <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information, security, and app preferences.
          </p>
        </div>

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-6">
              <Card className="p-4 border-slate-200 shadow-sm">
                 <div className="flex items-center space-x-3 mb-6 p-2 pb-6 border-b border-slate-100">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-xl shadow-inner">
                        {user?.name?.charAt(0).toUpperCase() || <FiUser />}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="font-bold text-slate-900 truncate">{user?.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                 </div>
                 
                 <nav className="space-y-2">
                    {renderTabButton("profile", "Profile", <FiUser />)}
                    {renderTabButton("security", "Security", <FiShield />)}
                    {renderTabButton("preferences", "Preferences", <FiCreditCard />)}
                    {renderTabButton("data", "Data & Export", <FiDownload />)}
                    {renderTabButton("danger", "Danger Zone", <FiTrash2 />)}
                 </nav>

                 <div className="mt-6 pt-6 border-t border-slate-100">
                    <button 
                        onClick={() => logout()}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <FiLogOut className="text-lg" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                 </div>
              </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
              {/* Profile Settings */}
              {activeTab === "profile" && (
                <Card className="p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FiUser className="text-primary-600" />
                            Personal Information
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 pl-7">
                            Update your public profile and contact details.
                        </p>
                    </div>

                    <form
                    onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
                    className="space-y-6 max-w-2xl"
                    >
                        <Input
                            label="Full Name"
                            placeholder="e.g. John Doe"
                            error={profileForm.formState.errors.name?.message}
                            {...profileForm.register("name")}
                        />

                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="john@example.com"
                            error={profileForm.formState.errors.email?.message}
                            {...profileForm.register("email")}
                        />

                        <div className="flex justify-end pt-4">
                            <Button
                                type="submit"
                                isLoading={updateProfileMutation.isPending}
                                icon={<FiSave className="w-4 h-4" />}
                            >
                            Save Changes
                            </Button>
                        </div>
                    </form>
                </Card>
              )}

              {/* Security Settings */}
              {activeTab === "security" && (
                <Card className="p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FiShield className="text-emerald-600" />
                            Password & Security
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 pl-7">
                            Ensure your account stays safe with a strong password.
                        </p>
                    </div>

                    <form
                    onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                    className="space-y-6 max-w-2xl"
                    >
                         <div className="relative">
                            <Input
                                    label="Current Password"
                                    type={showCurrentPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    error={passwordForm.formState.errors.currentPassword?.message}
                                    {...passwordForm.register("currentPassword")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute top-[34px] right-3 text-slate-400 hover:text-slate-600 p-1"
                                >
                                        {showCurrentPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                    <div className="relative">
                                    <Input
                                        label="New Password"
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        error={passwordForm.formState.errors.newPassword?.message}
                                        {...passwordForm.register("newPassword")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute top-[34px] right-3 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                            {showNewPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                    </button>
                                </div>
                                
                                    <div className="relative">
                                    <Input
                                        label="Confirm Password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        error={passwordForm.formState.errors.confirmPassword?.message}
                                        {...passwordForm.register("confirmPassword")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute top-[34px] right-3 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                            {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                        <div className="flex justify-end pt-4">
                            <Button
                            type="submit"
                            disabled={changePasswordMutation.isPending}
                            variant="secondary"
                            icon={<FiLock className="w-4 h-4" />}
                            >
                            Update Password
                            </Button>
                        </div>
                    </form>
                </Card>
              )}

              {/* Preferences Settings */}
              {activeTab === "preferences" && (
                <Card className="p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FiCreditCard className="text-amber-600" />
                            App Preferences
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 pl-7">
                            Customize your currency and viewing options.
                        </p>
                    </div>

                    <form
                    onSubmit={currencyForm.handleSubmit(handleCurrencySubmit)}
                    className="space-y-6 max-w-2xl"
                    >
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                        Display Currency
                        </label>
                        <select
                        {...currencyForm.register("currency")}
                        className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5"
                        >
                        {currencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                            {option.label}
                            </option>
                        ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                            This will update how all monetary values are displayed throughout the application.
                        </p>
                        {currencyForm.formState.errors.currency && (
                        <p className="text-red-500 text-sm mt-1">
                            {currencyForm.formState.errors.currency.message}
                        </p>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            isLoading={updateSettingsMutation.isPending}
                        >
                        Save Preferences
                        </Button>
                    </div>
                    </form>
                </Card>
              )}

              {/* Data Export */}
              {activeTab === "data" && (
                <Card className="p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FiDownload className="text-indigo-600" />
                            Data Management
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 pl-7">
                            Export your transaction history.
                        </p>
                    </div>

                    <div className="space-y-6">
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <h4 className="font-semibold text-slate-900 mb-2">Export Transactions</h4>
                             <p className="text-sm text-slate-600 mb-4">
                                Download a complete record of your income and expenses. Useful for backups or importing into other tools.
                             </p>
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => handleExportData("csv")}
                                    isLoading={exportDataMutation.isPending}
                                    icon={<FiDownload className="w-4 h-4" />}
                                >
                                    Download CSV
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleExportData("json")}
                                    isLoading={exportDataMutation.isPending}
                                    icon={<FiDownload className="w-4 h-4" />}
                                >
                                    Download JSON
                                </Button>
                            </div>
                         </div>
                    </div>
                </Card>
              )}

              {/* Danger Zone */}
              {activeTab === "danger" && (
                <Card className="p-6 border-red-100 bg-red-50/30 animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="mb-6 pb-4 border-b border-red-100">
                        <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                            <FiTrash2 className="text-red-600" />
                            Danger Zone
                        </h2>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-red-100 mb-6 shadow-sm">
                        <h4 className="font-bold text-slate-900 mb-2">Delete Account</h4>
                        <p className="text-sm text-slate-600 mb-4">
                            Permanently remove your account and all associated data. This action cannot be undone.
                        </p>
                        
                        {showDeleteConfirm && (
                             <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                                <FiTrash2 />
                                <strong>Warning:</strong> You are about to permanently delete your account. Are you sure?
                             </div>
                        )}

                        <Button
                            variant="danger"
                            onClick={handleDeleteAccount}
                            isLoading={deleteAccountMutation.isPending}
                            fullWidth
                        >
                            {showDeleteConfirm ? "Yes, Delete Everything" : "Delete Account"}
                        </Button>
                    </div>
                </Card>
              )}
          </div>
       </div>
    </div>
  );
};

export default SettingsPage;
