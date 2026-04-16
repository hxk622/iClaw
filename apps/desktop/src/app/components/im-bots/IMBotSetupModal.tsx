import { useEffect, useMemo, useState } from 'react';
import type { ImBotConnectionPreflightResult } from '@iclaw/sdk';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { ChecklistPanel } from '@/app/components/ui/ChecklistPanel';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import { WizardStepper, type WizardStepItem } from '@/app/components/ui/WizardStepper';
import { cn } from '@/app/lib/cn';
import { openExternalUrl } from '@/app/lib/open-external-url';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export type IMPlatformId =
  | 'feishu-china'
  | 'dingtalk'
  | 'wecom'
  | 'wecom-app'
  | 'wecom-kf'
  | 'qqbot'
  | 'wechat-mp'
  | 'openclaw-weixin';
export type TriggerMode = 'mention' | 'all' | 'keyword';
export type ReplyFormat = 'text' | 'card' | 'markdown';

export interface IMPlatformMeta {
  id: IMPlatformId;
  label: string;
  logo: string;
  logoClassName?: string;
  intro: string;
  difficulty: string;
  eta: string;
  admin: string;
  guideUrl: string;
  credentialFields: Array<{
    key: string;
    label: string;
    placeholder: string;
    readOnly?: boolean;
    helpText?: string;
  }>;
  introSteps: string[];
  testHints: string[];
}

export interface IMBotDraft {
  platformId: IMPlatformId;
  triggerMode: TriggerMode;
  replyFormat: ReplyFormat;
  credentials: Record<string, string>;
  preflightResult: ImBotConnectionPreflightResult | null;
}

interface IMBotSetupModalProps {
  platform: IMPlatformMeta | null;
  open: boolean;
  onClose: () => void;
  onValidateConnection: (
    platformId: IMPlatformId,
    credentials: Record<string, string>,
  ) => Promise<ImBotConnectionPreflightResult>;
  onComplete: (draft: IMBotDraft) => void;
}

type WizardStep = 1 | 2 | 3 | 4;

const stepLabels: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: '创建应用' },
  { step: 2, label: '填写凭据' },
  { step: 3, label: '行为配置' },
  { step: 4, label: '完成接入' },
];

const triggerModeOptions: Array<{ value: TriggerMode; label: string; description: string }> = [
  { value: 'mention', label: '@提及时响应', description: '适合企业群聊，避免机器人打扰所有消息。' },
  { value: 'all', label: '全部消息', description: '适合专属机器人频道或一对一会话。' },
  { value: 'keyword', label: '关键词触发', description: '仅在命中关键词时响应，更适合试运行阶段。' },
];

const replyFormatOptions: Array<{ value: ReplyFormat; label: string; description: string }> = [
  { value: 'card', label: '卡片/富文本', description: '更适合结构化回复、状态同步与通知类场景。' },
  { value: 'markdown', label: 'Markdown', description: '适合办公 IM 中的长文本、清单和说明内容。' },
  { value: 'text', label: '纯文本', description: '兼容性最好，适合保守上线或通道能力有限的平台。' },
];

const completionChecklist = [
  '在平台侧创建并配置应用',
  '填写基础凭据与回调信息',
  '完成一次真实平台预检',
  '设置默认触发与回复策略',
  '启用一个新的 iClaw 机器人实例',
];

const SECTION_LABEL =
  'text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9B9691] dark:text-[#6B6863]';
const MODAL_INPUT_CLASS =
  'min-h-[44px] w-full rounded-[14px] border border-[#E8E6E3] bg-white px-4 text-[14px] text-[#1A1916] outline-none transition placeholder:text-[#A8A39D] focus:border-[#C9B896] focus:ring-2 focus:ring-[#C9B896]/20 dark:border-[#2D2C2A] dark:bg-[#242320] dark:text-[#F5F4F2] dark:placeholder:text-[#726C66] dark:focus:border-[#9D8B6F] dark:focus:ring-[#9D8B6F]/20';
const MODAL_READONLY_INPUT_CLASS = 'bg-[#F5F4F2] dark:bg-[#1C1B19]';

