interface HealthStatusBarProps {
  checking: boolean;
  healthy: boolean;
  sidecarAttempted: boolean;
  error: string | null;
}

export function HealthStatusBar({
  checking,
  healthy,
  sidecarAttempted,
  error,
}: HealthStatusBarProps) {
  if (healthy) {
    return (
      <div className="border-b border-[var(--state-success)]/30 bg-[var(--state-success)]/10 px-4 py-2 text-[12px] text-[var(--state-success)]">
        OpenClaw 服务可用
      </div>
    );
  }

  if (checking) {
    return (
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-[12px] text-[var(--text-secondary)]">
        正在检查服务状态...
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--state-error)]/30 bg-[var(--state-error)]/10 px-4 py-2 text-[12px] text-[var(--state-error)]">
      服务未就绪{sidecarAttempted ? '（已尝试拉起 sidecar）' : ''} {error ? `: ${error}` : ''}
    </div>
  );
}
