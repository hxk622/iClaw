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
      <div className="border-b border-[#ecf7ef] bg-[#f4fff8] px-4 py-2 text-[12px] text-[#1f7a3d]">
        OpenClaw 服务可用
      </div>
    );
  }

  if (checking) {
    return (
      <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-2 text-[12px] text-[#666]">
        正在检查服务状态...
      </div>
    );
  }

  return (
    <div className="border-b border-[#ffe4e4] bg-[#fff8f8] px-4 py-2 text-[12px] text-[#b33939]">
      服务未就绪{sidecarAttempted ? '（已尝试拉起 sidecar）' : ''} {error ? `: ${error}` : ''}
    </div>
  );
}
