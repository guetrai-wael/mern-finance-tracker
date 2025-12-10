// Register page
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { FiEye, FiEyeOff, FiPieChart } from "react-icons/fi";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError("");

    try {
      await registerUser({ name: data.name, email: data.email, password: data.password });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ field: string; message: string }>;
          };
        };
      };

      if (error.response?.data?.errors) {
        const validationMessages = error.response.data.errors
          .map((err) => `${err.field}: ${err.message}`)
          .join(", ");
        setError(`Registration failed: ${validationMessages}`);
      } else {
        setError(
          error.response?.data?.message ||
            "Registration failed. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
     <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
         {/* Success Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse transform -translate-x-1/2 -translate-y-1/2"></div>
         </div>
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-10 z-10 shadow-2xl relative">
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                <FiPieChart className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Welcome Aboard!</h2>
            <div className="text-emerald-300 bg-emerald-900/40 border border-emerald-500/30 px-6 py-4 rounded-2xl backdrop-blur-md">
              <p className="font-medium">Account created successfully!</p>
              <p className="text-sm opacity-80 mt-1">Redirecting you to login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Rich Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/40 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-500"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-900/30 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
        </div>

      <div className="max-w-md w-full space-y-8 relative z-10 p-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-primary-500/30">
             <FiPieChart className="w-8 h-8" />
          </div>
          <h2 className="text-center text-3xl font-bold text-white tracking-tight">
            Create Account
          </h2>
          <p className="mt-2 text-center text-slate-300">
            Join <span className="font-semibold text-primary-400">Chahrity</span> to take control
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
             <div>
                 <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">
                    Full Name
                 </label>
                <Input
                type="text"
                placeholder="Enter your name"
                error={errors.name?.message}
                {...register("name")}
                 className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary-500 focus:ring-primary-500"
                />
            </div>

            <div>
                 <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">
                    Email address
                 </label>
                <Input
                type="email"
                placeholder="Enter your email"
                error={errors.email?.message}
                {...register("email")}
                 className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary-500 focus:ring-primary-500"
                />
            </div>

            <div className="relative">
                 <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">
                    Password
                 </label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                error={errors.password?.message}
                {...register("password")}
                 className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                className="absolute top-[34px] right-3 flex items-center text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <FiEyeOff className="h-5 w-5" />
                ) : (
                  <FiEye className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="relative">
                 <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">
                    Confirm Password
                 </label>
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
                 className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary-500 focus:ring-primary-500"
              />
               <button
                type="button"
                className="absolute top-[34px] right-3 flex items-center text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <FiEyeOff className="h-5 w-5" />
                ) : (
                  <FiEye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={isLoading}
             className="bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white shadow-lg shadow-primary-500/25 border-none"
          >
            Create Account
          </Button>

          <p className="mt-4 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
