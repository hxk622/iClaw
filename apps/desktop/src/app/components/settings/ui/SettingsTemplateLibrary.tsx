import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { CompactSegmentedControl } from '@/app/components/ui/CompactSegmentedControl';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { cn } from '@/app/lib/cn';
import type {
  SettingsMarkdownTemplate,
  SettingsMarkdownTemplateGroup,
} from '@/app/components/settings/markdown-template-catalog';

type TemplateApplyMode = 'replace' | 'append';

export function SettingsTemplateLibrary({
  title = '模板库',
  description,
  groups,
  onApplyTemplate,
}: {
  title?: string;
  description?: string;
  groups: SettingsMarkdownTemplateGroup[];
  onApplyTemplate: (template: SettingsMarkdownTemplate, mode: TemplateApplyMode) => void;
}) {
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id ?? '');

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null,
    [activeGroupId, groups],
  );

  if (!activeGroup) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-card)_92%,var(--bg-hover))] p-4 shadow-none">
      <div className="flex flex-col gap-3 border-b border-[color:color-mix(in_srgb,var(--border-default)_72%,transparent)] pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <Wand2 className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>{title}</span>
          </div>
          {description ? (
            <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</div>
          ) : null}
        </div>
        <CompactSegmentedControl
          options={groups.map((group) => ({ value: group.id, label: group.label }))}
          value={activeGroup.id}
          onChange={setActiveGroupId}
          className="w-full md:w-auto"
          itemClassName="flex-1 text-[12px] md:flex-none"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {activeGroup.templates.map((template) => (
          <SelectionCard
            key={template.id}
            className={cn(
              'rounded-[18px] border-[color:color-mix(in_srgb,var(--border-default)_78%,transparent)] p-4',
              'bg-[color:color-mix(in_srgb,var(--bg-card)_86%,transparent)]',
            )}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">{template.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                  {template.description}
                </div>
              </div>
              <span className="rounded-full border border-[color:color-mix(in_srgb,var(--brand-primary)_24%,var(--border-default))] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)] px-2.5 py-1 text-[10px] font-medium text-[var(--brand-primary)]">
                预设
              </span>
            </div>

            <pre className="mt-3 overflow-hidden rounded-[14px] border border-[color:color-mix(in_srgb,var(--border-default)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-page)_92%,transparent)] px-3 py-2.5 text-[11px] leading-5 text-[var(--text-secondary)] whitespace-pre-wrap">
              {template.content}
            </pre>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-1.5 text-[12px]"
                onClick={() => onApplyTemplate(template, 'append')}
              >
                追加到当前内容
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="px-3 py-1.5 text-[12px]"
                onClick={() => onApplyTemplate(template, 'replace')}
              >
                覆盖为此模板
              </Button>
            </div>
          </SelectionCard>
        ))}
      </div>
    </div>
  );
}
