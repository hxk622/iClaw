import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { IClawClient } from '@iclaw/sdk';
import { Button } from './ui/Button';
import { FaultReportModal } from './FaultReportModal';

export type GlobalExceptionState = {
  title: string;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
};

type GlobalExceptionDialogProps = {
  exception: GlobalExceptionState | null;
  client: IClawClient;
  accessToken?: string | null;
  accountState: 'anonymous' | 'authenticated';
  installSessionId?: string | null;
  onClose: () => void;
};

export function GlobalExceptionDialog({
  exception,
  client,
  accessToken,
  accountState,
  installSessionId = null,
  onClose,
}: GlobalExceptionDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (!exception) {
    return null;
  }

  const detail = [exception.stack, exception.componentStack].filter(Boolean).join('\n\n');

  return (
    <>
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgba(8,12,20,0.46)] px-4 py-6 backdrop-blur-[5px]">
        <div className="w-full max-w-[720px] rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[rgba(239,68,68,0.12)] text-[rgb(185,28,28)] dark:text-[#fca5a5]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[20px] font-semibold text-[var(--text-primary)]">{exception.title}</div>
              <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{exception.message}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-5 flex w-full items-center justify-between rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
          >
            <span>诊断详情</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded ? (
            <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-4">
              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-[var(--text-secondary)]">{detail || '暂无更多诊断信息'}</pre>
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <Button variant="ghost" size="md" onClick={onClose} className="flex-1">
              关闭
            </Button>
            <Button variant="primary" size="md" onClick={() => window.location.reload()} className="flex-1">
              重试
            </Button>
            <Button variant="secondary" size="md" onClick={() => setReportOpen(true)} className="flex-1">
              故障上报
            </Button>
          </div>
        </div>
      </div>

      <FaultReportModal
        open={reportOpen}
        source="exception-dialog"
        client={client}
        accessToken={accessToken}
        accountState={accountState}
        installSessionId={installSessionId}
        failureStage="frontend_exception"
        errorTitle={exception.title}
        errorMessage={exception.message}
        extraDiagnostics={{
          stack: exception.stack || null,
          componentStack: exception.componentStack || null,
        }}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
