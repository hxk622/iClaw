import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HardDriveDownload,
  LoaderCircle,
  PackageCheck,
  PlayCircle,
  SearchCheck,
} from 'lucide-react';
import type { RuntimeDiagnosis } from '../lib/tauri-runtime-config';

export type SetupStage = 'inspect' | 'download' | 'extract' | 'launch' | 'failed';

interface FirstRunSetupPanelProps {
  diagnosis: RuntimeDiagnosis | null;
  stage: SetupStage;
  stageTitle: string;
  stageDescription: string;
  loading: boolean;
  installing: boolean;
  installError: string | null;
  launchError: string | null;
  onRecheck: () => Promise<void>;
  onInstall: () => Promise<void>;
}

type StepDefinition = {
  key: Exclude<SetupStage, 'failed'>;
  label: string;
  detail: string;
  icon: typeof SearchCheck;
};

const STEPS: StepDefinition[] = [
  {
    key: 'inspect',
    label: '检查环境',
    detail: '确认核心组件、资源目录和配置文件是否齐全。',
    icon: SearchCheck,
  },
  {
    key: 'download',
    label: '下载组件',
    detail: '拉取首次运行所需的本地核心组件。',
    icon: HardDriveDownload,
  },
  {
    key: 'extract',
    label: '校验部署',
    detail: '校验完整性并展开到本地运行目录。',
    icon: PackageCheck,
  },
  {
    key: 'launch',
    label: '启动服务',
    detail: '拉起本地服务并执行健康检查。',
    icon: PlayCircle,
  },
];

const STAGE_PROGRESS: Record<Exclude<SetupStage, 'failed'>, number> = {
  inspect: 18,
  download: 46,
  extract: 72,
  launch: 92,
};

