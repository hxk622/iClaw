import { useMemo, useState } from 'react';
import { CheckCheck, CheckCircle2, Info, Search, Trash2, X, XCircle } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import type { NotificationCenterCategory, NotificationCenterItem } from '@/app/lib/notification-center';

const tabs: Array<{ key: NotificationCenterCategory; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'scheduled', label: '定时任务' },
  { key: 'chat', label: '聊天' },
  { key: 'system', label: '系统' },
];

const groupLabels = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
} as const;

function NotificationItemCard({
  notification,
  selected,
  onClick,
}: {
  notification: NotificationCenterItem;
  selected: boolean;
  onClick: () => void;
}) {
  const toneClasses =
    notification.type === 'success'
      ? 'bg-[#7a9b6f]/10 text-[#7a9b6f] dark:bg-[#8fae82]/15 dark:text-[#8fae82]'
      : notification.type === 'error'
        ? 'bg-[#b86f6f]/10 text-[#b86f6f] dark:bg-[#c98a8a]/15 dark:text-[#c98a8a]'
        : 'bg-[#6f8bb8]/10 text-[#6f8bb8] dark:bg-[#82a0c9]/15 dark:text-[#82a0c9]';
  const StatusIcon =
    notification.type === 'success' ? CheckCircle2 : notification.type === 'error' ? XCircle : Info;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl px-3 py-3 text-left transition-all',
        selected
          ? 'bg-[#c5a028]/10 shadow-sm dark:bg-[#d4af37]/15'
          : notification.isRead
            ? 'hover:bg-[#f5f3f0] dark:hover:bg-[#2d2b28]'
            : 'bg-[#faf9f7] shadow-sm hover:bg-[#f5f3f0] dark:bg-[#1a1816] dark:hover:bg-[#2d2b28]',
      )}
    >
      <div className="flex gap-3">
        <div className="pt-1">
          {!notification.isRead ? (
            <div className="h-2 w-2 rounded-full bg-[#c5a028] dark:bg-[#d4af37]" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-transparent" />
          )}
        </div>

        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClasses)}>
          <StatusIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3
              className={cn(
                'text-sm font-medium',
                notification.isRead ? 'text-[#6b6662] dark:text-[#a39d98]' : 'text-[#2c2826] dark:text-[#e8e5e1]',
              )}
            >
              {notification.title}
            </h3>
            <span className="shrink-0 text-xs text-[#a39d98] dark:text-[#6b6662]">{notification.time}</span>
          </div>

          <p className="mb-2 line-clamp-1 text-xs text-[#a39d98] dark:text-[#6b6662]">{notification.summary}</p>

          <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium', toneClasses)}>
            {notification.source}
          </span>
        </div>
      </div>
    </button>
  );
}

export function NotificationCenterDrawer({
  open,
  notifications,
  selectedNotificationId,
  onClose,
  onSelect,
  onMarkAllRead,
  onClearAll,
}: {
  open: boolean;
  notifications: NotificationCenterItem[];
  selectedNotificationId: string | null;
  onClose: () => void;
  onSelect: (notification: NotificationCenterItem) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}) {
  const [activeTab, setActiveTab] = useState<NotificationCenterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const matchesTab = activeTab === 'all' || notification.category === activeTab;
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          notification.title.toLowerCase().includes(query) ||
          notification.summary.toLowerCase().includes(query);
        return matchesTab && matchesSearch;
      }),
    [activeTab, notifications, searchQuery],
  );

  const grouped = useMemo(
    () =>
      filteredNotifications.reduce<Record<string, NotificationCenterItem[]>>((accumulator, notification) => {
        const key = notification.timeGroup;
        if (!accumulator[key]) {
          accumulator[key] = [];
        }
        accumulator[key].push(notification);
        return accumulator;
      }, {}),
    [filteredNotifications],
  );

  const hasNotifications = filteredNotifications.length > 0;

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-[60] flex h-full w-[420px] flex-col border-l border-[#e8e3de]/50 bg-white/95 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out dark:border-[#3a3835]/50 dark:bg-[#242220]/95',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <div className="border-b border-[#e8e3de]/50 px-5 pb-4 pt-5 dark:border-[#3a3835]/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#2c2826] dark:text-[#e8e5e1]">通知中心</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b6662] transition-colors hover:bg-[#f5f3f0] dark:text-[#a39d98] dark:hover:bg-[#2d2b28]"
            aria-label="关闭通知中心"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-[#c5a028]/10 text-[#c5a028] dark:bg-[#d4af37]/15 dark:text-[#d4af37]'
                  : 'text-[#6b6662] hover:bg-[#f5f3f0] dark:text-[#a39d98] dark:hover:bg-[#2d2b28]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39d98] dark:text-[#6b6662]" />
          <input
            type="text"
            placeholder="搜索通知..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#e8e3de]/50 bg-[#f5f3f0] pl-9 pr-3 text-sm text-[#2c2826] outline-none placeholder:text-[#a39d98] focus:ring-1 focus:ring-[#c5a028]/30 dark:border-[#3a3835]/50 dark:bg-[#1a1816] dark:text-[#e8e5e1] dark:placeholder:text-[#6b6662] dark:focus:ring-[#d4af37]/30"
          />
        </div>

        {hasNotifications ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6b6662] transition-colors hover:bg-[#f5f3f0] dark:text-[#a39d98] dark:hover:bg-[#2d2b28]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全部已读
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6b6662] transition-colors hover:bg-[#f5f3f0] dark:text-[#a39d98] dark:hover:bg-[#2d2b28]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空通知
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!hasNotifications ? (
          <div className="flex h-full flex-col items-center justify-center px-8 pb-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e8e3de]/50 bg-[#f5f3f0] dark:border-[#3a3835]/50 dark:bg-[#1a1816]">
              <CheckCheck className="h-7 w-7 text-[#a39d98] dark:text-[#6b6662]" />
            </div>
            <p className="mb-1 text-sm font-medium text-[#2c2826] dark:text-[#e8e5e1]">暂无通知</p>
            <p className="text-center text-xs text-[#a39d98] dark:text-[#6b6662]">当前没有新的通知消息</p>
          </div>
        ) : (
          <div className="px-3 py-3">
            {(['today', 'yesterday', 'earlier'] as const).map((groupKey) => {
              const groupItems = grouped[groupKey];
              if (!groupItems?.length) {
                return null;
              }
              return (
                <div key={groupKey} className="mb-4 last:mb-0">
                  <div className="px-2 py-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">
                    {groupLabels[groupKey]}
                  </div>
                  <div className="space-y-1">
                    {groupItems.map((notification) => (
                      <NotificationItemCard
                        key={notification.id}
                        notification={notification}
                        selected={notification.id === selectedNotificationId}
                        onClick={() => onSelect(notification)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
