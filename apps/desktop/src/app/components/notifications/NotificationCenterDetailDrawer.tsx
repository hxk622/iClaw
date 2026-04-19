import { CheckCircle2, ExternalLink, Eye, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import type { NotificationCenterItem } from '@/app/lib/notification-center';

const statusLabelMap = {
  success: '执行成功',
  error: '执行失败',
  info: '信息',
} as const;

export function NotificationCenterDetailDrawer({
  open,
  notification,
  onClose,
  onMarkAsRead,
  onPrimaryAction,
  onSecondaryAction,
}: {
  open: boolean;
  notification: NotificationCenterItem | null;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onPrimaryAction: (notification: NotificationCenterItem) => void;
  onSecondaryAction: (notification: NotificationCenterItem) => void;
}) {
  if (!notification) {
    return null;
  }

  const Icon =
    notification.type === 'success' ? CheckCircle2 : notification.type === 'error' ? XCircle : Info;
  const iconToneClasses =
    notification.type === 'success'
      ? 'bg-[#7a9b6f]/10 text-[#7a9b6f] dark:bg-[#8fae82]/15 dark:text-[#8fae82]'
      : notification.type === 'error'
        ? 'bg-[#b86f6f]/10 text-[#b86f6f] dark:bg-[#c98a8a]/15 dark:text-[#c98a8a]'
        : 'bg-[#6f8bb8]/10 text-[#6f8bb8] dark:bg-[#82a0c9]/15 dark:text-[#82a0c9]';

  const detail = notification.details;
  const primaryLabel = notification.routeTarget === 'cron' ? '查看任务详情' : '查看相关内容';

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-[70] flex h-full w-[520px] flex-col border-l backdrop-blur-2xl transition-transform duration-300 ease-out',
        open ? 'translate-x-[-420px]' : 'translate-x-full',
      )}
      style={{
        borderColor: 'var(--drawer-shell-border)',
        background: 'var(--drawer-shell-bg)',
        boxShadow: open ? 'var(--drawer-shell-shadow)' : 'none',
      }}
    >
      <div className="border-b border-[var(--drawer-shell-border)] px-6 pb-5 pt-6">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconToneClasses)}>
            <Icon className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-medium text-[#2c2826] dark:text-[#e8e5e1]">{notification.title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                aria-label="关闭通知详情"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#a39d98] dark:text-[#6b6662]">{notification.time}</span>
              <span className="h-1 w-1 rounded-full bg-[#a39d98] dark:bg-[#6b6662]" />
              <span
                className={cn(
                  'text-xs font-medium',
                  notification.type === 'success' && 'text-[#7a9b6f] dark:text-[#8fae82]',
                  notification.type === 'error' && 'text-[#b86f6f] dark:text-[#c98a8a]',
                  notification.type === 'info' && 'text-[#6f8bb8] dark:text-[#82a0c9]',
                )}
              >
                {notification.source}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5">
          <p className="text-sm leading-relaxed text-[#2c2826] dark:text-[#e8e5e1]">{notification.summary}</p>
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] p-5">
          <div>
            <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">任务名称</div>
            <div className="text-sm text-[#2c2826] dark:text-[#e8e5e1]">{detail.taskName}</div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">执行状态</div>
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', iconToneClasses)}>
                <Icon className="h-3.5 w-3.5" />
                {statusLabelMap[detail.status]}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">执行时间</div>
            <div className="font-mono text-sm text-[#2c2826] dark:text-[#e8e5e1]">{detail.executionTime}</div>
          </div>

          {detail.nextRunTime ? (
            <div>
              <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">下次执行</div>
              <div className="font-mono text-sm text-[#2c2826] dark:text-[#e8e5e1]">{detail.nextRunTime}</div>
            </div>
          ) : null}

          {detail.model && detail.provider ? (
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">模型</div>
                <div className="text-sm text-[#2c2826] dark:text-[#e8e5e1]">{detail.model}</div>
              </div>
              <div className="flex-1">
                <div className="mb-1.5 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">提供商</div>
                <div className="text-sm text-[#2c2826] dark:text-[#e8e5e1]">{detail.provider}</div>
              </div>
            </div>
          ) : null}

          {detail.result || detail.errorReason ? (
            <div className="border-t border-[var(--drawer-shell-border)]" />
          ) : null}

          {detail.result ? (
            <div>
              <div className="mb-2 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">执行结果</div>
              <div className="text-sm leading-relaxed text-[#2c2826] dark:text-[#e8e5e1]">{detail.result}</div>
            </div>
          ) : null}

          {detail.errorReason ? (
            <div>
              <div className="mb-2 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">失败原因</div>
              <div className="rounded-lg border border-[#b86f6f]/20 bg-[#b86f6f]/5 px-3 py-2.5 dark:border-[#c98a8a]/20 dark:bg-[#c98a8a]/10">
                <p className="text-sm leading-relaxed text-[#b86f6f] dark:text-[#c98a8a]">{detail.errorReason}</p>
              </div>
            </div>
          ) : null}

          {detail.financeDisclaimer ? (
            <div>
              <div className="mb-2 text-xs font-medium text-[#a39d98] dark:text-[#6b6662]">风险提示</div>
              <div className="rounded-lg border border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.08)] px-3 py-2.5 dark:border-[rgba(180,154,112,0.24)] dark:bg-[rgba(180,154,112,0.10)]">
                <p className="text-sm leading-relaxed text-[var(--brand-primary)]">{detail.financeDisclaimer}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--drawer-shell-border)] bg-[var(--drawer-footer-bg)] px-6 py-5 backdrop-blur-[10px]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPrimaryAction(notification)}
            disabled={!notification.routeTarget}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#c5a028] px-4 text-sm font-medium text-white transition-colors hover:bg-[#b89024] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#d4af37] dark:text-[#1a1816] dark:hover:bg-[#c5a028]"
          >
            <ExternalLink className="h-4 w-4" />
            {primaryLabel}
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onSecondaryAction(notification)}
            className="h-9 flex-1 rounded-lg bg-[var(--bg-hover)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
          >
            前往任务中心
          </button>

          {!notification.isRead ? (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--bg-hover)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
            >
              <Eye className="h-3.5 w-3.5" />
              标记已读
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
