import type { ReactNode } from 'react';
import { Calendar, Clock3, Search, Tag as TagIcon, Upload, X } from 'lucide-react';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';

import type { MemoryArrayFilterKey, MemoryFilters } from './model';
import {
  DOMAIN_OPTIONS,
  RECALL_OPTIONS,
  SOURCE_OPTIONS,
  TIME_RANGE_OPTIONS,
  TYPE_OPTIONS,
} from './model';

export function MemoryFilterBar({
  searchQuery,
  filters,
  availableTags,
  hasActiveFilters,
  onSearchChange,
  onToggleFilter,
  onToggleBoolean,
  onClear,
}: {
  searchQuery: string;
  filters: MemoryFilters;
  availableTags: string[];
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onToggleFilter: <K extends MemoryArrayFilterKey>(key: K, value: MemoryFilters[K][number]) => void;
  onToggleBoolean: (key: 'onlyAutoCaptured') => void;
  onClear: () => void;
}) {
  return (
    <SurfacePanel tone="subtle" className="rounded-[20px] border-[var(--border-default)] p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜标题、内容、标签或来源"
              className="h-10 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[12px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filters.onlyAutoCaptured} onClick={() => onToggleBoolean('onlyAutoCaptured')}>
              仅自动捕获
            </FilterChip>
            {hasActiveFilters ? (
              <FilterPill onClick={onClear} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]">
                <X size={13} strokeWidth={1.5} />
                清除筛选
              </FilterPill>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--border-default)] pt-2.5">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start gap-x-5 gap-y-2.5">
              <InlineFilterGroup label="领域">
                {DOMAIN_OPTIONS.map((domain) => (
                  <FilterChip
                    key={domain}
                    active={filters.domains.includes(domain)}
                    onClick={() => onToggleFilter('domains', domain)}
                  >
                    {domain}
                  </FilterChip>
                ))}
              </InlineFilterGroup>

              <InlineFilterGroup label="类型">
                {TYPE_OPTIONS.map((type) => (
                  <FilterChip key={type} active={filters.types.includes(type)} onClick={() => onToggleFilter('types', type)}>
                    {type}
                  </FilterChip>
                ))}
              </InlineFilterGroup>
            </div>

            <div className="flex flex-wrap items-start gap-x-5 gap-y-2.5">
              <InlineFilterGroup
                label="来源"
                leadingIcon={<Upload size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />}
              >
                {SOURCE_OPTIONS.map((source) => (
                  <FilterChip
                    key={source}
                    active={filters.sourceTypes.includes(source)}
                    onClick={() => onToggleFilter('sourceTypes', source)}
                  >
                    {source}
                  </FilterChip>
                ))}
              </InlineFilterGroup>

              <InlineFilterGroup
                label="时间"
                leadingIcon={<Calendar size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />}
              >
                {TIME_RANGE_OPTIONS.map((range) => (
                  <FilterChip
                    key={range}
                    active={filters.timeRange.includes(range)}
                    onClick={() => onToggleFilter('timeRange', range)}
                  >
                    {range}
                  </FilterChip>
                ))}
              </InlineFilterGroup>

              <InlineFilterGroup
                label="使用情况"
                leadingIcon={<Clock3 size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />}
              >
                {RECALL_OPTIONS.map((state) => (
                  <FilterChip
                    key={state}
                    active={filters.recalledState.includes(state)}
                    onClick={() => onToggleFilter('recalledState', state)}
                  >
                    {state}
                  </FilterChip>
                ))}
              </InlineFilterGroup>

              <InlineFilterGroup
                label="标签"
                leadingIcon={<TagIcon size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />}
              >
                {availableTags.length > 0 ? (
                  availableTags.slice(0, 6).map((tag) => (
                    <FilterChip key={tag} active={filters.tags.includes(tag)} onClick={() => onToggleFilter('tags', tag)}>
                      {tag}
                    </FilterChip>
                  ))
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">暂无标签</span>
                )}
              </InlineFilterGroup>
            </div>
          </div>
        </div>
      </div>
    </SurfacePanel>
  );
}

function InlineFilterGroup({
  label,
  leadingIcon,
  children,
}: {
  label: string;
  leadingIcon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        {leadingIcon ? leadingIcon : null}
        <div className="text-[11px] font-medium text-[var(--text-muted)]">{label}</div>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <FilterPill active={active} onClick={onClick} className="px-2.5 py-1 text-[11px]">
      {children}
    </FilterPill>
  );
}
