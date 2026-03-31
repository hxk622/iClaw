import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import { AlertCircle, Info, Search } from 'lucide-react';

import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { STORE_SHELF_GRID_CLASS } from '@/app/components/ui/store-shelf';
import {
  INVESTMENT_EXPERT_CATEGORIES,
  hydrateInvestmentExperts,
  type InvestmentExpert,
  type InvestmentExpertFilter,
  type InvestmentExpertTab,
} from '@/app/lib/investment-experts';
import { cn } from '@/app/lib/cn';
import { installLobsterAgent, loadLobsterAgents } from '@/app/lib/lobster-store';
import { InvestmentExpertCard } from './InvestmentExpertCard';
import { InvestmentExpertDetailDialog } from './InvestmentExpertDetailDialog';
import { MyInvestmentExpertsView } from './MyInvestmentExpertsView';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

function matchesQuery(expert: InvestmentExpert, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    expert.name,
    expert.subtitle,
    expert.description,
    ...expert.tags,
    ...expert.skills.map((item) => `${item.title} ${item.description}`),
    ...expert.taskExamples,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function InvestmentExpertsView({
  title,
  client,
  accessToken,
  authenticated,
  onRequestAuth,
  onStartConversation,
}: {
  title: string;
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', postAuthView?: 'account' | null) => void;
  onStartConversation: (expert: InvestmentExpert) => void;
}) {
  const [activeTab, setActiveTab] = useState<InvestmentExpertTab>('all');
  const [activeFilter, setActiveFilter] = useState<InvestmentExpertFilter>('all');
  const [query, setQuery] = useState('');
  const [experts, setExperts] = useState<InvestmentExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [installBusySlug, setInstallBusySlug] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const agents = await loadLobsterAgents({client, accessToken});
      setExperts(hydrateInvestmentExperts(agents));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载智能投资专家失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [accessToken, client]);

  const selectedExpert = useMemo(
    () => experts.find((expert) => expert.slug === detailSlug) ?? null,
    [detailSlug, experts],
  );

  const shopExperts = useMemo(() => {
    return experts.filter((expert) => {
      const matchesCategory = activeFilter === 'all' || expert.category === activeFilter;
      return matchesCategory && matchesQuery(expert, normalizedQuery);
    });
  }, [activeFilter, experts, normalizedQuery]);

  const myExperts = useMemo(() => {
    return experts.filter((expert) => {
      if (!expert.installed) {
        return false;
      }
      const matchesCategory = activeFilter === 'all' || expert.category === activeFilter;
      return matchesCategory && matchesQuery(expert, normalizedQuery);
    });
  }, [activeFilter, experts, normalizedQuery]);

  const groupedExperts = useMemo(() => {
    return INVESTMENT_EXPERT_CATEGORIES.filter((category) => category.id !== 'all')
      .map((category) => ({
        id: category.id,
        label: category.label,
        color: category.color,
        experts: shopExperts.filter((expert) => expert.category === category.id),
      }))
      .filter((group) => group.experts.length > 0);
  }, [shopExperts]);

  const installedCount = useMemo(
    () => experts.filter((expert) => expert.installed).length,
    [experts],
  );

  const handleInstall = async (target: InvestmentExpert) => {
    if (!accessToken || !authenticated) {
      onRequestAuth('login');
      return;
    }

    setInstallBusySlug(target.slug);
    setError(null);
    try {
      await installLobsterAgent({client, accessToken, slug: target.slug});
      await refresh();
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : '安装失败');
    } finally {
      setInstallBusySlug(null);
    }
  };

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-4 py-5 lg:px-5 xl:px-6">
        <PageHeader
          className="gap-3"
          title={title}
          description="AI智能体 · 专业投资研究与资产配置专家团队"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[28px] font-semibold tracking-[-0.045em] text-[var(--lobster-text-primary)]"
          descriptionClassName="mt-0 text-[15px] leading-7 text-[var(--lobster-text-secondary)]"
          actions={
            <label className="relative block w-full min-w-[260px] max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lobster-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索专家、策略、市场方向…"
                className="h-11 w-full rounded-[12px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] pl-10 pr-4 text-[14px] text-[var(--lobster-text-primary)] outline-none transition placeholder:text-[var(--lobster-text-muted)] focus:border-[var(--lobster-gold-border-strong)] focus:ring-2 focus:ring-[rgba(168,140,93,0.14)]"
              />
            </label>
          }
        />

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] px-4 py-3 text-[14px] leading-7 text-[var(--lobster-danger-text)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-5 border-b border-[var(--lobster-border)]">
          <div className="flex items-center gap-7">
            {([
              { id: 'all', label: '全部专家' },
              { id: 'mine', label: '我的专家' },
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative inline-flex items-center gap-2 pb-3 text-[15px] font-semibold transition cursor-pointer',
                    SPRING_PRESSABLE,
                    INTERACTIVE_FOCUS_RING,
                    active
                      ? 'text-[var(--lobster-text-primary)]'
                      : 'text-[var(--lobster-text-muted)] hover:text-[var(--lobster-text-primary)]',
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'mine' && installedCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--lobster-gold-soft)] px-1.5 text-[11px] font-medium text-[var(--lobster-gold-strong)]">
                      {installedCount}
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[var(--lobster-gold-strong)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {INVESTMENT_EXPERT_CATEGORIES.map((category) => {
            const active = activeFilter === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveFilter(category.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium transition cursor-pointer',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  active
                    ? 'bg-[linear-gradient(180deg,#ccb27b_0%,#b49154_100%)] text-[#120e09] shadow-[0_8px_20px_rgba(168,140,93,0.16)]'
                    : 'bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-primary)] hover:bg-[color:color-mix(in_srgb,var(--lobster-muted-bg)_82%,white)]',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? 'rgba(18,14,9,0.72)' : category.color }}
                />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-4 py-3 text-[13px] leading-7 text-[var(--lobster-text-secondary)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lobster-text-muted)]" />
          <span>每位智能投资专家都是独立AI智能体，可接受指令、自主完成投研任务并输出结构化结果。</span>
        </div>

        {loading ? (
          <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[316px] animate-pulse rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)]"
              />
            ))}
          </div>
        ) : activeTab === 'all' ? (
          <div className="mt-7 space-y-8">
            {groupedExperts.length > 0 ? (
              groupedExperts.map((group) => (
                <section key={group.id}>
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <h2 className="text-[18px] font-semibold text-[var(--lobster-text-primary)]">
                      {group.label}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-[var(--lobster-muted-bg)] px-2.5 py-0.5 text-[12px] text-[var(--lobster-text-secondary)]">
                      {group.experts.length}
                    </span>
                  </div>

                  <div className={STORE_SHELF_GRID_CLASS}>
                    {group.experts.map((expert) => (
                      <InvestmentExpertCard
                        key={expert.slug}
                        expert={expert}
                        installBusy={installBusySlug === expert.slug}
                        onOpenDetail={(nextExpert) => setDetailSlug(nextExpert.slug)}
                        onInstall={handleInstall}
                        onStartConversation={onStartConversation}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-[20px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-6 text-center">
                <div>
                  <div className="text-[18px] font-semibold text-[var(--lobster-text-primary)]">
                    未找到匹配的专家
                  </div>
                  <div className="mt-2 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
                    可以切换分类、清空关键词，或换一个更具体的方向试试。
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-7">
            <MyInvestmentExpertsView
              experts={myExperts}
              onOpenDetail={(expert) => setDetailSlug(expert.slug)}
              onInstall={handleInstall}
              onStartConversation={onStartConversation}
            />
          </div>
        )}
      </PageContent>

      <InvestmentExpertDetailDialog
        expert={selectedExpert}
        open={Boolean(selectedExpert)}
        installBusy={selectedExpert ? installBusySlug === selectedExpert.slug : false}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDetailSlug(null);
          }
        }}
        onInstall={handleInstall}
        onStartConversation={onStartConversation}
      />
    </PageSurface>
  );
}
