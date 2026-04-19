import { Shield, Chrome, MonitorCheck } from 'lucide-react';

interface DesktopExtensionGrantModalProps {
  open: boolean;
  extensionId: string;
  browserFamily: string;
  deviceId: string;
  onAllow: () => void;
  onDeny: () => void;
}

export function DesktopExtensionGrantModal({
  open,
  extensionId,
  browserFamily,
  deviceId,
  onAllow,
  onDeny,
}: DesktopExtensionGrantModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[rgba(8,12,20,0.56)] px-4 py-6 backdrop-blur-[6px]">
      <div
        className="w-full max-w-[480px] rounded-[24px] border text-[var(--text-primary)]"
        style={{
          borderColor: 'var(--drawer-shell-border)',
          background: 'var(--drawer-shell-bg)',
          boxShadow: 'var(--drawer-shell-shadow)',
        }}
      >
        <div className="border-b border-[var(--drawer-shell-border)] px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[rgba(59,130,246,0.10)] border border-[rgba(59,130,246,0.20)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-[15px] font-medium text-[var(--text-primary)]">允许浏览器插件接入 iClaw</h2>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-blue-500 to-purple-500" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] text-[#71717A] mb-0.5">插件</div>
                <div className="text-[13px] text-[var(--text-primary)]">{extensionId || 'iClaw Browser Extension'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Chrome className="w-4 h-4 text-[#A1A1AA]" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] text-[#71717A] mb-0.5">浏览器</div>
                <div className="text-[13px] text-[var(--text-primary)]">{browserFamily || 'Chrome'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <MonitorCheck className="w-4 h-4 text-[#A1A1AA]" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] text-[#71717A] mb-0.5">设备</div>
                <div className="text-[13px] text-[var(--text-primary)]">{deviceId || '当前桌面设备'}</div>
              </div>
            </div>

            <div className="mt-5 rounded-[16px] border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] px-4 py-4 text-[12px] leading-6 text-[var(--text-secondary)]">
              <span className="text-[var(--text-primary)] font-medium">安全提示：</span>
              授权后将建立插件与桌面端的信任关系，只会记住授权关系，不会把桌面主 token 暴露给插件。此授权只需确认一次，后续自动记住。
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onDeny}
            className="flex-1 rounded-[12px] border border-[var(--drawer-shell-border)] bg-[var(--bg-card)] px-4 py-2 text-[13px] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
          >
            暂不允许
          </button>
          <button
            onClick={onAllow}
            className="flex-1 rounded-[12px] bg-[var(--button-primary-bg)] px-4 py-2 text-[13px] text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-bg-hover)]"
          >
            允许并记住
          </button>
        </div>
      </div>
    </div>
  );
}
