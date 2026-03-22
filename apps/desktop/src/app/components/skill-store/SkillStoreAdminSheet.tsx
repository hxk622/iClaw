import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Package2, ShieldCheck, Sparkles, Tags, Trash2 } from 'lucide-react';
import type { AdminSkillStoreItem } from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { Select } from '@/app/components/ui/Select';

const SHEET_INPUT_CLASS =
  'rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]';
const SHEET_DISABLED_INPUT_CLASS =
  'rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-3 text-[14px] text-[var(--text-secondary)] outline-none dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[rgba(250,250,250,0.72)]';
const SHEET_TEXTAREA_CLASS =
  'rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] leading-6 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]';

type EditableSkillForm = {
  slug: string;
  name: string;
  description: string;
  featured: boolean;
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
    featured: skill.featured,
    market: skill.market === '通用' ? '' : skill.market,
    category: skill.categoryId === 'a-share' || skill.categoryId === 'us-stock' ? '' : skill.categoryId,
    skillType: skill.skillType,
    publisher: skill.publisher,
    visibility: skill.visibility === 'internal' ? 'internal' : 'showcase',
    distribution: skill.source === 'bundled' ? 'bundled' : 'cloud',
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
    featured: boolean;
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
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[2px] dark:bg-[rgba(0,0,0,0.34)]"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-[520px] flex-col border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_80px_rgba(26,22,18,0.2)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                超管管理
              </div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                编辑技能
              </h2>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                直接修改 catalog 中的展示、分类、标签和启用状态，保存后立刻写入 control-plane。
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="brand">{skill.source === 'bundled' ? '系统预置' : '云端技能'}</Chip>
            {skill.featured ? <Chip tone="accent">官方精选</Chip> : null}
            <Chip tone={skill.active ? 'success' : 'outline'}>{skill.active ? '已启用' : '已停用'}</Chip>
            <Chip tone="outline">{skill.visibility === 'showcase' ? '商店展示' : '仅后台可见'}</Chip>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <DrawerSection title="基础信息" icon={<Package2 className="h-5 w-5" />}>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  Skill Slug
                </span>
                <input
                  value={form.slug}
                  disabled
                  className={SHEET_DISABLED_INPUT_CLASS}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  技能名称
                </span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => (current ? {...current, name: event.target.value} : current))}
                  className={SHEET_INPUT_CLASS}
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  描述
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, description: event.target.value} : current))
                  }
                  rows={4}
                  className={SHEET_TEXTAREA_CLASS}
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>
            </div>
          </DrawerSection>

          <DrawerSection title="分类与发布" icon={<Tags className="h-5 w-5" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  市场
                </span>
                <input
                  value={form.market}
                  onChange={(event) => setForm((current) => (current ? {...current, market: event.target.value} : current))}
                  placeholder="A股 / 美股 / 通用"
                  className={`${SHEET_INPUT_CLASS} placeholder:text-[var(--text-muted)] dark:placeholder:text-[rgba(250,250,250,0.34)]`}
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  分类
                </span>
                <Select
                  value={form.category}
                  onChange={(value) =>
                    setForm((current) => (current ? {...current, category: value} : current))
                  }
                  options={[
                    { value: '', label: '自动推断' },
                    { value: 'data', label: '数据工具' },
                    { value: 'research', label: '研究分析' },
                    { value: 'portfolio', label: '组合与风险' },
                    { value: 'report', label: '报告生成' },
                    { value: 'general', label: '通用工具' },
                  ]}
                  triggerClassName={SHEET_INPUT_CLASS}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  技能类型
                </span>
                <Select
                  value={form.skillType}
                  onChange={(value) =>
                    setForm((current) => (current ? {...current, skillType: value} : current))
                  }
                  options={[
                    { value: '', label: '自动推断' },
                    { value: '工具包', label: '工具包' },
                    { value: '分析师', label: '分析师' },
                    { value: '生成器', label: '生成器' },
                    { value: '扫描器', label: '扫描器' },
                  ]}
                  triggerClassName={SHEET_INPUT_CLASS}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  发布者
                </span>
                <input
                  value={form.publisher}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, publisher: event.target.value} : current))
                  }
                  className={SHEET_INPUT_CLASS}
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>
            </div>
          </DrawerSection>

          <DrawerSection title="标签与展示状态" icon={<Tags className="h-5 w-5" />}>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  <Tags className="h-4 w-4" />
                  标签
                </span>
                <input
                  value={form.tagsText}
                  onChange={(event) =>
                    setForm((current) => (current ? {...current, tagsText: event.target.value} : current))
                  }
                  placeholder="A股, ESG, 筛选"
                  className={`${SHEET_INPUT_CLASS} placeholder:text-[var(--text-muted)] dark:placeholder:text-[rgba(250,250,250,0.34)]`}
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <SelectionCard
                  as="button"
                  selected={form.active}
                  onClick={() =>
                    setForm((current) => (current ? { ...current, active: !current.active } : current))
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <Package2 className="h-4 w-4 text-[var(--brand-primary)]" />
                    启用技能
                  </div>
                  <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                    关闭后仍保留目录记录，但不会在公开技能库中展示。
                  </p>
                </SelectionCard>

                <SelectionCard
                  as="button"
                  selected={form.featured}
                  onClick={() =>
                    setForm((current) => (current ? { ...current, featured: !current.featured } : current))
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                    官方精选
                  </div>
                  <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                    在卡片和详情页突出展示，并支持用户一键筛选。
                  </p>
                </SelectionCard>

                <SelectionCard
                  as="button"
                  selected={form.visibility === 'showcase'}
                  onClick={() =>
                    setForm((current) =>
                      current
                        ? { ...current, visibility: current.visibility === 'showcase' ? 'internal' : 'showcase' }
                        : current,
                    )
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    {form.visibility === 'showcase' ? (
                      <Eye className="h-4 w-4 text-[var(--brand-primary)]" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-[var(--text-secondary)]" />
                    )}
                    商店展示
                  </div>
                  <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                    关闭后仅超管后台可见，普通用户技能商店不显示。
                  </p>
                </SelectionCard>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="元信息" icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile label="创建时间" value={formatDate(skill.createdAt)} />
              <InfoTile label="最后更新时间" value={formatDate(skill.updatedAt)} />
              <InfoTile label="最新版本" value={skill.version || '未配置'} />
            </div>
          </DrawerSection>

          {error ? (
            <InfoTile
              label="保存错误"
              value={
                <span className="inline-flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </span>
              }
              tone="warning"
            />
          ) : null}
        </div>

        <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-5 dark:border-t-[rgba(255,255,255,0.08)] dark:bg-[rgba(12,12,12,0.86)]">
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
                    featured: form.featured,
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
