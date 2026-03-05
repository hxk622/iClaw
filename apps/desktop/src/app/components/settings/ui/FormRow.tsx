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
      <label className="block text-sm text-[var(--text-primary)]">
        {label}
        {required && <span className="ml-1 text-[var(--state-error)]">*</span>}
      </label>
      <div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[var(--border-default)] [&>input]:bg-[var(--bg-hover)] [&>input]:px-3 [&>input]:py-2 [&>input]:text-[var(--text-primary)] [&>input]:outline-none [&>input]:focus:border-[var(--border-strong)] [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[var(--border-default)] [&>select]:bg-[var(--bg-hover)] [&>select]:px-3 [&>select]:py-2 [&>select]:text-[var(--text-primary)] [&>select]:outline-none [&>select]:focus:border-[var(--border-strong)] [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:border-[var(--border-default)] [&>textarea]:bg-[var(--bg-hover)] [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:text-[var(--text-primary)] [&>textarea]:outline-none [&>textarea]:focus:border-[var(--border-strong)]">
        {children}
      </div>
      {help && !error && <p className="text-xs text-[var(--text-secondary)]">{help}</p>}
      {error && <p className="text-xs text-[var(--state-error)]">{error}</p>}
    </div>
  );
}
