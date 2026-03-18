interface SettingsSectionHeaderProps {
  title: string;
  description: string;
}

export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <div>
      <h3 className="mb-1 text-[18px] font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
