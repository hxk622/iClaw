import { Bell } from 'lucide-react';
import { cn } from '@/app/lib/cn';

export function NotificationCenterBell({
  unreadCount,
  open,
  onClick,
}: {
  unreadCount: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="打开通知中心"
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
        open
          ? 'border-[#d4af37]/30 bg-[#c5a028]/10 text-[#c5a028] dark:border-[#d4af37]/36 dark:bg-[#d4af37]/15 dark:text-[#d4af37]'
          : 'border-transparent bg-transparent text-[#6b6662] hover:bg-[#f5f3f0] dark:text-[#a39d98] dark:hover:bg-[#2d2b28]',
      )}
    >
      <Bell className="h-[18px] w-[18px]" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#c5a028] px-1 text-[10px] font-medium text-white shadow-sm dark:bg-[#d4af37] dark:text-[#1a1816]">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
