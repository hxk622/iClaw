import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Archive,
  CheckCircle2,
  GitMerge,
  PencilLine,
  Tag,
  Trash2,
  X,
  Star,
} from 'lucide-react';

import { cn } from '@/app/lib/cn';
import type { MemoryEditDraft, MemoryEntry, MemoryImportance, MemoryStatus, MemoryType, MemoryDomain } from './model';
import {
  DOMAIN_OPTIONS,
  TYPE_OPTIONS,
  IMPORTANCE_OPTIONS,
  getDomainBadgeClass,
  getImportanceBadgeClass,
  getIndexHealthClass,
  getStatusBadgeClass,
  getTypeBadgeClass,
} from './model';

export function MemoryDetailDrawer({
  open,
  entry,
  relatedEntries,
  editing,
  draft,
  tagInput,
  setTagInput,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddTag,
  onRemoveDraftTag,
  onMarkConfirmed,
  onMerge,
  onForget,
  onDelete,
  onSelectRelated,
  onClose,
  busy = false,
}: {
  open: boolean;
  entry: MemoryEntry | null;
  relatedEntries: MemoryEntry[];
  editing: boolean;
  draft: MemoryEditDraft | null;
  tagInput: string;
  setTagInput: (value: string) => void;
  onDraftChange: Dispatch<SetStateAction<MemoryEditDraft | null>>;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddTag: () => void;
  onRemoveDraftTag: (tag: string) => void;
  onMarkConfirmed: () => void;
  onMerge: () => void;
  onForget: () => void;
  onDelete: () => void;
  onSelectRelated: (id: string) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const view = editing && draft ? draft : entry;
  const recallRecords = buildRecallRecords(entry);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-[624px] border-l border-[#ECE7DE] bg-[#FCFBF8] transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {!entry || !view ? (
          <div className="flex h-full items-center justify-center border-l border-[#ECE7DE] bg-[#FCFBF8]">
            <div className="px-8 text-center">
              <Archive size={48} strokeWidth={1} className="mb-4 text-[#DED7CC]" />
              <p className="text-[13px] text-[#9A9288]">选择一条记忆查看详情</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#ECE7DE] px-6 py-4">
              <h3 className="text-[13px] text-[#1A1A18]" style={{ fontWeight: 500 }}>
                记忆详情
              </h3>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-md p-1.5 text-[#9A9288] transition-all duration-200 hover:bg-[#F8F4ED] hover:text-[#1A1A18]"
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              <DrawerBlock label="内容">
                {editing && draft ? (
                  <div className="space-y-3">
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        onDraftChange((current) => (current ? { ...current, title: event.target.value } : current))
                      }
                      placeholder="记忆标题"
                      className="w-full rounded-lg border border-[#DED7CC] bg-white px-4 py-3 text-[13px] text-[#1A1A18] outline-none"
                    />
                    <textarea
                      value={draft.content}
                      onChange={(event) =>
                        onDraftChange((current) => (current ? { ...current, content: event.target.value } : current))
                      }
                      className="min-h-[180px] w-full rounded-lg border border-[#DED7CC] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#1A1A18] outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[#1A1A18]">{entry.content}</p>
                )}
              </DrawerBlock>

              <DrawerBlock label="分类">
                {editing && draft ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="领域"
                      value={draft.domain}
                      options={DOMAIN_OPTIONS}
                      onChange={(value) =>
                        onDraftChange((current) => (current ? { ...current, domain: value as MemoryDomain } : current))
                      }
                    />
                    <SelectField
                      label="类型"
                      value={draft.type}
                      options={TYPE_OPTIONS}
                      onChange={(value) =>
                        onDraftChange((current) => (current ? { ...current, type: value as MemoryType } : current))
                      }
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Badge className={getDomainBadgeClass(view.domain)}>{view.domain}</Badge>
                    <Badge className={getTypeBadgeClass(view.type)}>{view.type}</Badge>
                  </div>
                )}
              </DrawerBlock>

              <DrawerBlock label="标签">
                <div className="flex flex-wrap gap-2">
                  {view.tags.map((tag) => (
                    <Badge key={tag} className="border-none bg-[#ECE7DE] text-[#6B655D]">
                      {tag}
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => onRemoveDraftTag(tag)}
                          className="ml-1 cursor-pointer text-[#9A9288]"
                        >
                          ×
                        </button>
                      ) : null}
                    </Badge>
                  ))}
                </div>

                {editing ? (
                  <div className="mt-4 flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          onAddTag();
                        }
                      }}
                      placeholder="新增标签"
                      className="flex-1 rounded-lg border border-[#DED7CC] bg-white px-3 py-2 text-[13px] text-[#1A1A18] outline-none"
                    />
                    <button
                      onClick={onAddTag}
                      className="cursor-pointer rounded-lg border border-[#DED7CC] bg-white px-4 py-2 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8]"
                    >
                      添加
                    </button>
                  </div>
                ) : null}
              </DrawerBlock>

              <DrawerBlock label="重要性">
                {editing && draft ? (
                  <SelectField
                    label="重要性"
                    value={draft.importance}
                    options={IMPORTANCE_OPTIONS}
                    onChange={(value) =>
                      onDraftChange((current) =>
                        current ? { ...current, importance: value as MemoryImportance } : current,
                      )
                    }
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {view.importance === '高' ? (
                      <Star size={13} fill="#A88C5D" stroke="#A88C5D" strokeWidth={1.5} />
                    ) : null}
                    <span className="text-[13px] text-[#1A1A18]">{view.importance}</span>
                    <Badge className={getImportanceBadgeClass(view.importance)}>{view.importance}重要性</Badge>
                  </div>
                )}
              </DrawerBlock>

              <DrawerBlock label="来源与状态">
                {editing && draft ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[#ECE7DE] bg-white px-4 py-3">
                      <div className="mb-1 text-[11px] text-[#9A9288]">来源类型</div>
                      <div className="text-[13px] text-[#1A1A18]">{entry.sourceType}</div>
                    </div>
                    <label className="block space-y-1">
                      <div className="text-[12px] text-[#9A9288]">来源说明</div>
                      <input
                        value={draft.sourceLabel}
                        onChange={(event) =>
                          onDraftChange((current) => (current ? { ...current, sourceLabel: event.target.value } : current))
                        }
                        className="w-full rounded-lg border border-[#DED7CC] bg-white px-3 py-2 text-[13px] text-[#1A1A18] outline-none"
                      />
                    </label>
                    <SelectField
                      label="状态"
                      value={draft.status}
                      options={['已确认', '待检查']}
                      onChange={(value) =>
                        onDraftChange((current) => (current ? { ...current, status: value as MemoryStatus } : current))
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[13px] text-[#1A1A18]">{entry.sourceType}</div>
                    <div className="text-[11px] text-[#6B655D]">状态: {entry.status}</div>
                    <div className="text-[11px] text-[#6B655D]">来源说明: {entry.sourceLabel}</div>
                    <div className="text-[11px] text-[#6B655D]">
                      捕获置信度: {Math.round(entry.captureConfidence * 100)}%
                    </div>
                    <div className="text-[11px] text-[#6B655D]">
                      索引状态: <span className={getIndexHealthClass(entry.indexHealth)}>{entry.indexHealth}</span>
                    </div>
                  </div>
                )}
              </DrawerBlock>

              <DrawerBlock label="时间">
                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#6B655D]">创建: {entry.createdAt}</div>
                  <div className="text-[11px] text-[#6B655D]">更新: {entry.updatedAt}</div>
                </div>
              </DrawerBlock>

              {recallRecords.length > 0 ? (
                <DrawerBlock label={`召回记录 (${entry.recallCount} 次)`}>
                  <div className="space-y-2">
                    {recallRecords.map((record) => (
                      <div key={record.date} className="rounded-lg border border-[#ECE7DE] bg-white p-3.5">
                        <div className="mb-1 text-[11px] text-[#9A9288]">{record.date}</div>
                        <div className="text-[12px] text-[#1A1A18]">{record.context}</div>
                      </div>
                    ))}
                  </div>
                </DrawerBlock>
              ) : null}

              <DrawerBlock label="相关记忆">
                <div className="space-y-2">
                  {relatedEntries.length > 0 ? (
                    relatedEntries.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onSelectRelated(item.id)}
                        className="w-full cursor-pointer rounded-lg border border-[#ECE7DE] bg-white p-3.5 text-left transition-all duration-200 hover:border-[#DED7CC]"
                      >
                        <p className="mb-1.5 line-clamp-2 text-[12px] text-[#1A1A18]">{item.summary}</p>
                        <div className="flex gap-1.5">
                          <Badge className={getDomainBadgeClass(item.domain)}>{item.domain}</Badge>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#ECE7DE] px-4 py-4 text-[12px] text-[#6B655D]">
                      当前没有足够接近的候选记忆。
                    </div>
                  )}
                </div>
              </DrawerBlock>
            </div>

            <div className="space-y-2.5 border-t border-[#ECE7DE] bg-white px-6 py-5">
              {editing ? (
                <div className="flex gap-2.5">
                  <button
                    onClick={onSaveEdit}
                    disabled={busy}
                    className="flex-1 cursor-pointer rounded-lg bg-[#1A1A18] px-4 py-2.5 text-[13px] text-white shadow-sm transition-all duration-200 hover:bg-[#2D2D2B] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    保存
                  </button>
                  <button
                    onClick={onCancelEdit}
                    disabled={busy}
                    className="flex-1 cursor-pointer rounded-lg border border-[#DED7CC] bg-white px-4 py-2.5 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <>
                  {entry.status !== '已确认' ? (
                    <button
                      onClick={onMarkConfirmed}
                      disabled={busy}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#5A7860] px-4 py-2.5 text-[13px] text-white transition-all duration-200 hover:bg-[#4A6850] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={15} strokeWidth={1.5} />
                      <span>标记为已确认</span>
                    </button>
                  ) : null}
                  <button
                    onClick={onStartEdit}
                    disabled={busy}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1A1A18] px-4 py-2.5 text-[13px] text-white shadow-sm transition-all duration-200 hover:bg-[#2D2D2B] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PencilLine size={15} strokeWidth={1.5} />
                    <span>编辑</span>
                  </button>
                  <div className="flex gap-2.5">
                    <button
                      onClick={onStartEdit}
                      disabled={busy}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#DED7CC] bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Tag size={14} strokeWidth={1.5} />
                      <span>重打标签</span>
                    </button>
                    <button
                      onClick={onMerge}
                      disabled={busy || relatedEntries.length === 0}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#DED7CC] bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] transition-all duration-200 hover:border-[#A88C5D] hover:bg-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <GitMerge size={14} strokeWidth={1.5} />
                      合并
                    </button>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={onForget}
                      disabled={busy}
                      className="flex-1 cursor-pointer rounded-lg border border-[#DED7CC] bg-white px-3 py-2.5 text-[13px] text-[#A0765C] transition-all duration-200 hover:bg-[#F5EFE8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      归档
                    </button>
                    <button
                      onClick={onDelete}
                      disabled={busy}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#9A5956] bg-white px-3 py-2.5 text-[13px] text-[#9A5956] transition-all duration-200 hover:bg-[#F5EAEA] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function DrawerBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-2.5 text-[11px] uppercase tracking-wide text-[#9A9288]">
        {label}
      </div>
      {children}
    </section>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <div className="text-[12px] text-[#9A9288]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[#DED7CC] bg-white px-3 py-2 text-[13px] text-[#1A1A18] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center rounded px-2.5 py-1 text-[11px]', className)}>
      {children}
    </span>
  );
}

function buildRecallRecords(entry: MemoryEntry | null) {
  if (!entry) return [];
  if (!entry.lastRecalledAt) return [];

  const suffix = entry.recallCount > 1 ? `累计已被召回 ${entry.recallCount} 次。` : '最近一次被系统召回。';
  return [
    {
      date: entry.lastRecalledAt,
      context: suffix,
    },
  ];
}
