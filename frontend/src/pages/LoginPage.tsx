// Login page component
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { FiEye, FiEyeOff, FiPieChart } from "react-icons/fi";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");

    try {
      await login(data);
      navigate("/dashboard");
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ field: string; message: string }>;
          };
          status?: number;
        };
      };

      if (error.response?.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
      } else if (error.response?.data?.errors) {
        const validationMessages = error.response.data.errors
          .map((err) => `${err.field}: ${err.message}`)
          .join(", ");
        setError(`Validation failed: ${validationMessages}`);
      } else {
        setError(
          error.response?.data?.message || "Login failed. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Rich Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/40 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/30 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-700"></div>
             <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-primary-900/20 rounded-full blur-[100px] mix-blend-screen"></div>
        </div>

      <div className="max-w-md w-full space-y-8 relative z-10 p-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-primary-500/30">
            <FiPieChart className="w-8 h-8" />
          </div>
          <h2 className="text-center text-3xl font-bold text-white tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-slate-300">
            Sign in to continue to <span className="font-semibold text-primary-400">Chahrity</span>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
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
                placeholder="Enter your password"
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
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <a href="#" className="font-medium text-primary-400 hover:text-primary-300 transition-colors">
                Forgot password?
              </a>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={isLoading}
            className="bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white shadow-lg shadow-primary-500/25 border-none"
          >
            Sign in
          </Button>

          <p className="mt-4 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              Sign up for free
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
