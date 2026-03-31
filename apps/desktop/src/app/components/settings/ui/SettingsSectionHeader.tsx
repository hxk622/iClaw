interface SettingsSectionHeaderProps {
  title: string;
  description: string;
}

export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <div>
      <h3 className="mb-1 text-[19px] font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-[15px] leading-7 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
