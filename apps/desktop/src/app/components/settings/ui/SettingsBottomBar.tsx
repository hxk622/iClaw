import { Check, RotateCcw, Save } from 'lucide-react';
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
    <div className="h-[72px] border-t border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_38%,transparent)] px-10">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          {hasUnsavedChanges ? (
            <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
          ) : (
            <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
          )}
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
            variant="secondary"
            size="sm"
            leadingIcon={<Save className="h-4 w-4" />}
            disabled={!hasUnsavedChanges || saveState === 'saving'}
            onClick={onSave}
            className="border-[rgba(23,23,23,0.18)] bg-[#171717] text-[#f7f5f0] hover:border-[rgba(17,17,15,0.28)] hover:bg-[#10100f] hover:text-[#fcfbf8] hover:shadow-[0_10px_24px_rgba(18,15,11,0.12)] dark:border-[rgba(23,23,23,0.18)] dark:bg-[#171717] dark:text-[#f2eee6] dark:hover:border-[rgba(17,17,15,0.28)] dark:hover:bg-[#10100f] dark:hover:text-[#fbf8f2] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.36)]"
          >
            {saveState === 'saving' ? '保存中...' : '保存更改'}
          </Button>
        </div>
      </div>
    </div>
  );
}
