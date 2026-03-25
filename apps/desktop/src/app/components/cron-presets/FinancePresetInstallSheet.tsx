import { Bell, Calendar, Clock, FileText, Moon, PieChart, ShieldAlert, Sun, Sunrise, Sunset, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { CompactSegmentedControl } from '@/app/components/ui/CompactSegmentedControl';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { Select } from '@/app/components/ui/Select';
import { SideDetailSheet } from '@/app/components/ui/SideDetailSheet';
import {
  FINANCE_OUTPUT_OPTIONS,
  FINANCE_SELECTION_SCOPE_OPTIONS,
  buildFinancePresetJobName,
  buildFinancePresetPrompt,
  type FinancePresetInstallConfig,
  type FinancePresetMarket,
  type FinancePresetOutputFormat,
  type FinancePresetSelectionScope,
  type FinancePresetTaskTemplate,
} from '@/app/lib/finance-cron-presets';
import { cn } from '@/app/lib/cn';

const ICON_MAP = {
  sunrise: Sunrise,
  sun: Sun,
  sunset: Sunset,
  moon: Moon,
  bell: Bell,
  'file-text': FileText,
  calendar: Calendar,
  'shield-alert': ShieldAlert,
  'trending-up': TrendingUp,
  'pie-chart': PieChart,
};

const ACCENT_CLASS_MAP: Record<FinancePresetTaskTemplate['accent'], string> = {
  amber: 'bg-[rgba(196,152,80,0.12)] text-[rgb(180,100,24)] dark:text-[#f8d48f]',
  gold: 'bg-[rgba(168,140,93,0.12)] text-[rgb(143,119,81)] dark:text-[#e7cfaa]',
  orange: 'bg-[rgba(184,101,79,0.12)] text-[rgb(159,91,70)] dark:text-[#f2cfbf]',
  violet: 'bg-[rgba(107,99,184,0.14)] text-[rgb(90,80,170)] dark:text-[#d8d4ff]',
  rose: 'bg-[rgba(184,79,79,0.12)] text-[rgb(184,79,79)] dark:text-[#f0b5b5]',
  blue: 'bg-[rgba(72,117,184,0.12)] text-[rgb(51,91,153)] dark:text-[#cfe0ff]',
  green: 'bg-[rgba(74,107,90,0.12)] text-[rgb(74,107,90)] dark:text-[#c7f9d7]',
  red: 'bg-[rgba(184,79,79,0.12)] text-[rgb(184,79,79)] dark:text-[#fecaca]',
};

export function FinancePresetInstallSheet({
  task,
  saving,
  onClose,
  onInstall,
}: {
  task: FinancePresetTaskTemplate | null;
  saving: boolean;
  onClose: () => void;
  onInstall: (input: {
    task: FinancePresetTaskTemplate;
    jobName: string;
    prompt: string;
    schedule: {
      kind: 'cron';
      expr: string;
    };
  }) => Promise<void> | void;
}) {
  const [markets, setMarkets] = useState<FinancePresetMarket[]>([]);
  const [selectionScope, setSelectionScope] = useState<FinancePresetSelectionScope>('全部自选');
  const [scheduleId, setScheduleId] = useState('');
  const [outputFormat, setOutputFormat] = useState<FinancePresetOutputFormat>('摘要');
  const [focusKeywords, setFocusKeywords] = useState('');

  useEffect(() => {
    if (!task) return;
    setMarkets(task.defaultMarkets);
    setSelectionScope(task.defaultSelectionScope);
    setScheduleId(task.scheduleChoices[0]?.id || '');
    setOutputFormat(task.defaultOutputFormat);
    setFocusKeywords('');
  }, [task]);

  const config = useMemo<FinancePresetInstallConfig | null>(() => {
    if (!task || !scheduleId) return null;
    return {
      markets,
      selectionScope,
      scheduleId,
      outputFormat,
      focusKeywords,
    };
  }, [focusKeywords, markets, outputFormat, scheduleId, selectionScope, task]);

  if (!task || !config) {
    return null;
  }

  const Icon = ICON_MAP[task.icon] || FileText;
  const selectedSchedule = task.scheduleChoices.find((item) => item.id === scheduleId) || task.scheduleChoices[0];
  const previewPrompt = buildFinancePresetPrompt(task, config);
  const previewName = buildFinancePresetJobName(task, config);

  const scheduleExpr = buildCronExpr(selectedSchedule.frequency, selectedSchedule.runTime, selectedSchedule.weekday);

  const toggleMarket = (market: FinancePresetMarket) => {
    setMarkets((current) =>
      current.includes(market) ? current.filter((item) => item !== market) : [...current, market],
    );
  };

  return (
    <SideDetailSheet
      open
      onClose={onClose}
      eyebrow="官方模板安装"
      title={task.name}
      header={
        <div className="flex items-start gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]', ACCENT_CLASS_MAP[task.accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{task.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" block onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            block
            disabled={saving || markets.length === 0}
            onClick={() =>
              void onInstall({
                task,
                jobName: previewName,
                prompt: previewPrompt,
                schedule: {
                  kind: 'cron',
                  expr: scheduleExpr,
                },
              })
            }
          >
            {saving ? '安装中…' : '安装任务'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <DrawerSection
          title="模板概览"
          description="安装后会在指定节奏自动执行，并进入“我的任务”统一管理。"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoTile label="默认时间" value={task.defaultTime} />
            <InfoTile label="输出方式" value={task.outputType} />
            <InfoTile label="模板分类" value={task.category} />
          </div>
        </DrawerSection>

        <DrawerSection
          title="安装配置"
          description="先补充少量参数。后续如果需要更细的安排，可以在“我的任务”里继续调整。"
        >
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">市场范围</div>
              <div className="flex flex-wrap gap-2">
                {(['A股', '美股', '港股', '宏观', '基金', '加密'] as FinancePresetMarket[]).map((market) => (
                  <FilterPill key={market} active={markets.includes(market)} onClick={() => toggleMarket(market)}>
                    {market}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">自选范围</div>
              <div className="flex flex-wrap gap-2">
                {FINANCE_SELECTION_SCOPE_OPTIONS.map((option) => (
                  <FilterPill key={option} active={selectionScope === option} onClick={() => setSelectionScope(option)}>
                    {option}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">执行节奏</div>
                <Select
                  value={scheduleId}
                  options={task.scheduleChoices.map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.detail,
                  }))}
                  onChange={setScheduleId}
                />
              </div>

              <div>
                <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">输出方式</div>
                <CompactSegmentedControl
                  options={FINANCE_OUTPUT_OPTIONS.map((option) => ({ value: option, label: option }))}
                  value={outputFormat}
                  onChange={setOutputFormat}
                  className="w-full justify-between"
                  itemClassName="flex-1"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">关注对象</div>
              <input
                value={focusKeywords}
                onChange={(event) => setFocusKeywords(event.target.value)}
                placeholder="输入股票、基金、行业或关键词"
                className={cn(
                  'h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition',
                  'placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_16%,transparent)]',
                )}
              />
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="安装预览" description="下面是安装后会生成的任务摘要和执行内容。">
          <div className="grid gap-3">
            <InfoTile label="任务名称" value={previewName} />
            <InfoTile label="执行节奏" value={selectedSchedule.label} description={selectedSchedule.detail} />
            <InfoTile
              label="任务内容"
              value={<pre className="whitespace-pre-wrap font-sans text-[13px] leading-6 text-[var(--text-primary)]">{previewPrompt}</pre>}
            />
          </div>
        </DrawerSection>
      </div>
    </SideDetailSheet>
  );
}

function buildCronExpr(frequency: 'daily' | 'weekly', runTime: string, weekday?: string): string {
  const [hours, minutes] = runTime.split(':').map((value) => Number(value));
  const safeHours = Number.isFinite(hours) ? hours : 8;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;

  if (frequency === 'weekly') {
    return `${safeMinutes} ${safeHours} * * ${weekday || '0'}`;
  }

  return `${safeMinutes} ${safeHours} * * *`;
}
