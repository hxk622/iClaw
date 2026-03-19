import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import { AlertCircle, Sparkles } from 'lucide-react';

import type { AppUserAvatarSource } from '@/app/lib/user-avatar';
import { Chip } from '@/app/components/ui/Chip';
import {
  type LobsterAgent,
  type LobsterStoreCategory,
  type LobsterStoreTab,
  installLobsterAgent,
  loadLobsterAgents,
  uninstallLobsterAgent,
} from '@/app/lib/lobster-store';
import { PageContent, PageSurface } from '@/app/components/ui/PageLayout';
import { PageHeader } from '@/app/components/ui/PageLayout';
import { LobsterAgentCard } from './LobsterAgentCard';
import { LobsterAgentDetailDialog } from './LobsterAgentDetailDialog';
import { LobsterStoreTabs } from './LobsterStoreTabs';
import { MyLobsterView } from './MyLobsterView';

export function LobsterStoreView({
  client,
  accessToken,
  authenticated,
  currentUser,
  onRequestAuth,
}: {
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  currentUser: AppUserAvatarSource;
  onRequestAuth: (mode?: 'login' | 'register', postAuthView?: 'account' | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<LobsterStoreTab>('shop');
  const [agents, setAgents] = useState<LobsterAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [installBusySlug, setInstallBusySlug] = useState<string | null>(null);
  const [removeBusySlug, setRemoveBusySlug] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'featured' | LobsterStoreCategory>('all');

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextAgents = await loadLobsterAgents({ client, accessToken });
      setAgents(nextAgents);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载龙虾商店失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [accessToken, client]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.slug === detailSlug) || null,
    [agents, detailSlug],
  );
  const installedAgents = useMemo(() => agents.filter((agent) => agent.installed), [agents]);
  const featuredAgents = useMemo(() => agents.filter((agent) => agent.featured), [agents]);
  const filteredAgents = useMemo(() => {
    if (activeFilter === 'all') {
      return agents;
    }
    if (activeFilter === 'featured') {
      return featuredAgents;
    }
    return agents.filter((agent) => agent.category === activeFilter);
  }, [activeFilter, agents, featuredAgents]);

  const filters: Array<{
    id: 'all' | 'featured' | LobsterStoreCategory;
    label: string;
    count: number;
    featured?: boolean;
  }> = useMemo(
    () => [
      { id: 'all', label: '全部', count: agents.length },
      { id: 'featured', label: '官方精选', count: featuredAgents.length, featured: true },
      { id: 'finance', label: '金融研究', count: agents.filter((agent) => agent.category === 'finance').length },
      { id: 'content', label: '内容增长', count: agents.filter((agent) => agent.category === 'content').length },
      { id: 'productivity', label: '效率办公', count: agents.filter((agent) => agent.category === 'productivity').length },
      { id: 'commerce', label: '跨境电商', count: agents.filter((agent) => agent.category === 'commerce').length },
    ],
    [agents, featuredAgents.length],
  );

  const requireAuthBeforeInstall = () => {
    onRequestAuth('login');
  };

  const handleInstall = async (agent: LobsterAgent) => {
    if (!accessToken || !authenticated) {
      requireAuthBeforeInstall();
      return;
    }

    setInstallBusySlug(agent.slug);
    setError(null);
    try {
      await installLobsterAgent({ client, accessToken, slug: agent.slug });
      await refresh();
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : '添加失败');
    } finally {
      setInstallBusySlug(null);
    }
  };

  const handleRemove = async (agent: LobsterAgent) => {
    if (!accessToken || !authenticated) {
      requireAuthBeforeInstall();
      return;
    }

    setRemoveBusySlug(agent.slug);
    setError(null);
    try {
      await uninstallLobsterAgent({ client, accessToken, slug: agent.slug });
      await refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除失败');
    } finally {
      setRemoveBusySlug(null);
    }
  };

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-[1480px] py-7">
        <PageHeader
          eyebrow="Lobster Store"
          title="龙虾商店"
          description={`你的专属 AI 助手库。精选 Agent 一键装配，即刻开工。${currentUser ? ' 已登录后可将预设助手加入“我的龙虾”。' : ''}`}
          eyebrowClassName="text-[var(--lobster-gold-strong)]"
          titleClassName="text-[var(--lobster-text-primary)]"
          descriptionClassName="text-[var(--lobster-text-secondary)]"
          actions={<LobsterStoreTabs activeTab={activeTab} installedCount={installedAgents.length} onChange={setActiveTab} />}
        />

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-[18px] border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-danger-text)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[248px] animate-pulse rounded-[24px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)]"
              />
            ))}
          </div>
        ) : activeTab === 'shop' ? (
          <div className="mt-5">
            <div className="rounded-[22px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-4 py-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--lobster-text-primary)]">精选助手库</div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--lobster-text-secondary)]">
                      按职能筛选，像浏览商店货架一样挑选合适助手。
                    </div>
                  </div>
                  <div className="text-[12px] text-[var(--lobster-text-muted)]">当前展示 {filteredAgents.length} 个助手</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <Chip
                      key={filter.id}
                      clickable
                      tone={activeFilter === filter.id ? 'accent' : 'outline'}
                      leadingIcon={filter.featured ? <Sparkles className="h-3 w-3" /> : undefined}
                      className="gap-1.5 px-3 py-1.5 text-[12px] font-medium shadow-none"
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      <span>{filter.label}</span>
                      <span className="text-[11px] opacity-75">{filter.count}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            {filteredAgents.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredAgents.map((agent) => (
                  <LobsterAgentCard
                    key={agent.slug}
                    agent={agent}
                    installBusy={installBusySlug === agent.slug}
                    onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-6 text-center">
                <div>
                  <div className="text-[16px] font-medium text-[var(--lobster-text-primary)]">当前筛选下暂无助手</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
                    可以切换其它分类，或先查看官方精选。
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <MyLobsterView
              agents={installedAgents}
              removeBusySlug={removeBusySlug}
              onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
              onRemove={handleRemove}
            />
          </div>
        )}
      </PageContent>

      <LobsterAgentDetailDialog
        agent={selectedAgent}
        open={Boolean(selectedAgent)}
        installBusy={selectedAgent ? installBusySlug === selectedAgent.slug : false}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSlug(null);
          }
        }}
        onInstall={handleInstall}
      />
    </PageSurface>
  );
}