function stepStatus(
  step: Exclude<SetupStage, 'failed'>,
  stage: SetupStage,
): 'done' | 'active' | 'pending' {
  if (stage === 'failed') {
    return 'pending';
  }

  const currentIndex = STEPS.findIndex((item) => item.key === stage);
  const stepIndex = STEPS.findIndex((item) => item.key === step);
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

function statusTone(status: 'done' | 'active' | 'pending') {
  if (status === 'done') {
    return {
      border: 'border-emerald-200 bg-emerald-50/80',
      badge: 'border-emerald-300 bg-emerald-100 text-emerald-700',
      text: 'text-emerald-900',
      detail: 'text-emerald-700',
    };
  }
  if (status === 'active') {
    return {
      border: 'border-[#161616] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]',
      badge: 'border-[#161616] bg-[#161616] text-white',
      text: 'text-[#111111]',
      detail: 'text-[#5f5f5f]',
    };
  }
  return {
    border: 'border-[#ece7de] bg-[#fbf8f1]',
    badge: 'border-[#ddd5c7] bg-[#f4efe5] text-[#7e7464]',
    text: 'text-[#746a5c]',
    detail: 'text-[#9c9387]',
  };
}

export function FirstRunSetupPanel({
  diagnosis,
  stage,
  stageTitle,
  stageDescription,
  loading,
  installing,
  installError,
  launchError,
  onRecheck,
  onInstall,
}: FirstRunSetupPanelProps) {
  const errorMessage = installError || launchError;
  const progress = stage === 'failed' ? 92 : STAGE_PROGRESS[stage];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f1e8] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.85),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(245,223,187,0.5),_transparent_28%),linear-gradient(135deg,_#f9f4ea_0%,_#f2eadf_44%,_#efe6db_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(17,17,17,0.08),transparent)]" />

      <div className="relative w-full max-w-[980px] overflow-hidden rounded-[32px] border border-[#d9cfbf] bg-[rgba(255,252,246,0.88)] shadow-[0_24px_80px_rgba(97,75,39,0.16)] backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-[#e6dccb] px-6 py-6 lg:border-r lg:border-b-0 lg:px-8 lg:py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#9e907b]">
                  Initial Session
                </div>
                <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#171411]">
                  启动准备
                </h1>
              </div>
              <div className="rounded-full border border-[#d8ccba] bg-white/80 px-3 py-1 font-mono text-[11px] text-[#8f816f]">
                STEP {stage === 'failed' ? 'ERR' : progress}
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-full bg-[#e7dece]">
              <div
                className={`h-2 rounded-full bg-[linear-gradient(90deg,#1a1a1a_0%,#826a46_58%,#d9b37a_100%)] transition-all duration-700 ${
                  stage !== 'failed' ? 'animate-pulse' : ''
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 flex items-start gap-3">
              {stage === 'failed' ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b64d38]" />
              ) : (
                <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#7a6341]" />
              )}
              <div>
                <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#1d1915]">{stageTitle}</div>
                <p className="mt-1 max-w-[520px] text-[14px] leading-6 text-[#6f6458]">{stageDescription}</p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[#a3947f]">
                  阶段进度，不展示伪精确下载百分比
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {STEPS.map((step, index) => {
                const status = stage === 'failed' && errorMessage
                  ? index < 3 && diagnosis?.runtime_found
                    ? 'done'
                    : stepStatus(step.key, stage)
                  : stepStatus(step.key, stage);
                const tone = statusTone(status);
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={`rounded-[22px] border px-4 py-4 transition-all duration-300 ${tone.border}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border ${tone.badge}`}>
                        {status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Icon className={`h-4 w-4 ${status === 'active' ? 'animate-pulse' : ''}`} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[15px] font-medium ${tone.text}`}>{step.label}</span>
                          {status === 'active' && (
                            <span className="rounded-full bg-[#f4ede3] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7b6b55]">
                              Active
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 text-[13px] leading-5 ${tone.detail}`}>{step.detail}</p>
                      </div>
                      <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${status === 'active' ? 'text-[#1a1a1a]' : 'text-[#b1a592]'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6 lg:px-8 lg:py-8">
            <div className="rounded-[28px] border border-[#dfd3c2] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,241,232,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#9f907a]">Status</div>
              <div className="mt-4 space-y-3 text-[13px] text-[#5f564d]">
                <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <span>核心组件</span>
                  <span className={diagnosis?.runtime_found ? 'text-emerald-700' : 'text-[#9f927e]'}>
                    {diagnosis?.runtime_found ? '已就绪' : diagnosis?.runtime_installable ? '待部署' : '缺失'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <span>技能目录</span>
                  <span className={diagnosis?.skills_dir_ready ? 'text-emerald-700' : 'text-[#9f927e]'}>
                    {diagnosis?.skills_dir_ready ? '已同步' : '待检查'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <span>本地配置</span>
                  <span className={diagnosis?.mcp_config_ready ? 'text-emerald-700' : 'text-[#9f927e]'}>
                    {diagnosis?.mcp_config_ready ? '已加载' : '待检查'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <span>模型密钥</span>
                  <span className={diagnosis?.api_key_configured ? 'text-emerald-700' : 'text-[#9f927e]'}>
                    {diagnosis?.api_key_configured ? '已配置' : '未配置'}
                  </span>
                </div>
              </div>
            </div>

            {(diagnosis || errorMessage) && (
              <div className="mt-4 rounded-[26px] border border-[#e0d6c8] bg-[#fffdfa] p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#9f907a]">Diagnostics</div>

                {errorMessage && (
                  <div className="mt-4 rounded-2xl border border-[#efc6bc] bg-[#fff2ef] px-4 py-3 text-[13px] leading-6 text-[#a5432f]">
                    {errorMessage}
                  </div>
                )}

                {diagnosis && (
                  <div className="mt-4 space-y-2 font-mono text-[11px] leading-5 text-[#6e665d]">
                    <div>source: {diagnosis.runtime_source || '-'}</div>
                    <div>version: {diagnosis.runtime_version || '-'}</div>
                    <div>path: {diagnosis.runtime_path || '-'}</div>
                    <div>skills: {diagnosis.skills_dir}</div>
                    <div>config: {diagnosis.mcp_config}</div>
                    <div>work: {diagnosis.work_dir}</div>
                    <div>logs: {diagnosis.log_dir}</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void onRecheck()}
                disabled={loading || installing}
                className="rounded-full bg-[#171411] px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {errorMessage ? '重新尝试' : '重新检查'}
              </button>

              {diagnosis?.runtime_installable && !diagnosis.runtime_found && !installing && (
                <button
                  onClick={() => void onInstall()}
                  disabled={loading || installing}
                  className="rounded-full border border-[#d9ccbb] bg-white/90 px-5 py-2.5 text-[13px] font-medium text-[#5c5246] transition-colors hover:bg-[#faf5ee] disabled:opacity-50"
                >
                  手动准备组件
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
