import type { ConfigStatus } from '@/app/contexts/settings-context';
import { Chip } from '@/app/components/ui/Chip';

interface StatusBadgeProps {
  status: ConfigStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<
    ConfigStatus,
    { label: string; tone: 'muted' | 'warning' | 'success' }
  > = {
    'not-configured': {
      label: '未配置',
      tone: 'warning',
    },
    'using-default': {
      label: '使用默认',
      tone: 'muted',
    },
    customized: {
      label: '已自定义',
      tone: 'success',
    },
  };

  return (
    <Chip tone={styles[status].tone} className="rounded-[10px] px-2.5 py-0.5 text-xs font-medium">
      {styles[status].label}
    </Chip>
  );
}
