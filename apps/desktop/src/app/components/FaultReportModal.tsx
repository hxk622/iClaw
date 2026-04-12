import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, LoaderCircle, Upload, X } from 'lucide-react';
import type { IClawClient } from '@iclaw/sdk';
import { Button } from './ui/Button';
import { submitDesktopFaultReport, type FaultReportPhase } from '@/app/lib/fault-report';

type FaultReportModalProps = {
  open: boolean;
  source: 'installer' | 'exception-dialog';
  client: IClawClient;
  accessToken?: string | null;
  accountState: 'anonymous' | 'authenticated';
  installSessionId?: string | null;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode?: string | null;
  installProgressPhase?: string | null;
  installProgressPercent?: number | null;
  extraDiagnostics?: Record<string, unknown> | null;
  onClose: () => void;
};

type ModalState = 'idle' | FaultReportPhase | 'success' | 'failed';

export function FaultReportModal({
  open,
  source,
  client,
  accessToken,
  accountState,
  installSessionId = null,
  failureStage,
  errorTitle,
  errorMessage,
  errorCode = null,
  installProgressPhase = null,
  installProgressPercent = null,
  extraDiagnostics = null,
  onClose,
}: FaultReportModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [progress, setProgress] = useState(0);
  const [reportId, setReportId] = useState('');
  const [packageSizeLabel, setPackageSizeLabel] = useState('待生成');
  const [failureReason, setFailureReason] = useState('');

  const sourceLabel = source === 'installer' ? '安装程序' : '异常弹窗';
  const phaseLabel = useMemo(() => {
    switch (state) {
      case 'collecting':
        return '收集日志中';
      case 'compressing':
        return '压缩诊断包中';
      case 'uploading':
        return '上传中';
      default:
        return '';
    }
  }, [state]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    setFailureReason('');
    setProgress(0);
    setState('collecting');
    try {
      const result = await submitDesktopFaultReport({
        client,
        accessToken,
        accountState,
        entry: source,
        installSessionId,
        failureStage,
        errorTitle,
        errorMessage,
        errorCode,
        installProgressPhase,
        installProgressPercent,
        extraDiagnostics,
        onPhaseChange: (phase) => {
          setState(phase);
          if (phase === 'collecting') setProgress(12);
          if (phase === 'compressing') setProgress(34);
          if (phase === 'uploading') setProgress(45);
        },
        onUploadProgress: ({ percent, total }) => {
          if (typeof total === 'number' && total > 0) {
            setPackageSizeLabel(`${Math.max(1, Math.round(total / 1024))} KB`);
          }
          setProgress(percent == null ? 72 : Math.max(45, percent));
        },
      });
      setReportId(result.report_id);
      setPackageSizeLabel(`${Math.max(1, Math.round(result.file_size_bytes / 1024))} KB`);
      setProgress(100);
      setState('success');
    } catch (error) {
      setState('failed');
      setFailureReason(error instanceof Error ? error.message : '故障上报失败，请稍后重试');
    }
  }

  async function copyReportId() {
    if (!reportId) return;
    await navigator.clipboard.writeText(reportId).catch(() => undefined);
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(8,12,20,0.56)] px-4 py-6 backdrop-blur-[6px]">
      <div className="w-full max-w-[520px] rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold text-[var(--text-primary)]">故障上报</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">上传最近日志与诊断摘要，便于排查问题。</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === 'idle' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-4">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)]">上报来源</span>
                  <span className="font-medium text-[var(--text-primary)]">{sourceLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)]">故障阶段</span>
                  <span className="font-medium text-[var(--text-primary)]">{failureStage}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)]">身份状态</span>
                  <span className="font-medium text-[var(--text-primary)]">{accountState === 'authenticated' ? '已登录' : '匿名'}</span>
                </div>
              </div>
            </div>
            <div className="rounded-[22px] border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] px-4 py-4 text-xs leading-6 text-[var(--text-secondary)]">
              <div className="font-medium text-[var(--text-primary)]">隐私说明</div>
              <div className="mt-2">
                仅上传最近日志、运行诊断与错误摘要。每个日志文件最多保留最后 1000 行，不上传账号密钥或无关文件。
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button variant="primary" size="md" onClick={() => void handleSubmit()} className="flex-1" leadingIcon={<Upload className="h-4 w-4" />}>
                开始上报
              </Button>
            </div>
          </div>
        ) : null}

        {(state === 'collecting' || state === 'compressing' || state === 'uploading') ? (
          <div className="mt-8">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--brand-primary)]">
                <LoaderCircle className="h-8 w-8 animate-spin" />
              </div>
              <div className="text-center">
                <div className="text-base font-medium text-[var(--text-primary)]">{phaseLabel}</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">诊断包大小：{packageSizeLabel}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <span>{phaseLabel}</span>
                <span className="font-medium text-[var(--text-primary)]">{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {state === 'success' ? (
          <div className="mt-8 space-y-5">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)] text-[rgb(21,128,61)] dark:text-[#86efac]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">上报成功</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">诊断信息已上传，请将编号提供给支持人员。</div>
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Report ID</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[14px] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {reportId}
                </code>
                <Button variant="secondary" size="sm" onClick={() => void copyReportId()} leadingIcon={<Copy className="h-3.5 w-3.5" />}>
                  复制
                </Button>
              </div>
            </div>
            <Button variant="primary" size="md" block onClick={onClose}>
              完成
            </Button>
          </div>
        ) : null}

        {state === 'failed' ? (
          <div className="mt-8 space-y-5">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(239,68,68,0.12)] text-[rgb(185,28,28)] dark:text-[#fca5a5]">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">上传失败</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">{failureReason || '请稍后重试'}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button variant="primary" size="md" onClick={() => void handleSubmit()} className="flex-1">
                重试
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
