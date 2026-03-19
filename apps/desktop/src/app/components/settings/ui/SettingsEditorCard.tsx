interface SettingsEditorCardProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}

export function SettingsEditorCard({
  value,
  onChange,
  placeholder,
  disabled = false,
}: SettingsEditorCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-none">
      <div className="mb-3 text-[12px] text-[var(--text-secondary)]">内容编辑</div>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="h-[320px] w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-page)] p-4 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[color:color-mix(in_srgb,var(--brand-primary)_40%,var(--border-default))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)] disabled:cursor-not-allowed"
      />
    </div>
  );
}
