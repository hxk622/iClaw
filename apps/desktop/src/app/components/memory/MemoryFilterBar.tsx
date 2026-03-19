import type { ReactNode } from 'react';
import { Calendar, Tag as TagIcon, Upload, X } from 'lucide-react';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { PageContent } from '@/app/components/ui/PageLayout';

import type { MemoryArrayFilterKey, MemoryFilters } from './model';
import {
  DOMAIN_OPTIONS,
  IMPORTANCE_OPTIONS,
  SOURCE_OPTIONS,
  TIME_RANGE_OPTIONS,
  TYPE_OPTIONS,
} from './model';

export function MemoryFilterBar({
  filters,
  availableTags,
  hasActiveFilters,
  onToggleFilter,
  onToggleBoolean,
  onClear,
}: {
  filters: MemoryFilters;
  availableTags: string[];
  hasActiveFilters: boolean;
  onToggleFilter: <K extends MemoryArrayFilterKey>(key: K, value: MemoryFilters[K][number]) => void;
  onToggleBoolean: (key: 'onlyAutoCaptured' | 'onlyHighImportance') => void;
  onClear: () => void;
}) {
  return (
    <section className="border-b border-[#ECE7DE] bg-[#FCFBF8] py-3.5">
      <PageContent className="max-w-[1480px] py-0">
        <div className="mb-3 flex items-center gap-4">
          <FilterGroup label="领域">
            {DOMAIN_OPTIONS.map((domain) => (
              <FilterChip
                key={domain}
                active={filters.domains.includes(domain)}
                onClick={() => onToggleFilter('domains', domain)}
              >
                {domain}
              </FilterChip>
            ))}
          </FilterGroup>

          <Divider />

          <FilterGroup label="类型">
            {TYPE_OPTIONS.map((type) => (
              <FilterChip
                key={type}
                active={filters.types.includes(type)}
                onClick={() => onToggleFilter('types', type)}
              >
                {type}
              </FilterChip>
            ))}
          </FilterGroup>

          <Divider />

          <FilterGroup label="重要性">
            {IMPORTANCE_OPTIONS.map((importance) => (
              <FilterChip
                key={importance}
                active={filters.importance.includes(importance)}
                onClick={() => onToggleFilter('importance', importance)}
              >
                {importance}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>

        <div className="flex items-center gap-4">
          <FilterGroup label="来源" leadingIcon={<Upload size={13} strokeWidth={1.5} className="text-[#9A9288]" />}>
            {SOURCE_OPTIONS.map((source) => (
              <FilterChip
                key={source}
                active={filters.sourceTypes.includes(source)}
                onClick={() => onToggleFilter('sourceTypes', source)}
              >
                {source}
              </FilterChip>
            ))}
          </FilterGroup>

          <Divider />

          <FilterGroup label="时间" leadingIcon={<Calendar size={13} strokeWidth={1.5} className="text-[#9A9288]" />}>
            {TIME_RANGE_OPTIONS.map((range) => (
              <FilterChip
                key={range}
                active={filters.timeRange.includes(range)}
                onClick={() => onToggleFilter('timeRange', range)}
              >
                {range}
              </FilterChip>
            ))}
          </FilterGroup>

          <Divider />

          <FilterGroup label="标签" leadingIcon={<TagIcon size={13} strokeWidth={1.5} className="text-[#9A9288]" />}>
            {availableTags.slice(0, 6).map((tag) => (
              <FilterChip key={tag} active={filters.tags.includes(tag)} onClick={() => onToggleFilter('tags', tag)}>
                {tag}
              </FilterChip>
            ))}
          </FilterGroup>

          <div className="ml-auto flex items-center gap-2">
            <FilterChip active={filters.onlyAutoCaptured} onClick={() => onToggleBoolean('onlyAutoCaptured')}>
              仅自动捕获
            </FilterChip>
            <FilterChip active={filters.onlyHighImportance} onClick={() => onToggleBoolean('onlyHighImportance')}>
              仅高重要性
            </FilterChip>
            {hasActiveFilters ? (
              <FilterPill
                onClick={onClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
              >
                <X size={13} strokeWidth={1.5} />
                清除
              </FilterPill>
            ) : null}
          </div>
        </div>
      </PageContent>
    </section>
  );
}

function FilterGroup({
  label,
  leadingIcon,
  children,
}: {
  label: string;
  leadingIcon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {leadingIcon ? leadingIcon : null}
      <div className="min-w-[52px] text-[11px] text-[#9A9288]">{label}</div>
      <div className="flex gap-1.5">{children}</div>
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

function Divider() {
  return <div className="h-5 w-px bg-[#DED7CC]" />;
}
