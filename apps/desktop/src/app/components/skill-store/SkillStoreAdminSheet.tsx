import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Package2, ShieldCheck, Tags, Trash2 } from 'lucide-react';
import type { AdminSkillStoreItem } from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';

type EditableSkillForm = {
  slug: string;
  name: string;
  description: string;
  market: string;
  category: string;
  skillType: string;
  publisher: string;
  visibility: 'showcase' | 'internal';
  distribution: 'bundled' | 'cloud';
  active: boolean;
  tagsText: string;
};

function toFormState(skill: AdminSkillStoreItem): EditableSkillForm {
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    market: skill.market === '通用' ? '' : skill.market,
    category: skill.categoryId === 'a-share' || skill.categoryId === 'us-stock' ? '' : skill.categoryId,
    skillType: skill.skillType,
    publisher: skill.publisher,
    visibility: skill.visibility === 'internal' ? 'internal' : 'showcase',
    distribution: skill.source,
    active: skill.active,
    tagsText: skill.tags.join(', '),
  };
}

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function SkillStoreAdminSheet({
  skill,
  saving,
  deleting,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  skill: AdminSkillStoreItem | null;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    slug: string;
    name: string;
    description: string;
    market: string | null;
    category: string | null;
    skillType: string | null;
    publisher: string;
    visibility: 'showcase' | 'internal';
    distribution: 'bundled' | 'cloud';
    active: boolean;
    tags: string[];
  }) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
}) {
  const [form, setForm] = useState<EditableSkillForm | null>(skill ? toFormState(skill) : null);

  useEffect(() => {
    setForm(skill ? toFormState(skill) : null);
  }, [skill]);

  if (!skill || !form) {
    return null;
  }

  const deleteDisabled = skill.source === 'bundled' || deleting || saving;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(17,24,39,0.18)] backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[520px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-page)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                超管管理
              </div>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                编辑技能
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                直接修改 catalog 中的展示、分类、标签和启用状态，保存后立刻写入 control-plane。
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="brand">{skill.source === 'bundled' ? '系统预置' : '云端技能'}</Chip>
            <Chip tone={skill.active ? 'success' : 'outline'}>{skill.active ? '已启用' : '已停用'}</Chip>
            <Chip tone="outline">{skill.visibility === 'showcase' ? '商店展示' : '仅后台可见'}</Chip>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Skill Slug
                </span>
                <input
                  value={form.slug}
                  disabled
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-3 text-[14px] text-[var(--text-secondary)] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  技能名称
                </span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => (current ? {...current, name: event.target.value} : current))}
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  描述
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, description: event.target.value} : current))
                  }
                  rows={4}
                  className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] leading-6 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  市场
                </span>
                <input
                  value={form.market}
                  onChange={(event) => setForm((current) => (current ? {...current, market: event.target.value} : current))}
                  placeholder="A股 / 美股 / 通用"
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  分类
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, category: event.target.value} : current))
                  }
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                >
                  <option value="">自动推断</option>
                  <option value="data">数据工具</option>
                  <option value="research">研究分析</option>
                  <option value="portfolio">组合与风险</option>
                  <option value="report">报告生成</option>
                  <option value="general">通用工具</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  技能类型
                </span>
                <select
                  value={form.skillType}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, skillType: event.target.value} : current))
                  }
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                >
                  <option value="">自动推断</option>
                  <option value="工具包">工具包</option>
                  <option value="分析师">分析师</option>
                  <option value="生成器">生成器</option>
                  <option value="扫描器">扫描器</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  发布者
                </span>
                <input
                  value={form.publisher}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, publisher: event.target.value} : current))
                  }
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <Tags className="h-4 w-4" />
                  标签
                </span>
                <input
                  value={form.tagsText}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, tagsText: event.target.value} : current))
                  }
                  placeholder="A股, ESG, 筛选"
                  className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm((current) => (current ? {...current, active: event.target.checked} : current))
                      }
                      className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
                    />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                        <Package2 className="h-4 w-4 text-[var(--brand-primary)]" />
                        启用技能
                      </div>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                        关闭后仍保留目录记录，但不会在公开技能库中展示。
                      </p>
                    </div>
                  </div>
                </label>

                <label className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.visibility === 'showcase'}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {...current, visibility: event.target.checked ? 'showcase' : 'internal'}
                            : current,
                        )
                      }
                      className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
                    />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                        {form.visibility === 'showcase' ? (
                          <Eye className="h-4 w-4 text-[var(--brand-primary)]" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-[var(--text-muted)]" />
                        )}
                        商店展示
                      </div>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                        关闭后仅超管后台可见，普通用户技能商店不显示。
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center justify-between gap-4">
                <span>创建时间</span>
                <span className="text-[var(--text-primary)]">{formatDate(skill.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>最后更新时间</span>
                <span className="text-[var(--text-primary)]">{formatDate(skill.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>最新版本</span>
                <span className="text-[var(--text-primary)]">{skill.latestRelease?.version || '未配置'}</span>
              </div>
            </div>
          </section>

          {error ? (
            <div
              className="rounded-[22px] px-4 py-3 text-sm text-[var(--state-error)]"
              style={{
                border: '1px solid rgba(239,68,68,0.16)',
                background: 'rgba(239,68,68,0.08)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="md"
              disabled={deleteDisabled}
              leadingIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => void onDelete(skill.slug)}
            >
              {skill.source === 'bundled' ? '内置技能不可删除' : deleting ? '删除中…' : '删除技能'}
            </Button>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="md" onClick={onClose} disabled={saving || deleting}>
                取消
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={saving || deleting}
                onClick={() =>
                  void onSave({
                    slug: form.slug.trim(),
                    name: form.name.trim(),
                    description: form.description.trim(),
                    market: form.market.trim() || null,
                    category: form.category.trim() || null,
                    skillType: form.skillType.trim() || null,
                    publisher: form.publisher.trim(),
                    visibility: form.visibility,
                    distribution: form.distribution,
                    active: form.active,
                    tags: parseTags(form.tagsText),
                  })
                }
              >
                {saving ? '保存中…' : '保存修改'}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
