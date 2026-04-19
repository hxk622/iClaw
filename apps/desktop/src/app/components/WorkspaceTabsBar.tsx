import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorkspaceTabRecord, WorkspaceTabRuntimeStatus } from '@/app/lib/workspace-tabs';

const WORKSPACE_TAB_COLOR_STYLES: Record<string, { accent: string; activeBg: string; swatch: string }> = {
  default: {
    accent: 'var(--brand-primary)',
    activeBg: 'color-mix(in srgb, var(--brand-primary) 16%, var(--bg-elevated))',
    swatch: '#b79a66',
  },
  gold: {
    accent: 'var(--brand-primary)',
    activeBg: 'color-mix(in srgb, var(--brand-primary) 20%, var(--bg-elevated))',
    swatch: '#c4a76f',
  },
  olive: {
    accent: 'var(--state-success)',
    activeBg: 'color-mix(in srgb, var(--state-success) 16%, var(--bg-elevated))',
    swatch: '#7ea184',
  },
  teal: {
    accent: '#4f8f8b',
    activeBg: 'color-mix(in srgb, #4f8f8b 16%, var(--bg-elevated))',
    swatch: '#5da5a0',
  },
  slate: {
    accent: '#6d7786',
    activeBg: 'color-mix(in srgb, #6d7786 16%, var(--bg-elevated))',
    swatch: '#7e8ba0',
  },
  rose: {
    accent: '#ba6f7b',
    activeBg: 'color-mix(in srgb, #ba6f7b 16%, var(--bg-elevated))',
    swatch: '#ca7e8c',
  },
  charcoal: {
    accent: '#4d4a46',
    activeBg: 'color-mix(in srgb, #4d4a46 18%, var(--bg-elevated))',
    swatch: '#615b56',
  },
};

type WorkspaceTabsBarProps = {
  tabs: WorkspaceTabRecord[];
  activeTabId: string;
  runtimeByTabId: Record<string, WorkspaceTabRuntimeStatus>;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
  onRename: (tabId: string, title: string) => void;
  onColorChange: (tabId: string, color: WorkspaceTabRecord['color']) => void;
  onSetPinned: (tabId: string, pinned: boolean) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onReorder: (fromTabId: string, toTabId: string) => void;
};

const TAB_ESTIMATED_WIDTH = 184;
const NEW_BUTTON_WIDTH = 40;
const OVERFLOW_BUTTON_WIDTH = 44;

