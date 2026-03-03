import type { RuntimeDiagnosis } from '../lib/tauri-runtime-config';

interface FirstRunSetupPanelProps {
  diagnosis: RuntimeDiagnosis | null;
  loading: boolean;
  onRecheck: () => Promise<void>;
}

function mark(ok: boolean): string {
  return ok ? '✅' : '❌';
}

export function FirstRunSetupPanel({
  diagnosis,
  loading,
  onRecheck,
}: FirstRunSetupPanelProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[720px] rounded-2xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="text-[20px] font-semibold text-[#1f1f1f]">首次运行配置</h1>
        <p className="mt-1 text-[13px] text-[#8f8f8f]">
          本地 sidecar 模式：请确认能力资源与 API Key 可用。
        </p>

        <div className="mt-4 rounded-lg bg-[#fafafa] p-4 text-[13px] text-[#444]">
          <div>{mark(Boolean(diagnosis?.sidecar_binary_found))} Sidecar 二进制</div>
          <div>{mark(Boolean(diagnosis?.skills_dir_ready))} Skills 资源目录</div>
          <div>{mark(Boolean(diagnosis?.mcp_config_ready))} MCP 配置文件</div>
          <div>{mark(Boolean(diagnosis?.api_key_configured))} 模型 API key（由后端控制）</div>
        </div>

        {diagnosis && (
          <div className="mt-3 rounded-lg border border-[#efefef] bg-white p-3 text-[12px] text-[#666]">
            <div>skills: {diagnosis.skills_dir}</div>
            <div>mcp: {diagnosis.mcp_config}</div>
            <div>work: {diagnosis.work_dir}</div>
            <div>logs: {diagnosis.log_dir}</div>
            <div>cache: {diagnosis.cache_dir}</div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void onRecheck()}
            disabled={loading}
            className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#555] hover:bg-[#fafafa]"
          >
            重新检测
          </button>
        </div>
      </div>
    </div>
  );
}
