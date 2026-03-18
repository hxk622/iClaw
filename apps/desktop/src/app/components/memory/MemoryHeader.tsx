import { Download, FileUp, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

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
    <section className="border-b border-[#ECE7DE] px-8 pb-6 pt-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-1.5 text-[28px] leading-tight tracking-tight text-[#1A1A18]" style={{ fontWeight: 500 }}>
              记忆管理
            </h1>
            <p className="text-[13px] leading-relaxed text-[#6B655D]">AI 的长期记忆与标签化管理</p>
          </div>

          <div className="flex items-center gap-2.5">
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
          </div>
        </div>
      </div>
    </section>
  );
}
