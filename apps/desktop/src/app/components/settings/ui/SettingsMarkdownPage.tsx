import type { ReactNode } from 'react';
import { SettingsEditorCard } from './SettingsEditorCard';
import { SettingsFileStatusCard } from './SettingsFileStatusCard';

interface SettingsMarkdownPageProps {
  title: string;
  fileName: string;
  description: string;
  workspacePath: string;
  syncLabel: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function SettingsMarkdownPage({
  title,
  fileName,
  description,
  workspacePath,
  syncLabel,
  value,
  placeholder,
  onChange,
  disabled = false,
  children,
}: SettingsMarkdownPageProps) {
  return (
    <div className="max-w-[680px]">
      <div className="mb-6">
        <h1 className="mb-2 text-[22px] font-medium tracking-tight text-[var(--text-primary)]">
          {title} {fileName}
        </h1>
        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>

      <div className="mb-6">
        <SettingsFileStatusCard fileName={fileName} workspacePath={workspacePath} syncLabel={syncLabel} />
      </div>

      <div className="mb-6">
        <SettingsEditorCard
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>

      {children}
    </div>
  );
}
