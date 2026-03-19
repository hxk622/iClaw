import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

interface SettingsBottomBarProps {
  hasUnsavedChanges: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage: string | null;
  onReset: () => void;
  onSave: () => void;
}

export function SettingsBottomBar({
  hasUnsavedChanges,
  saveState,
  saveMessage,
  onReset,
  onSave,
}: SettingsBottomBarProps) {
  const indicatorText =
    saveState === 'saved'
      ? '更改已保存'
      : saveState === 'error'
        ? '保存失败，请重试'
        : hasUnsavedChanges
          ? '有未保存的更改'
          : '当前页面已同步';

  return (
    <div className="border-t border-[var(--border-default)] bg-white/82 px-12 py-[18px] backdrop-blur-[10px] dark:bg-[rgba(12,12,12,0.86)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-secondary)]">
          {hasUnsavedChanges ? (
            <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
          ) : null}
          <span>{indicatorText}</span>
          {saveMessage && saveState !== 'idle' ? <span className="truncate text-xs">{saveMessage}</span> : null}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<RotateCcw className="h-4 w-4" />}
            disabled={!hasUnsavedChanges || saveState === 'saving'}
            onClick={onReset}
          >
            重置
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Save className="h-4 w-4" />}
            disabled={!hasUnsavedChanges || saveState === 'saving'}
            onClick={onSave}
          >
            {saveState === 'saving' ? '保存中...' : '保存更改'}
          </Button>
        </div>
      </div>
    </div>
  );
}