export function WorkspaceTabsBar(props: WorkspaceTabsBarProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [overflowMenuPosition, setOverflowMenuPosition] = useState({ x: 0, y: 0 });
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!menuTabId && !renamingTabId && !overflowMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (activeTabRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      if (overflowMenuRef.current?.contains(target)) {
        return;
      }
      setMenuTabId(null);
      setRenamingTabId(null);
      setOverflowMenuOpen(false);
      setDraftTitle('');
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setMenuTabId(null);
      setRenamingTabId(null);
      setOverflowMenuOpen(false);
      setDraftTitle('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuTabId, overflowMenuOpen, renamingTabId]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const update = () => {
      setAvailableWidth(rail.clientWidth);
    };
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!renamingTabId) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingTabId]);

  const handleStartRename = (tabId: string, currentTitle: string) => {
    setMenuTabId(null);
    setRenamingTabId(tabId);
    setDraftTitle(currentTitle);
  };

  const handleCommitRename = (tabId: string) => {
    props.onRename(tabId, draftTitle);
    setRenamingTabId(null);
    setDraftTitle('');
  };

  const { visibleTabs, overflowTabs } = useMemo(() => {
    if (props.tabs.length === 0) {
      return {
        visibleTabs: [] as WorkspaceTabRecord[],
        overflowTabs: [] as WorkspaceTabRecord[],
      };
    }

    const baseSlots = Math.max(
      1,
      Math.floor(Math.max(availableWidth - NEW_BUTTON_WIDTH, TAB_ESTIMATED_WIDTH) / TAB_ESTIMATED_WIDTH),
    );
    if (props.tabs.length <= baseSlots) {
      return {
        visibleTabs: props.tabs,
        overflowTabs: [] as WorkspaceTabRecord[],
      };
    }

    const visibleLimit = Math.max(1, baseSlots - 1);
    const pinnedTabs = props.tabs.filter((tab) => tab.pinned);
    const mustShowIds = new Set<string>();

    if (pinnedTabs.length >= visibleLimit) {
      pinnedTabs.slice(0, Math.max(0, visibleLimit - 1)).forEach((tab) => mustShowIds.add(tab.id));
      mustShowIds.add(props.activeTabId);
    } else {
      pinnedTabs.forEach((tab) => mustShowIds.add(tab.id));
      mustShowIds.add(props.activeTabId);
    }

    const visible: WorkspaceTabRecord[] = [];
    for (const tab of props.tabs) {
      if (!mustShowIds.has(tab.id)) {
        continue;
      }
      if (visible.find((item) => item.id === tab.id)) {
        continue;
      }
      if (visible.length >= visibleLimit) {
        break;
      }
      visible.push(tab);
    }
    for (const tab of props.tabs) {
      if (visible.length >= visibleLimit) {
        break;
      }
      if (visible.find((item) => item.id === tab.id)) {
        continue;
      }
      visible.push(tab);
    }

    const visibleIdSet = new Set(visible.map((tab) => tab.id));
    return {
      visibleTabs: visible,
      overflowTabs: props.tabs.filter((tab) => !visibleIdSet.has(tab.id)),
    };
  }, [availableWidth, props.activeTabId, props.tabs]);

  return (
    <div
      ref={railRef}
      className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b px-4 py-2"
      style={{
        borderColor: 'var(--chat-surface-panel-border)',
        background: 'color-mix(in srgb, var(--chat-surface-header-bg) 92%, transparent)',
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
      {visibleTabs.map((tab) => {
        const isActive = tab.id === props.activeTabId;
        const colorStyle = WORKSPACE_TAB_COLOR_STYLES[tab.color] || WORKSPACE_TAB_COLOR_STYLES.default;
        const runtime = props.runtimeByTabId[tab.id] ?? {
          busy: false,
          hasPendingBilling: false,
          hasUnsavedDraft: false,
          recovering: false,
          ready: false,
        };
        const isBusy = runtime.busy;
        const menuOpen = menuTabId === tab.id;
        const renaming = renamingTabId === tab.id;
        const tabIndex = props.tabs.findIndex((item) => item.id === tab.id);
        const hasTabsToRight = tabIndex >= 0 && tabIndex < props.tabs.length - 1;
        const nextTab = tabIndex >= 0 ? props.tabs[tabIndex + 1] : undefined;
        const boundaryAfterPinned = tab.pinned && nextTab && !nextTab.pinned;
        const showDraft = runtime.hasUnsavedDraft && !runtime.busy;
        const showRecovering = runtime.recovering && !runtime.busy;
        return (
          <div
            key={tab.id}
            ref={menuOpen || renaming ? activeTabRef : null}
            className="group relative grid h-[31px] w-[176px] min-w-[96px] max-w-[240px] shrink-0 grid-cols-[18px_minmax(0,1fr)_22px] items-center gap-1 rounded-[13px] border px-[10px] text-[12px] font-medium transition-all duration-[180ms]"
            data-testid="workspace-tab-item"
            data-workspace-tab-id={tab.id}
            data-workspace-tab-active={isActive ? 'true' : 'false'}
            data-workspace-tab-color={tab.color}
            data-workspace-tab-title={tab.title}
            role="tab"
            tabIndex={renaming ? -1 : 0}
            aria-selected={isActive}
            style={{
              cursor: 'pointer',
              borderColor: isActive
                ? 'color-mix(in srgb, var(--border-strong) 82%, transparent)'
                : 'color-mix(in srgb, var(--chat-surface-panel-border) 92%, transparent)',
              background: isActive
                ? colorStyle.activeBg
                : 'color-mix(in srgb, var(--chat-surface-panel-muted) 92%, var(--bg-elevated))',
              boxShadow:
                dragOverTabId === tab.id
                  ? `0 0 0 2px color-mix(in srgb, ${colorStyle.accent} 24%, transparent), var(--lobster-shadow-tab)`
                  : isActive
                    ? `0 0 0 1.5px color-mix(in srgb, ${colorStyle.accent} 36%, transparent), var(--lobster-shadow-tab)`
                    : '0 1px 2px rgb(18 15 11 / 0.05)',
              opacity: draggingTabId === tab.id ? 0.54 : 1,
              transform: isActive ? 'scale(1.03)' : 'scale(1)',
              filter: isActive ? 'brightness(1.06) saturate(1.03)' : 'none',
              zIndex: isActive || menuOpen ? 2 : 1,
              marginRight: boundaryAfterPinned ? 10 : undefined,
            }}
            draggable={!renaming}
            onClick={() => {
              if (renaming) {
                return;
              }
              props.onSelect(tab.id);
            }}
            onKeyDown={(event) => {
              if (renaming) {
                return;
              }
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                props.onSelect(tab.id);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setRenamingTabId(null);
              setDraftTitle('');
              const menuWidth = 200;
              const menuHeight = 250;
              const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
              const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
              setMenuPosition({
                x: Math.max(12, Math.min(event.clientX, viewportWidth - menuWidth - 12)),
                y: Math.max(12, Math.min(event.clientY, viewportHeight - menuHeight - 12)),
              });
              setMenuTabId(tab.id);
            }}
            onDoubleClick={() => handleStartRename(tab.id, tab.title)}
            onDragStart={(event) => {
              if (renaming) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', tab.id);
              setDraggingTabId(tab.id);
              setDragOverTabId(null);
            }}
            onDragOver={(event) => {
              if (!draggingTabId || draggingTabId === tab.id) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverTabId(tab.id);
            }}
            onDragLeave={(event) => {
              if (dragOverTabId !== tab.id) {
                return;
              }
              const relatedTarget = event.relatedTarget as Node | null;
              if (relatedTarget && (event.currentTarget as HTMLDivElement).contains(relatedTarget)) {
                return;
              }
              setDragOverTabId((current) => (current === tab.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceTabId = draggingTabId || event.dataTransfer.getData('text/plain');
              if (!sourceTabId || sourceTabId === tab.id) {
                setDraggingTabId(null);
                setDragOverTabId(null);
                return;
              }
              props.onReorder(sourceTabId, tab.id);
              setDraggingTabId(null);
              setDragOverTabId(null);
            }}
            onDragEnd={() => {
              setDraggingTabId(null);
              setDragOverTabId(null);
            }}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 place-self-center rounded-full"
              style={{
                background: showRecovering ? 'transparent' : showDraft ? 'var(--state-warn)' : colorStyle.accent,
                border: showRecovering ? `1.5px solid ${colorStyle.accent}` : undefined,
                boxShadow: isBusy
                  ? `0 0 0 4px color-mix(in srgb, ${colorStyle.accent} 18%, transparent)`
                  : showDraft
                    ? '0 0 0 4px color-mix(in srgb, var(--state-warn) 18%, transparent)'
                    : showRecovering
                      ? `0 0 0 4px color-mix(in srgb, ${colorStyle.accent} 14%, transparent)`
                      : 'none',
              }}
            />
            {renaming ? (
              <input
                ref={renameInputRef}
                value={draftTitle}
                data-testid="workspace-tab-rename-input"
                data-workspace-tab-id={tab.id}
                onChange={(event) => setDraftTitle(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCommitRename(tab.id);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setRenamingTabId(null);
                    setDraftTitle('');
                  }
                }}
                onBlur={() => handleCommitRename(tab.id)}
                className="relative z-[1] w-full min-w-0 rounded-[10px] border border-[var(--brand-primary)] bg-[var(--bg-card)] px-2 py-1 text-center text-[12px] text-[var(--text-primary)] outline-none"
                maxLength={48}
              />
            ) : (
              <span className="relative z-[1] min-w-0 truncate text-center text-[var(--text-primary)]">{tab.title}</span>
            )}
            <button
              type="button"
              className="relative z-[1] inline-flex h-5 w-5 shrink-0 place-self-center items-center justify-center rounded-[7px] text-[12px] font-semibold leading-none text-[var(--text-secondary)] opacity-0 transition hover:bg-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] hover:text-[var(--text-primary)] group-hover:opacity-100"
              data-testid="workspace-tab-close"
              data-workspace-tab-id={tab.id}
              onClick={(event) => {
                event.stopPropagation();
                props.onClose(tab.id);
              }}
              aria-label={`关闭${tab.title}`}
              style={{
                opacity: isActive ? 1 : undefined,
              }}
            >
              ×
            </button>
            {portalReady && menuOpen
              ? createPortal(
                  <div
                    ref={menuRef}
                    className="fixed z-[180] min-w-[200px] rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-popover)]"
                    style={{ left: menuPosition.x, top: menuPosition.y }}
                    role="menu"
                    aria-label={`${tab.title} 标签页操作`}
                  >
                    <button
                      type="button"
                      data-testid="workspace-tab-menu-rename"
                      data-workspace-tab-id={tab.id}
                      className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => handleStartRename(tab.id, tab.title)}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      data-testid="workspace-tab-menu-pin"
                      data-workspace-tab-id={tab.id}
                      className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => {
                        props.onSetPinned(tab.id, !tab.pinned);
                        setMenuTabId(null);
                      }}
                    >
                      {tab.pinned ? '取消固定' : '固定到左侧'}
                    </button>
                    <div className="my-1 h-px bg-[var(--border-default)]" />
                    <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">颜色</div>
                    <div className="grid grid-cols-7 gap-1.5 px-2 pb-2 pt-1">
                      {Object.keys(WORKSPACE_TAB_COLOR_STYLES).map((colorKey) => {
                        const optionColor = colorKey as WorkspaceTabRecord['color'];
                        const optionStyle = WORKSPACE_TAB_COLOR_STYLES[optionColor];
                        const selected = tab.color === optionColor;
                        return (
                          <button
                            key={optionColor}
                            type="button"
                            data-testid="workspace-tab-menu-color"
                            data-workspace-tab-id={tab.id}
                            data-workspace-tab-color-option={optionColor}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-transform hover:scale-[1.05]"
                            style={{
                              borderColor: selected
                                ? 'rgba(245, 239, 228, 0.92)'
                                : 'rgba(255, 255, 255, 0.14)',
                              backgroundColor: optionStyle.swatch,
                              boxShadow: selected
                                ? `0 0 0 2px rgba(37, 33, 29, 0.96), 0 0 0 4px ${optionStyle.swatch}`
                                : 'none',
                            }}
                            onClick={() => {
                              props.onColorChange(tab.id, optionColor);
                              setMenuTabId(null);
                            }}
                            aria-label={`切换颜色 ${optionColor}`}
                          />
                        );
                      })}
                    </div>
                    <div className="my-1 h-px bg-[var(--border-default)]" />
                    <button
                      type="button"
                      data-testid="workspace-tab-menu-close-others"
                      data-workspace-tab-id={tab.id}
                      className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        props.onCloseOthers(tab.id);
                        setMenuTabId(null);
                      }}
                      disabled={props.tabs.length <= 1}
                    >
                      关闭其他标签页
                    </button>
                    <button
                      type="button"
                      data-testid="workspace-tab-menu-close-right"
                      data-workspace-tab-id={tab.id}
                      className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        props.onCloseToRight(tab.id);
                        setMenuTabId(null);
                      }}
                      disabled={!hasTabsToRight}
                    >
                      关闭右侧标签页
                    </button>
                    <button
                      type="button"
                      data-testid="workspace-tab-menu-close"
                      data-workspace-tab-id={tab.id}
                      className="mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--state-error)] transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => {
                        props.onClose(tab.id);
                        setMenuTabId(null);
                      }}
                    >
                      关闭标签页
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        );
      })}
      {overflowTabs.length > 0 ? (
        <button
          ref={overflowButtonRef}
          type="button"
          className="inline-flex h-[31px] shrink-0 items-center justify-center rounded-[13px] border px-3 text-[12px] font-medium text-[var(--text-secondary)] transition hover:scale-[1.02] hover:bg-[var(--surface-panel-subtle-bg)] hover:text-[var(--text-primary)]"
          style={{
            borderColor: 'var(--chat-surface-panel-border)',
            background: 'color-mix(in srgb, var(--chat-surface-panel-muted) 92%, var(--bg-elevated))',
          }}
          onClick={() => {
            const rect = overflowButtonRef.current?.getBoundingClientRect();
            setOverflowMenuPosition({
              x: rect ? Math.max(12, rect.right - 220) : 12,
              y: rect ? rect.bottom + 8 : 48,
            });
            setOverflowMenuOpen((current) => !current);
            setMenuTabId(null);
          }}
          aria-label={`更多标签页 ${overflowTabs.length}`}
        >
          更多
        </button>
      ) : null}
      </div>
      <button
        type="button"
        className="inline-flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-[13px] border text-[18px] text-[var(--text-secondary)] transition hover:scale-[1.03] hover:bg-[var(--surface-panel-subtle-bg)] hover:text-[var(--text-primary)]"
        data-testid="workspace-tab-new"
        style={{
          cursor: 'pointer',
          borderColor: 'var(--chat-surface-panel-border)',
          background: 'color-mix(in srgb, var(--chat-surface-panel-muted) 92%, var(--bg-elevated))',
        }}
        onClick={props.onNew}
        aria-label="新建聊天标签页"
      >
        +
      </button>
      {portalReady && overflowMenuOpen && overflowTabs.length > 0
        ? createPortal(
            <div
              ref={overflowMenuRef}
              className="fixed z-[180] min-w-[220px] rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-popover)]"
              style={{ left: overflowMenuPosition.x, top: overflowMenuPosition.y }}
            >
              <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                更多标签页
              </div>
              {overflowTabs.map((tab) => {
                const runtime = props.runtimeByTabId[tab.id] ?? {
                  busy: false,
                  hasPendingBilling: false,
                  hasUnsavedDraft: false,
                  recovering: false,
                  ready: false,
                };
                const colorStyle = WORKSPACE_TAB_COLOR_STYLES[tab.color] || WORKSPACE_TAB_COLOR_STYLES.default;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                    onClick={() => {
                      props.onSelect(tab.id);
                      setOverflowMenuOpen(false);
                    }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: runtime.hasUnsavedDraft ? 'var(--state-warn)' : colorStyle.accent,
                        border: runtime.recovering ? `1.5px solid ${colorStyle.accent}` : undefined,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                    {tab.pinned ? <span className="text-[10px] text-[var(--text-muted)]">固定</span> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
