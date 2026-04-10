import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cloud,
  FileText,
  FolderOpen,
  RotateCcw,
  Server,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/app/lib/cn';

export type HighRiskImpactItemType = 'file' | 'service' | 'directory' | 'cloud' | 'privilege';
export type HighRiskRollbackStatus = 'full' | 'partial' | 'none';

export type HighRiskImpactItem = {
  type: HighRiskImpactItemType;
  label?: string | null;
  value: string;
};

export type HighRiskConfirmationModalProps = {
  open: boolean;
  riskLevel: 'high' | 'critical';
  title: string;
  description: string;
  reason: string;
  impactItems: HighRiskImpactItem[];
  rollbackStatus: HighRiskRollbackStatus;
  rollbackDescription: string;
  commandSummary: string;
  fullCommand?: string | null;
  requireAcknowledgement?: boolean;
  acknowledgementText?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
};

const IMPACT_ICON_MAP: Record<HighRiskImpactItemType, typeof FileText> = {
  file: FileText,
  service: Server,
  directory: FolderOpen,
  cloud: Cloud,
  privilege: ShieldAlert,
};

const IMPACT_LABEL_MAP: Record<HighRiskImpactItemType, string> = {
  file: '影响文件',
  service: '影响服务',
  directory: '影响目录',
  cloud: '上传目标',
  privilege: '权限要求',
};

const ROLLBACK_CONFIG: Record<
  HighRiskRollbackStatus,
  {
    label: string;
    toneClassName: string;
    borderClassName: string;
    iconClassName: string;
    icon: typeof AlertCircle;
  }
> = {
  full: {
    label: '可回滚',
    toneClassName:
      'bg-[rgba(34,197,94,0.08)] text-[rgb(22,101,52)] dark:bg-[rgba(34,197,94,0.16)] dark:text-[#86efac]',
    borderClassName:
      'border-[rgba(34,197,94,0.16)] dark:border-[rgba(34,197,94,0.24)]',
    iconClassName: 'text-[rgb(22,163,74)] dark:text-[#86efac]',
    icon: CheckCircle,
  },
  partial: {
    label: '部分可回滚',
    toneClassName:
      'bg-[rgba(245,158,11,0.08)] text-[rgb(180,83,9)] dark:bg-[rgba(245,158,11,0.14)] dark:text-[#fbbf24]',
    borderClassName:
      'border-[rgba(245,158,11,0.16)] dark:border-[rgba(245,158,11,0.24)]',
    iconClassName: 'text-[rgb(217,119,6)] dark:text-[#fbbf24]',
    icon: AlertCircle,
  },
  none: {
    label: '不可回滚',
    toneClassName:
      'bg-[rgba(239,68,68,0.08)] text-[rgb(185,28,28)] dark:bg-[rgba(239,68,68,0.14)] dark:text-[#fca5a5]',
    borderClassName:
      'border-[rgba(239,68,68,0.16)] dark:border-[rgba(239,68,68,0.24)]',
    iconClassName: 'text-[rgb(220,38,38)] dark:text-[#fca5a5]',
    icon: AlertCircle,
  },
};

