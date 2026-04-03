import { Search, Bell, Calendar, FileText, Moon, PieChart, ShieldAlert, Sun, Sunrise, Sunset, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import { cn } from '@/app/lib/cn';
import {
  FINANCE_PRESET_CATEGORIES,
  FINANCE_PRESET_MARKETS,
  type FinancePresetCategory,
  type FinancePresetMarket,
  type FinancePresetTaskTemplate,
} from '@/app/lib/finance-cron-presets';

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

export function FinancePresetGallery({
  tasks,
  onInstall,
  clientReady,
}: {
  tasks: FinancePresetTaskTemplate[];
  onInstall: (task: FinancePresetTaskTemplate) => void;
  clientReady: boolean;
}) {
  const [category, setCategory] = useState<FinancePresetCategory>('全部');
  const [selectedMarkets, setSelectedMarkets] = useState<FinancePresetMarket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const categoryMatch = category === '全部' || task.category === category;
      const marketMatch =
        selectedMarkets.length === 0 || selectedMarkets.some((market) => task.tags.includes(market));
      const searchMatch =
        !query ||
        task.name.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.tags.some((tag) => tag.toLowerCase().includes(query));
      return categoryMatch && marketMatch && searchMatch;
    });
  }, [category, searchQuery, selectedMarkets, tasks]);

  const categoryItems = useMemo(
    () =>
      FINANCE_PRESET_CATEGORIES.map((item) => ({
        id: item,
        label: item,
        badge: item === '全部' ? tasks.length : tasks.filter((task) => task.category === item).length,
      })),
    [tasks],
  );

  const toggleMarket = (market: FinancePresetMarket) => {
    setSelectedMarkets((current) =>
      current.includes(market) ? current.filter((item) => item !== market) : [...current, market],
    );
  };

  return (
    <SurfacePanel className="rounded-[28px] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            官方模板
          </div>
          <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            待安装任务模板
          </h2>
          <p className="mt-1.5 max-w-[760px] text-[13px] leading-6 text-[var(--text-secondary)]">
            这里只展示尚未安装的官方预置任务。安装后会从这里移除，并进入“我的任务”独立管理。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="accent">待安装 {tasks.length}</Chip>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <SegmentedTabs items={categoryItems} activeId={category} onChange={setCategory} />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FINANCE_PRESET_MARKETS.map((market) => (
              <FilterPill key={market} active={selectedMarkets.includes(market)} onClick={() => toggleMarket(market)}>
                {market}
              </FilterPill>
            ))}
          </div>

          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索任务模板"
              className={cn(
                'h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition',
                'placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_16%,transparent)]',
              )}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTasks.map((task) => (
          <PresetTaskCard
            key={task.id}
            task={task}
            onInstall={onInstall}
            clientReady={clientReady}
          />
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-[var(--border-default)] px-5 py-10 text-center">
          <div className="text-[15px] font-medium text-[var(--text-primary)]">
            {tasks.length === 0 ? '预置任务已全部安装' : '没有找到匹配的模板'}
          </div>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            {tasks.length === 0
              ? '当前官方预置任务都已经进入“我的任务”，可以切回去继续管理。'
              : '可以尝试切换分类、市场范围，或调整关键词搜索。'}
          </p>
        </div>
      ) : null}
    </SurfacePanel>
  );
}

function PresetTaskCard({
  task,
  onInstall,
  clientReady,
}: {
  task: FinancePresetTaskTemplate;
  onInstall: (task: FinancePresetTaskTemplate) => void;
  clientReady: boolean;
}) {
  const Icon = ICON_MAP[task.icon] || FileText;

  return (
    <PressableCard
      interactive
      className="rounded-[24px] border-[var(--border-default)] p-4"
      onClick={() => onInstall(task)}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-[14px]', ACCENT_CLASS_MAP[task.accent])}>
            <Icon className="h-5 w-5" />
          </div>
          <Chip tone="outline">官方模板</Chip>
        </div>

        <div className="mt-4">
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{task.name}</h3>
          <p className="mt-2 min-h-[44px] text-[13px] leading-6 text-[var(--text-secondary)]">{task.description}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <Chip key={tag} tone="outline">
              {tag}
            </Chip>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">默认时间</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{task.defaultTime}</div>
          </div>
          <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">输出方式</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{task.outputType}</div>
          </div>
        </div>

        <div className="mt-4 pt-1">
          <Button
            variant="primary"
            size="sm"
            block
            disabled={!clientReady}
            onClick={(event) => {
              event.stopPropagation();
              onInstall(task);
            }}
          >
            一键安装
          </Button>
        </div>
      </div>
    </PressableCard>
  );
}
