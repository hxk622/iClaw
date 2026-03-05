import type { ConfigStatus } from '@/app/contexts/settings-context';

interface StatusBadgeProps {
  status: ConfigStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<
    ConfigStatus,
    { label: string; cls: string }
  > = {
    'not-configured': {
      label: '未配置',
      cls: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
    },
    'using-default': {
      label: '使用默认',
      cls: 'bg-[var(--bg-hover)] text-[var(--state-info)]',
    },
    customized: {
      label: '已自定义',
      cls: 'bg-[var(--bg-hover)] text-[var(--brand-primary)]',
    },
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs ${styles[status].cls}`}>
      {styles[status].label}
    </span>
  );
}
