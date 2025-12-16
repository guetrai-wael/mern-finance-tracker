import React from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    const baseClasses = `
      block w-full rounded-xl border shadow-sm py-2.5
      border-slate-200 bg-white text-slate-900
      focus:border-primary-500 focus:ring-primary-500 sm:text-sm
      placeholder:text-slate-400
      ${icon ? 'pl-10 pr-4' : 'px-4'}
      ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
    `;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={twMerge(baseClasses, className)}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

