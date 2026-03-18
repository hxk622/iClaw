import { Download, FileUp, Plus, RefreshCw } from 'lucide-react';

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
            <button
              onClick={onRefreshIndex}
              disabled={mutating}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#DED7CC] bg-white px-4 py-2 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              <span>刷新索引</span>
            </button>
            <button
              onClick={onExport}
              disabled={loading || mutating}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#DED7CC] bg-white px-4 py-2 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={14} strokeWidth={1.5} />
              <span>导出</span>
            </button>
            <button
              onClick={onImport}
              disabled={mutating}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#DED7CC] bg-white px-4 py-2 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileUp size={14} strokeWidth={1.5} />
              <span>导入</span>
            </button>
            <button
              onClick={onCreate}
              disabled={mutating}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#1A1A18] px-4 py-2 text-[13px] text-white shadow-sm transition-all duration-200 hover:bg-[#2D2D2B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={14} strokeWidth={1.5} />
              <span>新建记忆</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
