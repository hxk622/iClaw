import { type ReactNode } from 'react';

interface FormRowProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormRow({ label, help, error, required, children }: FormRowProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-800 dark:text-zinc-200">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {help && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400">{help}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
