import { Download, FileUp, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { PageContent, PageHeader } from '@/app/components/ui/PageLayout';

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
    <section className="border-b border-[#ECE7DE] pb-6 pt-8">
      <PageContent className="max-w-[1480px] py-0">
        <PageHeader
          eyebrow="Memory"
          title="记忆管理"
          description="AI 的长期记忆与标签化管理"
          eyebrowClassName="text-[#9A9288]"
          titleClassName="text-[#1A1A18]"
          descriptionClassName="text-[#6B655D]"
          actions={
            <>
              <Button
                onClick={onRefreshIndex}
                disabled={mutating}
                variant="secondary"
                size="sm"
                className="rounded-lg px-4 py-2 text-[13px]"
                leadingIcon={<RefreshCw size={14} strokeWidth={1.5} />}
              >
                刷新索引
              </Button>
              <Button
                onClick={onExport}
                disabled={loading || mutating}
                variant="secondary"
                size="sm"
                className="rounded-lg px-4 py-2 text-[13px]"
                leadingIcon={<Download size={14} strokeWidth={1.5} />}
              >
                导出
              </Button>
              <Button
                onClick={onImport}
                disabled={mutating}
                variant="secondary"
                size="sm"
                className="rounded-lg px-4 py-2 text-[13px]"
                leadingIcon={<FileUp size={14} strokeWidth={1.5} />}
              >
                导入
              </Button>
              <Button
                onClick={onCreate}
                disabled={mutating}
                variant="primary"
                size="sm"
                className="rounded-lg px-4 py-2 text-[13px]"
                leadingIcon={<Plus size={14} strokeWidth={1.5} />}
              >
                新建记忆
              </Button>
            </>
          }
        />
      </PageContent>
    </section>
  );
}
