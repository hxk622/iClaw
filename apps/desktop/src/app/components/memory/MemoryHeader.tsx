import { Download, FileUp, Plus, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';

export function MemoryHeader({
  searchQuery,
  onSearchQueryChange,
  onRefreshIndex,
  onExport,
  onImport,
  onCreate,
  loading = false,
  mutating = false,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onRefreshIndex: () => void;
  onExport: () => void;
  onImport: () => void;
  onCreate: () => void;
  loading?: boolean;
  mutating?: boolean;
}) {
  return (
    <section className="border-b border-[var(--lobster-border)] bg-[rgba(252,251,248,0.92)] px-8 pb-6 pt-8 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.045em] text-[var(--lobster-text-primary)]">
              记忆管理
            </h1>
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
              AI 的长期记忆与标签化管理
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RefreshCw className="h-[14px] w-[14px]" strokeWidth={1.5} />}
              onClick={onRefreshIndex}
              disabled={mutating}
              className="rounded-[14px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-2.5 text-[13px] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-bg)]"
            >
              刷新索引
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download className="h-[14px] w-[14px]" strokeWidth={1.5} />}
              onClick={onExport}
              disabled={loading || mutating}
              className="rounded-[14px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-2.5 text-[13px] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-bg)]"
            >
              导出
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<FileUp className="h-[14px] w-[14px]" strokeWidth={1.5} />}
              onClick={onImport}
              disabled={mutating}
              className="rounded-[14px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-2.5 text-[13px] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-bg)]"
            >
              导入
            </Button>
            <Button
              variant="ink"
              size="sm"
              leadingIcon={<Plus className="h-[14px] w-[14px]" strokeWidth={1.5} />}
              onClick={onCreate}
              disabled={mutating}
              className="rounded-[14px] px-4 py-2.5 text-[13px]"
            >
              新建记忆
            </Button>
          </div>
        </div>

        <label className="relative block max-w-[580px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lobster-text-muted)]" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="搜索记忆、标签、来源……"
            className="w-full rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] py-3 pl-11 pr-4 text-[14px] text-[var(--lobster-text-primary)] outline-none transition-colors placeholder:text-[var(--lobster-text-muted)] focus:border-[var(--lobster-gold-border-strong)]"
          />
        </label>
      </div>
    </section>
  );
}
