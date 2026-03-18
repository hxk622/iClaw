import type { ReactNode } from 'react';
import { FolderGit2, Tag, X } from 'lucide-react';

import { Chip } from '@/app/components/ui/Chip';
import type { MemoryFilters } from './model';
import {
  DOMAIN_OPTIONS,
  IMPORTANCE_OPTIONS,
  RECALL_OPTIONS,
  SOURCE_OPTIONS,
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
  onToggleFilter: <K extends keyof MemoryFilters>(key: K, value: MemoryFilters[K][number]) => void;
  onToggleBoolean: (key: 'onlyAutoCaptured' | 'onlyHighImportance') => void;
  onClear: () => void;
}) {
  return (
    <section className="border-b border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-8 py-4">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterGroup label="来源" leadingIcon={<FolderGit2 className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}>
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

          <FilterGroup label="标签" leadingIcon={<Tag className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}>
            {availableTags.slice(0, 6).map((tag) => (
              <FilterChip key={tag} active={filters.tags.includes(tag)} onClick={() => onToggleFilter('tags', tag)}>
                {tag}
              </FilterChip>
            ))}
          </FilterGroup>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {RECALL_OPTIONS.map((state) => (
              <FilterChip
                key={state}
                active={filters.recalledState.includes(state)}
                onClick={() => onToggleFilter('recalledState', state)}
              >
                {state}
              </FilterChip>
            ))}
            <FilterChip active={filters.onlyAutoCaptured} onClick={() => onToggleBoolean('onlyAutoCaptured')}>
              仅自动捕获
            </FilterChip>
            <FilterChip active={filters.onlyHighImportance} onClick={() => onToggleBoolean('onlyHighImportance')}>
              仅高重要性
            </FilterChip>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-[var(--lobster-text-secondary)] transition-colors hover:text-[var(--lobster-text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
                清除
              </button>
            ) : null}
          </div>
        </div>
      </div>
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
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex min-w-[56px] items-center gap-1.5 text-[12px] text-[var(--lobster-text-muted)]">
        {leadingIcon}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
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
    <Chip
      clickable
      active={active}
      tone="outline"
      onClick={onClick}
      className={
        active
          ? 'rounded-[10px] border-[var(--lobster-gold-border-strong)] bg-[var(--lobster-gold-soft)] px-3 py-1.5 text-[12px] text-[var(--lobster-text-primary)]'
          : 'rounded-[10px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-3 py-1.5 text-[12px] text-[var(--lobster-text-secondary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-bg)]'
      }
    >
      {children}
    </Chip>
  );
}

function Divider() {
  return <div className="hidden h-5 w-px bg-[var(--lobster-border)] xl:block" />;
}
