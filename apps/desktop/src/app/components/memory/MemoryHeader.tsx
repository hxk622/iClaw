import { Download, FileUp, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { PageHeader } from '@/app/components/ui/PageLayout';

export function MemoryHeader({
  onRefreshIndex,
  onExport,
  onImport,
  onCreate,
  loading = false,
  mutating = false,
}: {
  onRefreshIndex: () => void;
  onExport: () => void;
  onImport: () => void;
  onCreate: () => void;
  loading?: boolean;
  mutating?: boolean;
}) {
  return (
    <PageHeader
      title="记忆管理"
      description="AI 的长期记忆与标签化管理"
      className="gap-2.5"
      contentClassName="space-y-1"
      titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em] text-[var(--text-primary)]"
      descriptionClassName="mt-0 text-[12px] leading-5 text-[var(--text-secondary)]"
      actionsClassName="gap-2"
      actions={
        <>
          <Button
            onClick={onRefreshIndex}
            disabled={mutating}
            variant="secondary"
            size="sm"
            className="px-3.5 py-1.5 text-[12px]"
            leadingIcon={<RefreshCw size={14} strokeWidth={1.5} />}
          >
            刷新索引
          </Button>
          <Button
            onClick={onExport}
            disabled={loading || mutating}
            variant="secondary"
            size="sm"
            className="px-3.5 py-1.5 text-[12px]"
            leadingIcon={<Download size={14} strokeWidth={1.5} />}
          >
            导出
          </Button>
          <Button
            onClick={onImport}
            disabled={mutating}
            variant="secondary"
            size="sm"
            className="px-3.5 py-1.5 text-[12px]"
            leadingIcon={<FileUp size={14} strokeWidth={1.5} />}
          >
            导入
          </Button>
          <Button
            onClick={onCreate}
            disabled={mutating}
            variant="primary"
            size="sm"
            className="px-3.5 py-1.5 text-[12px]"
            leadingIcon={<Plus size={14} strokeWidth={1.5} />}
          >
            新建记忆
          </Button>
        </>
      }
    />
  );
}