export function IMBotSetupModal({
  platform,
  open,
  onClose,
  onValidateConnection,
  onComplete,
}: IMBotSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('mention');
  const [replyFormat, setReplyFormat] = useState<ReplyFormat>('card');
  const [keywordDraft, setKeywordDraft] = useState('AI助手');
  const [offlineReply, setOfflineReply] = useState('我现在暂时离线，稍后会继续处理你的消息。');
  const [preflightResult, setPreflightResult] = useState<ImBotConnectionPreflightResult | null>(null);
  const [preflightStatus, setPreflightStatus] = useState<'idle' | 'running'>('idle');

  useEffect(() => {
    if (!open || !platform) return;
    setCurrentStep(1);
    setTriggerMode('mention');
    setReplyFormat(
      platform.id === 'dingtalk' || platform.id === 'qqbot' || platform.id === 'wechat-mp'
        ? 'markdown'
        : 'card',
    );
    setKeywordDraft('AI助手');
    setOfflineReply('我现在暂时离线，稍后会继续处理你的消息。');
    setPreflightResult(null);
    setPreflightStatus('idle');

    const nextCredentials: Record<string, string> = {};
    for (const field of platform.credentialFields) {
      nextCredentials[field.key] = field.readOnly
        ? getReadonlyValue(platform.id, field.key)
        : '';
    }
    setCredentials(nextCredentials);
  }, [open, platform]);

  const canAdvanceFromCredentials = useMemo(() => {
    if (!platform) return false;
    return platform.credentialFields.every((field) => {
      if (field.readOnly) return true;
      return Boolean((credentials[field.key] || '').trim());
    });
  }, [credentials, platform]);

  const isRealPreflightSupported = useMemo(
    () =>
      platform
        ? platform.id === 'dingtalk' ||
          platform.id === 'feishu-china' ||
          platform.id === 'wecom-app' ||
          platform.id === 'wechat-mp'
        : false,
    [platform],
  );

  if (!open || !platform) return null;

  const wizardSteps: WizardStepItem[] = stepLabels.map((item) => ({
    id: item.step,
    label: item.label,
    status:
      item.step < currentStep ? 'completed' : item.step === currentStep ? 'current' : 'upcoming',
  }));

  const completionItems = [
    {
      id: completionChecklist[0],
      label: completionChecklist[0],
      completed: currentStep >= 2,
    },
    {
      id: completionChecklist[1],
      label: completionChecklist[1],
      completed: currentStep >= 3 || (currentStep === 2 && canAdvanceFromCredentials),
    },
    {
      id: completionChecklist[2],
      label: completionChecklist[2],
      completed: Boolean(preflightResult?.ok),
    },
    {
      id: completionChecklist[3],
      label: completionChecklist[3],
      completed: currentStep >= 4,
    },
    {
      id: completionChecklist[4],
      label: completionChecklist[4],
      completed: currentStep === 4,
    },
  ];

  const tipItems = platform.testHints.map((hint) => ({
    id: hint,
    label: hint,
    icon: <Info className="h-[13px] w-[13px]" />,
  }));

  const primaryActionLabel = currentStep === 4 ? '完成' : '下一步';

  const handleCredentialChange = (fieldKey: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [fieldKey]: value }));
    setPreflightResult(null);
    setPreflightStatus('idle');
  };

  const handleRunPreflight = async () => {
    if (!platform || !canAdvanceFromCredentials || preflightStatus === 'running') return;
    setPreflightStatus('running');
    try {
      const result = await onValidateConnection(platform.id, credentials);
      setPreflightResult(result);
    } finally {
      setPreflightStatus('idle');
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore clipboard failures in design-only flows.
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2 && canAdvanceFromCredentials) {
      if (!isRealPreflightSupported) {
        return;
      }
      if (!preflightResult?.ok) {
        return;
      }
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 4) {
      onComplete({ platformId: platform.id, triggerMode, replyFormat, credentials, preflightResult });
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep === 1) {
      onClose();
      return;
    }
    setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.36)] px-5 py-5 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.48)]">
      <div className="relative flex h-full max-h-[840px] w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl border border-[#E8E6E3] bg-[#F9F8F6] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:border-[#2D2C2A] dark:bg-[#1C1B19] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
        <div className="border-b border-[#E8E6E3] px-10 pb-6 pt-8 dark:border-[#2D2C2A]">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8E6E3] bg-white shadow-sm dark:border-[#2D2C2A] dark:bg-[#242320]">
                <img
                  src={platform.logo}
                  alt={platform.label}
                  className={cn('h-full w-full object-cover', platform.logoClassName)}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl tracking-tight text-[#1A1916] dark:text-[#F5F4F2]">
                  接入{platform.label}机器人
                </h2>
                <p className="mt-1 max-w-[620px] text-[13px] leading-[1.55] text-[#6B6863] dark:text-[#A39F9A]">
                  按步骤完成应用配置，并将其连接到 iClaw
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent p-0 text-[#6B6863] hover:bg-[#EFEDE9] dark:text-[#A39F9A] dark:hover:bg-[#252422]',
                APPLE_FLAT_SURFACE,
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
              )}
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-[#E8E6E3] px-10 py-6 dark:border-[#2D2C2A]">
          <WizardStepper steps={wizardSteps} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-7 p-10">
          <div className="min-h-0 overflow-y-auto">
            {currentStep === 1 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base tracking-tight text-[#1A1916] dark:text-[#F5F4F2]">
                    先在{platform.label}开放平台创建应用
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6B6863] dark:text-[#A39F9A]">
                    这一步需要在{platform.label}官方后台完成，iClaw 不替代第三方应用创建
                  </p>
                </div>

                <SurfacePanel className="space-y-3 p-[18px]">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#6b6863] dark:text-[#a39f9a]">
                    <Info className="h-4 w-4" />
                    <span>操作步骤</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {platform.introSteps.map((step, index) => (
                      <div key={step} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3f0ea] text-[11px] text-[#6b6863] dark:bg-[rgba(255,255,255,0.06)] dark:text-[#a39f9a]">
                          {index + 1}
                        </div>
                        <p className="text-[13px] leading-relaxed text-[#3D3A36] dark:text-[#D4D2CE]">{step}</p>
                      </div>
                    ))}
                  </div>
                </SurfacePanel>

                <SurfacePanel tone="subtle" className="p-[18px]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C9B896]/20 text-[#9D8B6F] dark:bg-[#9D8B6F]/20 dark:text-[#C9B896]">
                      <ChevronRight className="h-[14px] w-[14px]" />
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#3D3A36] dark:text-[#D4D2CE]">
                      接入完成后，系统会把它作为独立机器人实例管理。你可以在 iClaw 中统一配置机器人的触发规则、响应方式和权限控制。
                    </p>
                  </div>
                </SurfacePanel>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void openExternalUrl(platform.guideUrl);
                    }}
                    leadingIcon={<ExternalLink className="h-[14px] w-[14px]" />}
                  >
                    <span>打开{platform.label}开放平台</span>
                  </Button>
                  <p className="mt-2 text-[12px] text-[#9B9691] dark:text-[#6B6863]">将在浏览器打开官方后台</p>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-[18px]">
                <div>
                  <h3 className="text-base tracking-tight text-[#1A1916] dark:text-[#F5F4F2]">
                    填写平台凭据
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6B6863] dark:text-[#A39F9A]">
                    {platform.id.startsWith('wecom')
                      ? '企微接入需要企业管理员提供应用凭据。像回调地址这类由系统生成的项目，会自动带出并支持复制。'
                      : '只保留用户真正需要填写的核心字段。像回调地址这类由系统生成的项目，会自动带出并支持复制。'}
                  </p>
                </div>

                <SurfacePanel className="space-y-3.5 p-4">
                  {platform.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[13px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          value={credentials[field.key] || ''}
                          onChange={(event) => handleCredentialChange(field.key, event.target.value)}
                          readOnly={field.readOnly}
                          placeholder={field.placeholder}
                          className={cn(
                            'flex-1',
                            MODAL_INPUT_CLASS,
                            field.readOnly && MODAL_READONLY_INPUT_CLASS,
                          )}
                        />
                        {field.readOnly ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={<Copy className="h-4 w-4" />}
                            onClick={() => handleCopy(credentials[field.key] || '')}
                          >
                            复制
                          </Button>
                        ) : null}
                      </div>
                      {field.readOnly || field.helpText ? (
                        <p className="text-[12px] leading-[1.45] text-[#9B9691] dark:text-[#6B6863]">
                          {field.readOnly
                            ? '这个地址由系统生成，用来接收平台事件回调。'
                            : field.helpText}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </SurfacePanel>

                <SurfacePanel className="space-y-3.5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-[14px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">真实连接测试</h4>
                      <p className="mt-1 text-[12px] leading-[1.55] text-[#6B6863] dark:text-[#A39F9A]">
                        直接调用平台官方接口校验应用凭据，不再使用本地 timer 或 runtime 健康检查冒充成功。
                      </p>
                    </div>
                    {isRealPreflightSupported ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void handleRunPreflight();
                        }}
                        disabled={!canAdvanceFromCredentials || preflightStatus === 'running'}
                        leadingIcon={
                          preflightStatus === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined
                        }
                      >
                        {preflightStatus === 'running' ? '测试中' : '测试连接'}
                      </Button>
                    ) : (
                      <span title="开发中" className="inline-flex cursor-not-allowed">
                        <Button variant="secondary" size="sm" disabled>
                          开发中
                        </Button>
                      </span>
                    )}
                  </div>

                  {isRealPreflightSupported ? (
                    preflightResult ? (
                      <div
                        className={cn(
                          'rounded-[16px] border px-4 py-3',
                          preflightResult.ok
                            ? 'border-[#C9E3D1] bg-[#F4FBF6] dark:border-[#31573D] dark:bg-[#16241A]'
                            : 'border-[#F3D2AE] bg-[#FFF8F1] dark:border-[#6B4B2E] dark:bg-[#241C16]',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                              preflightResult.ok
                                ? 'bg-[#2F5D3E]/12 text-[#2F5D3E] dark:bg-[#3A6B4A]/24 dark:text-[#A8E2BA]'
                                : 'bg-[#B86B19]/12 text-[#B86B19] dark:bg-[#8B5B1F]/24 dark:text-[#F2C28D]',
                            )}
                          >
                            {preflightResult.ok ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">
                              {preflightResult.ok ? '预检通过' : '预检未通过'}
                            </div>
                            <p className="mt-1 text-[12px] leading-[1.6] text-[#6B6863] dark:text-[#A39F9A]">
                              {preflightResult.message}
                            </p>
                            <div className="mt-3 space-y-2">
                              {preflightResult.checks.map((check) => (
                                <div
                                  key={check.id}
                                  className="rounded-[12px] border border-[#E8E6E3] bg-white/80 px-3 py-2 dark:border-[#2D2C2A] dark:bg-[#242320]"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-[12px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">
                                      {check.label}
                                    </div>
                                    <span
                                      className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px]',
                                        check.status === 'success'
                                          ? 'bg-[#DDEEE2] text-[#2F5D3E] dark:bg-[#23372A] dark:text-[#A8E2BA]'
                                          : check.status === 'warning'
                                            ? 'bg-[#F8E7CF] text-[#9C651F] dark:bg-[#3B2A18] dark:text-[#F2C28D]'
                                            : 'bg-[#F7DDDD] text-[#9F2F2F] dark:bg-[#3C2020] dark:text-[#FFB4B4]',
                                      )}
                                    >
                                      {check.status === 'success'
                                        ? '通过'
                                        : check.status === 'warning'
                                          ? '注意'
                                          : '失败'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[12px] leading-[1.55] text-[#6B6863] dark:text-[#A39F9A]">
                                    {check.detail}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-dashed border-[#E0DCD6] bg-[#FCFBF9] px-4 py-3 text-[12px] leading-[1.6] text-[#6B6863] dark:border-[#34322F] dark:bg-[#201F1D] dark:text-[#A39F9A]">
                        完成字段填写后，点“测试连接”即可发起真实平台预检。只有预检通过，才允许进入下一步。
                      </div>
                    )
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[#E0DCD6] bg-[#FCFBF9] px-4 py-3 text-[12px] leading-[1.6] text-[#6B6863] dark:border-[#34322F] dark:bg-[#201F1D] dark:text-[#A39F9A]">
                      当前平台还没有接上真实官方预检链路，所以这里保持禁用，也不再允许按“已接入成功”继续流转。
                    </div>
                  )}
                </SurfacePanel>

                <SurfacePanel tone="subtle" className="p-3.5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#9D8B6F] dark:text-[#C9B896]" />
                    <p className="text-[13px] leading-relaxed text-[#3D3A36] dark:text-[#D4D2CE]">
                      凭据仅用于建立连接与签名校验。产品化视图不展示底层技术细节，避免用户在首次接入时被过多概念打断。
                    </p>
                  </div>
                </SurfacePanel>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base tracking-tight text-[#1A1916] dark:text-[#F5F4F2]">
                    配置机器人行为
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6B6863] dark:text-[#A39F9A]">
                    先给机器人一个轻量、可上线的默认配置。复杂路由和高级权限可以在详情页里继续补充。
                  </p>
                </div>

                <section className="space-y-2.5">
                  <div className={SECTION_LABEL}>触发方式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {triggerModeOptions.map((option) => (
                      <SelectionCard
                        as="button"
                        key={option.value}
                        onClick={() => setTriggerMode(option.value)}
                        selected={triggerMode === option.value}
                        className="rounded-xl"
                      >
                        <div className="text-[15px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[#6B6863] dark:text-[#A39F9A]">{option.description}</div>
                      </SelectionCard>
                    ))}
                  </div>
                </section>

                <section className="space-y-2.5">
                  <div className={SECTION_LABEL}>回复格式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {replyFormatOptions.map((option) => (
                      <SelectionCard
                        as="button"
                        key={option.value}
                        onClick={() => setReplyFormat(option.value)}
                        selected={replyFormat === option.value}
                        className="rounded-xl"
                      >
                        <div className="text-[15px] font-medium text-[#1A1916] dark:text-[#F5F4F2]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[#6B6863] dark:text-[#A39F9A]">{option.description}</div>
                      </SelectionCard>
                    ))}
                  </div>
                </section>

                <section className="grid gap-3.5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">关键词触发示例</label>
                    <input
                      value={keywordDraft}
                      onChange={(event) => setKeywordDraft(event.target.value)}
                      className={MODAL_INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">离线自动回复</label>
                    <input
                      value={offlineReply}
                      onChange={(event) => setOfflineReply(event.target.value)}
                      className={MODAL_INPUT_CLASS}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2F5D3E]/12 text-[#2F5D3E] dark:bg-[#3A6B4A]/24 dark:text-[#A8E2BA]">
                  <Info className="h-10 w-10" />
                </div>
                <h3 className="mt-6 text-[29px] font-semibold tracking-[-0.05em] text-[#1A1916] dark:text-[#F5F4F2]">
                  {platform.label}机器人已接入成功
                </h3>
                <p className="mt-4 max-w-[520px] text-[14px] leading-8 text-[#6B6863] dark:text-[#A39F9A]">
                  这个机器人现在会出现在 IM机器人视图区的已创建列表里。平台凭据已经完成真实预检，接下来你可以进入详情页继续绑定默认助手、会话策略和消息模板。
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-[#E8E6E3] bg-white px-3 py-1 text-[12px] text-[#6B6863] dark:border-[#2D2C2A] dark:bg-[#242320] dark:text-[#A39F9A]">
                    触发方式：{triggerModeOptions.find((item) => item.value === triggerMode)?.label}
                  </span>
                  <span className="rounded-full border border-[#E8E6E3] bg-white px-3 py-1 text-[12px] text-[#6B6863] dark:border-[#2D2C2A] dark:bg-[#242320] dark:text-[#A39F9A]">
                    回复格式：{replyFormatOptions.find((item) => item.value === replyFormat)?.label}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="min-h-0 space-y-5 overflow-y-auto">
            <ChecklistPanel title="本次接入你将完成" items={completionItems} variant="progress" />
            <ChecklistPanel title="平台提示" items={tipItems} variant="tips" />
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-[#E8E6E3] px-10 py-5 dark:border-[#2D2C2A]">
          <div className="text-[13px] text-[#9B9691] dark:text-[#6B6863]">
            {currentStep < 4 ? `步骤 ${currentStep} / 4` : '接入已准备完成'}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handlePrev}>
              {currentStep === 1 ? '取消' : '上一步'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              disabled={
                currentStep === 2 &&
                (!canAdvanceFromCredentials || !isRealPreflightSupported || !preflightResult?.ok)
              }
              className="rounded-lg px-6 py-2.5"
            >
              {primaryActionLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getReadonlyValue(platformId: IMPlatformId, fieldKey: string): string {
  if (fieldKey === 'callback_url') {
    return `https://api.iclaw.ai/webhooks/${platformId}`;
  }
  return '';
}
