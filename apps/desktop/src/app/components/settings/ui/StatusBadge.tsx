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
      cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    },
    'using-default': {
      label: '使用默认',
      cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    },
    customized: {
      label: '已自定义',
      cls: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300',
    },
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs ${styles[status].cls}`}>
      {styles[status].label}
    </span>
  );
}
