import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import {
  THOUGHT_LIBRARY_TAB_CONFIG,
  getThoughtLibraryItems,
  getThoughtLibraryPanelDescription,
  getThoughtLibraryPanelTitle,
  type GraphViewMode,
  type ThoughtLibraryTab,
} from './model';
import { readThoughtLibraryState, writeThoughtLibraryState } from './persistence';
import { ThoughtLibraryChatShell } from './ThoughtLibraryChatShell';
import { buildThoughtLibraryContextPrompt } from './chat-context';
import { ThoughtLibraryEmbeddedChatSurface } from './ThoughtLibraryEmbeddedChatSurface';
import type { IClawClient } from '@iclaw/sdk';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';

export function ThoughtLibraryView({
  title,
  onOpenContextChat,
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  authBaseUrl,
  appName,
  client,
  accessToken,
  currentUser,
  authenticated,
  onRequestAuth,
  inputComposerConfig,
  welcomePageConfig,
}: {
  title: string;
  onOpenContextChat?: (input: { title: string; prompt: string }) => void;
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  authBaseUrl: string;
  appName: string;
  client: IClawClient;
  accessToken: string | null;
  currentUser: {
    name?: string | null;
    username?: string | null;
    display_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
  inputComposerConfig?: ResolvedInputComposerConfig | null;
  welcomePageConfig?: ResolvedWelcomePageConfig | null;
}) {
  const initialState = useMemo(() => readThoughtLibraryState(), []);
  const [activeTab, setActiveTab] = useState<ThoughtLibraryTab>(initialState.activeTab);
  const [selectedByTab, setSelectedByTab] = useState(initialState.selectedByTab);
  const [query, setQuery] = useState('');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('page');

  const items = useMemo(() => {
    const source = getThoughtLibraryItems(activeTab);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return source;
    return source.filter((item) =>
      [item.title, item.subtitle, item.summary, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [activeTab, query]);

  const selectedId = selectedByTab[activeTab];
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  useEffect(() => {
    if (!selectedItem) return;
    setSelectedByTab((current) => {
      if (current[activeTab] === selectedItem.id) return current;
      return { ...current, [activeTab]: selectedItem.id };
    });
  }, [activeTab, selectedItem]);

  useEffect(() => {
    writeThoughtLibraryState({ activeTab, selectedByTab });
  }, [activeTab, selectedByTab]);

  const handleSwitchTab = (nextTab: ThoughtLibraryTab) => {
    setActiveTab(nextTab);
    const nextItems = getThoughtLibraryItems(nextTab);
    setSelectedByTab((current) => ({
      ...current,
      [nextTab]: current[nextTab] || nextItems[0]?.id || null,
    }));
    if (nextTab !== 'graph') {
      setGraphViewMode('page');
    }
  };

  const handleOpenContextChat = () => {
    if (!selectedItem || !onOpenContextChat) {
      return;
    }
    onOpenContextChat({
      title: selectedItem.title,
      prompt: buildThoughtLibraryContextPrompt({
        tab: activeTab,
        item: selectedItem,
      }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-page)]">
      <div className="border-b border-[var(--border-primary)] bg-[var(--bg-panel)]/92 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</h1>
              <Chip tone="accent" className="px-2.5 py-1 text-[11px]">
                Knowledge Flywheel
              </Chip>
            </div>
            <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
              素材进入，AI 编译图谱，对话生成成果，成果再反哺图谱。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative block w-[340px] max-w-[40vw]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索素材、图谱、成果..."
                className="h-10 w-full rounded-[12px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgba(180,154,112,0.14)]"
              />
            </label>
            <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />}>
              刷新
            </Button>
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />}>
              新建
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-[var(--border-primary)] bg-[var(--bg-panel)]/70">
          <div className="flex items-center gap-1 border-b border-[var(--border-primary)] px-3 py-2">
            {THOUGHT_LIBRARY_TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSwitchTab(tab.id)}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-[rgba(180,154,112,0.16)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {items.map((item) => {
              const active = selectedItem?.id === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setSelectedByTab((current) => ({
                      ...current,
                      [activeTab]: item.id,
                    }))
                  }
                  className={cn(
                    'w-full rounded-[14px] border px-3 py-3 text-left transition',
                    active
                      ? 'border-[rgba(180,154,112,0.38)] bg-[rgba(180,154,112,0.10)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-elevated)] hover:border-[rgba(180,154,112,0.20)]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-page)] text-[var(--brand-primary)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</div>
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{item.subtitle}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} tone="outline" className="px-2 py-0.5 text-[10px]">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-[var(--text-muted)]">{item.meta}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-[var(--bg-page)]">
          <div className="mx-auto flex h-full max-w-[960px] flex-col px-6 py-6">
            <div className="mb-4">
              <div className="text-[20px] font-semibold text-[var(--text-primary)]">{getThoughtLibraryPanelTitle(activeTab)}</div>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{getThoughtLibraryPanelDescription(activeTab)}</p>
            </div>

            {selectedItem ? (
              <div className="space-y-4">
                <div className="rounded-[18px] border border-[var(--border-primary)] bg-[var(--bg-panel)] px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{selectedItem.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {selectedItem.tags.map((tag) => (
                          <Chip key={tag} tone="accent" className="px-2.5 py-1 text-[11px]">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      查看来源
                    </Button>
                  </div>
                  <p className="mt-4 text-[14px] leading-7 text-[var(--text-secondary)]">{selectedItem.summary}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[18px] border border-[var(--border-primary)] bg-[var(--bg-panel)] px-5 py-5">
                    <div className="mb-3 text-[14px] font-medium text-[var(--text-primary)]">
                      {activeTab === 'graph' ? (graphViewMode === 'graph' ? '关系图谱视图' : '图谱页面视图') : '结构化内容视图'}
                    </div>
                    {activeTab === 'graph' ? (
                      <div className="mb-3 flex gap-2">
                        {([
                          ['page', '页面视图'],
                          ['graph', '图谱视图'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setGraphViewMode(mode)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-[12px] transition',
                              graphViewMode === mode
                                ? 'bg-[rgba(180,154,112,0.16)] text-[var(--text-primary)]'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {activeTab === 'graph' && graphViewMode === 'graph' ? (
                      <div className="relative h-[360px] overflow-hidden rounded-[16px] border border-[var(--border-primary)] bg-[radial-gradient(circle_at_top,rgba(180,154,112,0.10),transparent_46%),var(--bg-page)]">
                        <div className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded-full border border-[rgba(180,154,112,0.35)] bg-[rgba(180,154,112,0.12)] px-4 py-2 text-[12px] text-[var(--text-primary)]">
                          {selectedItem.title}
                        </div>
                        <div className="absolute left-[18%] top-[52%] rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          关键关系 A
                        </div>
                        <div className="absolute right-[18%] top-[46%] rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          关键关系 B
                        </div>
                        <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          证据来源
                        </div>
                        <svg className="absolute inset-0 h-full w-full">
                          <line x1="50%" y1="24%" x2="22%" y2="52%" stroke="rgba(180,154,112,0.35)" strokeWidth="1.5" />
                          <line x1="50%" y1="24%" x2="78%" y2="46%" stroke="rgba(180,154,112,0.35)" strokeWidth="1.5" />
                          <line x1="50%" y1="24%" x2="50%" y2="74%" stroke="rgba(180,154,112,0.25)" strokeWidth="1.5" />
                        </svg>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-4 text-[13px] leading-7 text-[var(--text-secondary)]">
                        AI 会在这里展示当前对象的正文、摘要、来源结构、关键摘录，以及可被引用的压缩知识块。对于图谱对象，页面视图会优先展示关系说明和来源证据。
                      </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[var(--border-primary)] bg-[var(--bg-panel)] px-5 py-5">
                    <div className="mb-3 text-[14px] font-medium text-[var(--text-primary)]">状态与关系</div>
                    <div className="space-y-3">
                      <div className="rounded-[14px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="text-[12px] text-[var(--text-muted)]">当前层级</div>
                        <div className="mt-1 text-[14px] text-[var(--text-primary)]">
                          {activeTab === 'materials' ? '素材输入层' : activeTab === 'graph' ? '图谱编译层' : '成果产出层'}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="text-[12px] text-[var(--text-muted)]">推荐动作</div>
                        <div className="mt-1 text-[14px] text-[var(--text-primary)]">
                          {activeTab === 'materials'
                            ? '加入图谱 / 继续提炼'
                            : activeTab === 'graph'
                              ? '加入对话上下文 / 查看来源'
                              : '继续二创 / 反哺图谱'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex w-[420px] shrink-0 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-panel)]/72">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-3">
            <div className="text-[14px] font-medium text-[var(--text-primary)]">对话</div>
            {selectedItem ? (
              <button
                type="button"
                onClick={handleOpenContextChat}
                className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 text-[11px] text-[var(--text-primary)] transition hover:border-[rgba(180,154,112,0.28)]"
              >
                在主对话中打开
              </button>
            ) : null}
          </div>
          <ThoughtLibraryEmbeddedChatSurface
            selectedItem={selectedItem}
            activeTab={activeTab}
            gatewayUrl={gatewayUrl}
            gatewayToken={gatewayToken}
            gatewayPassword={gatewayPassword}
            authBaseUrl={authBaseUrl}
            appName={appName}
            client={client}
            accessToken={accessToken}
            currentUser={currentUser}
            authenticated={authenticated}
            onRequestAuth={onRequestAuth}
            inputComposerConfig={inputComposerConfig}
            welcomePageConfig={welcomePageConfig}
          />
        </div>
      </div>
    </div>
  );
}
