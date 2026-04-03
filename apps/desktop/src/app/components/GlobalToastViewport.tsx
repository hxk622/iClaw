import { X } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import type { AppNotificationRecord } from '@/app/lib/task-notifications';

export function GlobalToastViewport({
  notifications,
  onDismiss,
}: {
  notifications: AppNotificationRecord[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-[80] flex w-full max-w-[420px] flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            'pointer-events-auto rounded-[18px] border px-4 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-sm',
            notification.tone === 'success' &&
              'border-[rgba(34,197,94,0.18)] bg-[rgba(240,253,244,0.94)] dark:border-[rgba(34,197,94,0.22)] dark:bg-[rgba(20,83,45,0.88)]',
            notification.tone === 'error' &&
              'border-[rgba(239,68,68,0.18)] bg-[rgba(254,242,242,0.95)] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(127,29,29,0.88)]',
            notification.tone === 'info' &&
              'border-[rgba(59,130,246,0.18)] bg-[rgba(239,246,255,0.95)] dark:border-[rgba(96,165,250,0.24)] dark:bg-[rgba(30,58,138,0.86)]',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] dark:text-white">
                {notification.title}
              </div>
              <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)] dark:text-white/82">
                {notification.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--text-primary)] dark:text-white/72 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="关闭提醒"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
