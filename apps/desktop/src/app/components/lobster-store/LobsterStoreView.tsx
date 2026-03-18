import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import { AlertCircle } from 'lucide-react';

import type { AppUserAvatarSource } from '@/app/lib/user-avatar';
import {
  type LobsterAgent,
  type LobsterStoreTab,
  installLobsterAgent,
  loadLobsterAgents,
  uninstallLobsterAgent,
} from '@/app/lib/lobster-store';
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
    <div className="min-w-0 flex-1 overflow-y-auto bg-[var(--lobster-page-bg)]">
      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--lobster-gold-strong)]">
              Lobster Library
            </div>
            <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.06em] text-[var(--lobster-text-primary)]">
              龙虾商店
            </h1>
            <p className="mt-3 max-w-[720px] text-[15px] leading-8 text-[var(--lobster-text-secondary)]">
              你的专属 AI 助手库。海量精选 Agent 随心挑选，一键装配，即刻开工。
              {currentUser ? ' 已登录后可将预设助手加入“我的龙虾”。' : ''}
            </p>
          </div>
          <LobsterStoreTabs activeTab={activeTab} installedCount={installedAgents.length} onChange={setActiveTab} />
        </div>

        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-[22px] border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] px-5 py-4 text-[14px] leading-7 text-[var(--lobster-danger-text)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[340px] animate-pulse rounded-[32px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)]"
              />
            ))}
          </div>
        ) : activeTab === 'shop' ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
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
          <div className="mt-8">
            <MyLobsterView
              agents={installedAgents}
              removeBusySlug={removeBusySlug}
              onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
              onRemove={handleRemove}
            />
          </div>
        )}
      </div>

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
    </div>
  );
}