export function HighRiskConfirmationModal({
  open,
  riskLevel,
  title,
  description,
  reason,
  impactItems,
  rollbackStatus,
  rollbackDescription,
  commandSummary,
  fullCommand,
  requireAcknowledgement = true,
  acknowledgementText = '我已知晓该操作会影响本地环境',
  confirmText = '确认执行',
  cancelText = '取消',
  onConfirm,
  onCancel,
  onOpenChange,
}: HighRiskConfirmationModalProps) {
  const [commandExpanded, setCommandExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) {
      setCommandExpanded(false);
      setAcknowledged(false);
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onOpenChange, open]);

  const canConfirm = !requireAcknowledgement || acknowledged;
  const rollbackConfig = ROLLBACK_CONFIG[rollbackStatus];
  const RollbackIcon = rollbackConfig.icon;
  const riskLabel = riskLevel === 'critical' ? '严重风险 Critical' : '高危 High Risk';

  const normalizedImpactItems = useMemo(
    () => impactItems.filter((item) => String(item.value || '').trim()),
    [impactItems],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(8,12,20,0.42)] px-5 py-6 backdrop-blur-[5px] dark:bg-[rgba(0,0,0,0.56)]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
          onOpenChange(false);
        }
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-[rgba(229,231,235,0.92)] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:border-[rgba(39,39,42,0.92)] dark:bg-[rgb(10,10,11)] dark:shadow-[0_36px_100px_rgba(0,0,0,0.42)]">
        <button
          type="button"
          className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[rgba(82,82,91,0.92)] transition hover:bg-[rgba(244,244,245,0.96)] hover:text-[rgb(24,24,27)] dark:text-[rgba(161,161,170,0.9)] dark:hover:bg-[rgba(39,39,42,0.96)] dark:hover:text-[rgb(244,244,245)]"
          aria-label="关闭高危确认弹层"
          onClick={() => {
            onCancel();
            onOpenChange(false);
          }}
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="border-b border-[rgba(251,191,36,0.14)] bg-gradient-to-b from-[rgba(255,251,235,0.76)] to-white px-7 pt-7 pb-6 dark:border-[rgba(251,191,36,0.18)] dark:from-[rgba(120,53,15,0.14)] dark:to-[rgb(10,10,11)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[rgba(252,211,77,0.28)] bg-[rgba(255,251,235,0.92)] dark:border-[rgba(245,158,11,0.28)] dark:bg-[rgba(120,53,15,0.28)]">
                <AlertTriangle className="h-5 w-5 text-[rgb(217,119,6)] dark:text-[#fbbf24]" />
              </div>
              <span className="inline-flex items-center rounded-full border border-[rgba(239,68,68,0.16)] bg-[rgba(254,242,242,0.92)] px-2.5 py-1 text-[12px] font-semibold text-[rgb(185,28,28)] dark:border-[rgba(239,68,68,0.24)] dark:bg-[rgba(127,29,29,0.28)] dark:text-[#fca5a5]">
                {riskLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="pr-12 text-[22px] font-semibold tracking-[-0.02em] text-[rgb(17,24,39)] dark:text-[rgb(250,250,250)]">
                {title}
              </h2>
              <p className="max-w-[680px] text-[14px] leading-6 text-[rgb(75,85,99)] dark:text-[rgb(161,161,170)]">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          <div className="space-y-5">
            <section className="space-y-2">
              <div className="text-[13px] font-semibold text-[rgb(24,24,27)] dark:text-[rgb(244,244,245)]">原因说明</div>
              <p className="rounded-[18px] border border-[rgba(229,231,235,0.92)] bg-[rgba(249,250,251,0.88)] px-4 py-3 text-[14px] leading-6 text-[rgb(63,63,70)] dark:border-[rgba(39,39,42,0.92)] dark:bg-[rgba(24,24,27,0.84)] dark:text-[rgb(212,212,216)]">
                {reason}
              </p>
            </section>

            <section className="overflow-hidden rounded-[18px] border border-[rgba(229,231,235,0.92)] bg-[rgba(249,250,251,0.88)] dark:border-[rgba(39,39,42,0.92)] dark:bg-[rgba(24,24,27,0.84)]">
              <div className="border-b border-[rgba(229,231,235,0.92)] px-4 py-3 text-[13px] font-semibold text-[rgb(24,24,27)] dark:border-[rgba(39,39,42,0.92)] dark:text-[rgb(244,244,245)]">
                影响对象
              </div>
              <div className="max-h-[248px] overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {normalizedImpactItems.map((item, index) => {
                    const Icon = IMPACT_ICON_MAP[item.type];
                    return (
                      <div key={`${item.type}:${item.value}:${index}`} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(243,244,246,0.96)] dark:bg-[rgba(39,39,42,0.96)]">
                          <Icon className="h-4 w-4 text-[rgb(82,82,91)] dark:text-[rgb(161,161,170)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 text-[11px] font-medium text-[rgb(115,115,115)] dark:text-[rgb(113,113,122)]">
                            {item.label || IMPACT_LABEL_MAP[item.type]}
                          </div>
                          <div className="break-all font-mono text-[13px] leading-5 text-[rgb(24,24,27)] dark:text-[rgb(244,244,245)]">
                            {item.value}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              className={cn(
                'rounded-[18px] border px-4 py-4',
                rollbackConfig.toneClassName,
                rollbackConfig.borderClassName,
              )}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  <RotateCcw className={cn('h-4 w-4', rollbackConfig.iconClassName)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <div className={cn('text-[13px] font-semibold', rollbackConfig.iconClassName)}>{rollbackConfig.label}</div>
                    <RollbackIcon className={cn('h-3.5 w-3.5', rollbackConfig.iconClassName)} />
                  </div>
                  <p className="text-[13px] leading-6 text-[rgb(63,63,70)] dark:text-[rgb(212,212,216)]">
                    {rollbackDescription}
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[18px] border border-[rgba(229,231,235,0.92)] bg-[rgba(249,250,251,0.88)] dark:border-[rgba(39,39,42,0.92)] dark:bg-[rgba(24,24,27,0.84)]">
              <div className="flex items-center justify-between gap-3 border-b border-[rgba(229,231,235,0.92)] px-4 py-3 dark:border-[rgba(39,39,42,0.92)]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[rgb(82,82,91)] dark:text-[rgb(161,161,170)]" />
                  <div className="text-[13px] font-semibold text-[rgb(24,24,27)] dark:text-[rgb(244,244,245)]">命令摘要</div>
                </div>
                {fullCommand ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[12px] font-medium text-[rgb(82,82,91)] transition hover:bg-[rgba(244,244,245,0.96)] hover:text-[rgb(24,24,27)] dark:text-[rgb(161,161,170)] dark:hover:bg-[rgba(39,39,42,0.96)] dark:hover:text-[rgb(244,244,245)]"
                    onClick={() => setCommandExpanded((current) => !current)}
                  >
                    {commandExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {commandExpanded ? '收起完整命令' : '查看完整命令'}
                  </button>
                ) : null}
              </div>
              <div className="px-4 py-4">
                <div className="rounded-[14px] bg-[rgb(17,24,39)] px-3.5 py-3 font-mono text-[13px] leading-6 text-[rgb(243,244,246)] dark:bg-[rgb(3,7,18)] dark:text-[rgb(244,244,245)]">
                  <code className="break-all">{commandSummary}</code>
                </div>
                {fullCommand && commandExpanded ? (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-[14px] bg-[rgb(17,24,39)] px-3.5 py-3 font-mono text-[13px] leading-6 text-[rgb(243,244,246)] dark:bg-[rgb(3,7,18)] dark:text-[rgb(244,244,245)]">
                    <code className="whitespace-pre-wrap break-all">{fullCommand}</code>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-[rgba(229,231,235,0.92)] bg-[rgba(249,250,251,0.72)] px-7 py-5 dark:border-[rgba(39,39,42,0.92)] dark:bg-[rgba(24,24,27,0.72)]">
          <div className="flex flex-col gap-4">
            {requireAcknowledgement ? (
              <label className="flex cursor-pointer items-start gap-3 px-1">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[rgba(161,161,170,0.72)] text-[rgb(220,38,38)] focus:ring-[rgba(220,38,38,0.24)] dark:border-[rgba(82,82,91,0.92)] dark:bg-[rgb(24,24,27)] dark:focus:ring-[rgba(239,68,68,0.28)]"
                />
                <span className="text-[13px] leading-6 text-[rgb(63,63,70)] dark:text-[rgb(212,212,216)]">
                  {acknowledgementText}
                </span>
              </label>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="inline-flex min-w-[100px] items-center justify-center rounded-[14px] border border-[rgba(212,212,216,0.96)] bg-white px-4 py-2.5 text-[14px] font-medium text-[rgb(39,39,42)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[rgba(244,244,245,0.96)] dark:border-[rgba(63,63,70,0.96)] dark:bg-[rgb(24,24,27)] dark:text-[rgb(228,228,231)] dark:hover:bg-[rgba(39,39,42,0.96)]"
                onClick={() => {
                  onCancel();
                  onOpenChange(false);
                }}
              >
                {cancelText}
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                className="inline-flex min-w-[120px] items-center justify-center rounded-[14px] bg-[rgb(220,38,38)] px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_12px_24px_rgba(220,38,38,0.18)] transition hover:bg-[rgb(185,28,28)] disabled:cursor-not-allowed disabled:bg-[rgba(244,63,94,0.42)] disabled:shadow-none dark:bg-[rgb(220,38,38)] dark:hover:bg-[rgb(185,28,28)] dark:disabled:bg-[rgba(127,29,29,0.72)]"
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
