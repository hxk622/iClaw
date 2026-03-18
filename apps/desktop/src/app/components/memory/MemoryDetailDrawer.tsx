import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  GitMerge,
  PencilLine,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { PressableCard } from '@/app/components/ui/PressableCard';
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

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-20 bg-[var(--lobster-overlay-bg)] transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-30 h-full w-[min(624px,calc(100vw-288px))] border-l border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] shadow-[var(--lobster-shadow-modal)] transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {!entry || !view ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-muted)]">
                <BookOpen className="h-9 w-9" strokeWidth={1.3} />
              </div>
              <p className="text-[13px] text-[var(--lobster-text-secondary)]">选择一条记忆查看详情</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[var(--lobster-border)] px-6 py-4">
              <div>
                <div className="text-[13px] font-medium text-[var(--lobster-text-primary)]">记忆详情</div>
                <div className="mt-1 text-[11px] text-[var(--lobster-text-muted)]">点击外部区域或右上角可关闭</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 rounded-full p-0 text-[var(--lobster-text-muted)] hover:bg-[var(--lobster-muted-bg)] hover:text-[var(--lobster-text-primary)]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {editing && draft ? (
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        onDraftChange((current) => (current ? { ...current, title: event.target.value } : current))
                      }
                      className="w-full rounded-[16px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-3 text-[18px] font-semibold tracking-[-0.03em] text-[var(--lobster-text-primary)] outline-none focus:border-[var(--lobster-gold-border-strong)]"
                    />
                  ) : (
                    <h3 className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">
                      {entry.title}
                    </h3>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={getDomainBadgeClass(view.domain)}>{view.domain}</Badge>
                    <Badge className={getTypeBadgeClass(view.type)}>{view.type}</Badge>
                    <Badge className={getStatusBadgeClass(entry.status)}>{entry.status}</Badge>
                    <Badge className={getImportanceBadgeClass(view.importance)}>{view.importance}重要性</Badge>
                  </div>
                </div>

                {!editing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<PencilLine className="h-4 w-4" />}
                    onClick={onStartEdit}
                    disabled={busy}
                    className="rounded-[14px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-2.5 text-[13px] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-bg)]"
                  >
                    编辑
                  </Button>
                ) : null}
              </div>

              <div className="space-y-7">
                <DrawerSection label="内容">
                  {editing && draft ? (
                    <textarea
                      value={draft.content}
                      onChange={(event) =>
                        onDraftChange((current) => (current ? { ...current, content: event.target.value } : current))
                      }
                      className="min-h-[220px] w-full rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-3 text-[14px] leading-7 text-[var(--lobster-text-primary)] outline-none focus:border-[var(--lobster-gold-border-strong)]"
                    />
                  ) : (
                    <p className="text-[14px] leading-7 text-[var(--lobster-text-primary)]">{entry.content}</p>
                  )}
                </DrawerSection>

                <DrawerSection label="标签与分类">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {view.tags.map((tag) => (
                        <Badge
                          key={tag}
                          className="border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]"
                        >
                          {tag}
                          {editing ? (
                            <button
                              type="button"
                              onClick={() => onRemoveDraftTag(tag)}
                              className="ml-1 cursor-pointer text-[var(--lobster-text-muted)]"
                            >
                              ×
                            </button>
                          ) : null}
                        </Badge>
                      ))}
                    </div>

                    {editing ? (
                      <div className="flex gap-2">
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
                          className="flex-1 rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-3 py-2 text-[13px] text-[var(--lobster-text-primary)] outline-none focus:border-[var(--lobster-gold-border-strong)]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={onAddTag}
                          className="rounded-[14px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-2 text-[13px] text-[var(--lobster-text-primary)]"
                        >
                          添加
                        </Button>
                      </div>
                    ) : null}

                    {editing ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SelectField
                          label="领域"
                          value={draft.domain}
                          options={DOMAIN_OPTIONS}
                          onChange={(value) =>
                            onDraftChange((current) =>
                              current ? { ...current, domain: value as MemoryDomain } : current,
                            )
                          }
                        />
                        <SelectField
                          label="类型"
                          value={draft.type}
                          options={TYPE_OPTIONS}
                          onChange={(value) =>
                            onDraftChange((current) =>
                              current ? { ...current, type: value as MemoryType } : current,
                            )
                          }
                        />
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
                        <SelectField
                          label="状态"
                          value={draft.status}
                          options={['已确认', '待检查']}
                          onChange={(value) =>
                            onDraftChange((current) =>
                              current ? { ...current, status: value as MemoryStatus } : current,
                            )
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </DrawerSection>

                <DrawerSection label="来源与召回">
                  <div className="space-y-3 text-[13px] text-[var(--lobster-text-secondary)]">
                    <InfoRow label="来源类型" value={entry.sourceType} />
                    <InfoRow label="来源说明" value={editing && draft ? draft.sourceLabel : entry.sourceLabel} />
                    <InfoRow label="创建时间" value={entry.createdAt} />
                    <InfoRow label="更新时间" value={entry.updatedAt} />
                    <InfoRow label="最近召回" value={entry.lastRecalledAt ?? '从未召回'} />
                    <InfoRow label="召回次数" value={`${entry.recallCount} 次`} />
                    <InfoRow label="捕获置信度" value={`${Math.round(entry.captureConfidence * 100)}%`} />
                    <InfoRow
                      label="索引状态"
                      value={entry.indexHealth}
                      valueClassName={getIndexHealthClass(entry.indexHealth)}
                    />
                    {editing ? (
                      <input
                        value={draft.sourceLabel}
                        onChange={(event) =>
                          onDraftChange((current) => (current ? { ...current, sourceLabel: event.target.value } : current))
                        }
                        className="w-full rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-3 py-2 text-[13px] text-[var(--lobster-text-primary)] outline-none focus:border-[var(--lobster-gold-border-strong)]"
                      />
                    ) : null}
                  </div>
                </DrawerSection>

                <DrawerSection label="相关记忆">
                  <div className="space-y-2.5">
                    {relatedEntries.length > 0 ? (
                      relatedEntries.map((item) => (
                        <PressableCard
                          key={item.id}
                          interactive
                          onClick={() => onSelectRelated(item.id)}
                          className="rounded-[18px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-3 shadow-none hover:border-[var(--lobster-border-strong)]"
                        >
                          <div className="text-[13px] font-medium text-[var(--lobster-text-primary)]">{item.title}</div>
                          <div className="mt-1 text-[12px] leading-6 text-[var(--lobster-text-secondary)]">
                            {item.summary}
                          </div>
                        </PressableCard>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-[var(--lobster-border)] px-4 py-4 text-[12px] text-[var(--lobster-text-secondary)]">
                        当前没有足够接近的候选记忆。
                      </div>
                    )}
                  </div>
                </DrawerSection>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-6 py-5">
              {editing ? (
                <div className="flex gap-2.5">
                  <Button variant="ink" size="md" onClick={onSaveEdit} disabled={busy} className="flex-1 text-[13px]">
                    保存修改
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={onCancelEdit}
                    disabled={busy}
                    className="flex-1 border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[13px] text-[var(--lobster-text-primary)]"
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2.5">
                    <Button
                      variant="accent"
                      size="md"
                      leadingIcon={<CheckCircle2 className="h-4 w-4" />}
                      onClick={onMarkConfirmed}
                      disabled={busy}
                      className="flex-1 text-[13px]"
                    >
                      标记为已确认
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      leadingIcon={<GitMerge className="h-4 w-4" />}
                      onClick={onMerge}
                      disabled={busy || relatedEntries.length === 0}
                      className="flex-1 border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[13px] text-[var(--lobster-text-primary)]"
                    >
                      合并
                    </Button>
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      variant="secondary"
                      size="md"
                      leadingIcon={<Clock3 className="h-4 w-4" />}
                      onClick={onForget}
                      disabled={busy}
                      className="flex-1 border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[13px] text-[#a0765c] hover:bg-[#f5efe8]"
                    >
                      归档
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      leadingIcon={<Trash2 className="h-4 w-4" />}
                      onClick={onDelete}
                      disabled={busy}
                      className="flex-1 text-[13px]"
                    >
                      删除
                    </Button>
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

function DrawerSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 text-[11px] uppercase tracking-[0.08em] text-[var(--lobster-text-muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--lobster-text-muted)]">{label}</span>
      <span className={cn('max-w-[240px] text-right text-[var(--lobster-text-primary)]', valueClassName)}>{value}</span>
    </div>
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
    <label className="space-y-1.5">
      <div className="text-[12px] text-[var(--lobster-text-muted)]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-3 py-2 text-[13px] text-[var(--lobster-text-primary)] outline-none focus:border-[var(--lobster-gold-border-strong)]"
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
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', className)}>
      {children}
    </span>
  );
}
