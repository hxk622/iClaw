import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
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
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export type IMPlatformId = 'feishu' | 'dingtalk' | 'wecom' | 'qq';
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
  }>;
  introSteps: string[];
  testHints: string[];
}

export interface IMBotDraft {
  platformId: IMPlatformId;
  triggerMode: TriggerMode;
  replyFormat: ReplyFormat;
}

interface IMBotSetupModalProps {
  platform: IMPlatformMeta | null;
  open: boolean;
  onClose: () => void;
  onComplete: (draft: IMBotDraft) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const stepLabels: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: '创建应用' },
  { step: 2, label: '填写凭据' },
  { step: 3, label: '测试连接' },
  { step: 4, label: '行为配置' },
  { step: 5, label: '完成接入' },
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
  '完成一次标准连接测试',
  '设置默认触发与回复策略',
  '启用一个新的 OpenClaw 机器人实例',
];

const SURFACE_CARD =
  'rounded-[22px] border border-[rgba(24,32,47,0.08)] bg-[rgba(255,255,255,0.92)] shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(27,27,27,0.92)] dark:shadow-[0_18px_36px_rgba(0,0,0,0.28)]';

const SECTION_LABEL =
  'text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(98,103,116,0.92)] dark:text-[rgba(165,170,184,0.82)]';

export function IMBotSetupModal({
  platform,
  open,
  onClose,
  onComplete,
}: IMBotSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('mention');
  const [replyFormat, setReplyFormat] = useState<ReplyFormat>('card');
  const [keywordDraft, setKeywordDraft] = useState('AI助手');
  const [offlineReply, setOfflineReply] = useState('我现在暂时离线，稍后会继续处理你的消息。');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');

  useEffect(() => {
    if (!open || !platform) return;
    setCurrentStep(1);
    setTriggerMode('mention');
    setReplyFormat(platform.id === 'dingtalk' || platform.id === 'qq' ? 'markdown' : 'card');
    setKeywordDraft('AI助手');
    setOfflineReply('我现在暂时离线，稍后会继续处理你的消息。');
    setTestStatus('idle');

    const nextCredentials: Record<string, string> = {};
    for (const field of platform.credentialFields) {
      nextCredentials[field.key] = field.readOnly
        ? getReadonlyValue(platform.id, field.key)
        : '';
    }
    setCredentials(nextCredentials);
  }, [open, platform]);

  useEffect(() => {
    if (currentStep !== 3 || testStatus !== 'idle') return;
    const timer = window.setTimeout(() => {
      setTestStatus('testing');
      window.setTimeout(() => {
        setTestStatus('success');
      }, 1100);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentStep, testStatus]);

  const canAdvanceFromCredentials = useMemo(() => {
    if (!platform) return false;
    return platform.credentialFields.every((field) => {
      if (field.readOnly) return true;
      return Boolean((credentials[field.key] || '').trim());
    });
  }, [credentials, platform]);

  if (!open || !platform) return null;

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
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3 && testStatus === 'success') {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 4) {
      setCurrentStep(5);
      return;
    }
    if (currentStep === 5) {
      onComplete({ platformId: platform.id, triggerMode, replyFormat });
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep === 1) {
      onClose();
      return;
    }
    if (currentStep === 3) {
      setTestStatus('idle');
    }
    setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.36)] px-5 py-5 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.48)]">
      <div className="relative flex h-full max-h-[860px] w-full max-w-[1008px] flex-col overflow-hidden rounded-[28px] border border-[rgba(24,32,47,0.08)] bg-[linear-gradient(180deg,#f9f8f6_0%,#f6f4ef_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,#1d1c1a_0%,#151412_100%)] dark:shadow-[0_36px_110px_rgba(0,0,0,0.42)]">
        <div className="border-b border-[rgba(26,25,22,0.08)] px-8 pb-6 pt-7 dark:border-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[rgba(24,32,47,0.08)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)]">
                <img
                  src={platform.logo}
                  alt={platform.label}
                  className={cn('h-full w-full object-cover', platform.logoClassName)}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-[24px] font-semibold tracking-[-0.045em] text-[#1a1916] dark:text-[#f5f4f2]">
                  接入{platform.label}机器人
                </h2>
                <p className="mt-1.5 max-w-[620px] text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">
                  按步骤完成应用配置，并将其连接到 OpenClaw。完成后，这个机器人会作为独立实例出现在 IM机器人视图区中。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                'rounded-[14px] border border-transparent p-2 text-[#6b6863] hover:border-[rgba(24,32,47,0.08)] hover:bg-[rgba(255,255,255,0.76)] hover:text-[#1a1916] dark:text-[#a39f9a] dark:hover:border-[rgba(255,255,255,0.08)] dark:hover:bg-[rgba(255,255,255,0.05)] dark:hover:text-[#f5f4f2]',
                APPLE_FLAT_SURFACE,
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
              )}
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            {stepLabels.map((item, index) => {
              const status =
                item.step < currentStep ? 'completed' : item.step === currentStep ? 'current' : 'upcoming';

              return (
                <div key={item.step} className="flex flex-1 items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors',
                        status === 'completed' &&
                          'border-[#2f5d3e] bg-[#2f5d3e] text-white dark:border-[#3d6f4d] dark:bg-[#3d6f4d]',
                        status === 'current' &&
                          'border-[#c9b896] bg-[#c9b896] text-[#1a1916] shadow-[0_10px_22px_rgba(201,184,150,0.22)] dark:border-[#9d8b6f] dark:bg-[#9d8b6f] dark:text-[#f5f4f2] dark:shadow-[0_10px_22px_rgba(157,139,111,0.26)]',
                        status === 'upcoming' &&
                          'border-[rgba(26,25,22,0.10)] bg-[rgba(255,255,255,0.72)] text-[#9b9691] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[#6b6863]',
                      )}
                    >
                      {status === 'completed' ? <Check className="h-4 w-4" /> : item.step}
                    </div>
                    <span
                      className={cn(
                        'whitespace-nowrap text-[13px] transition-colors',
                        status === 'current' &&
                          'font-medium text-[#1a1916] dark:text-[#f5f4f2]',
                        status === 'completed' &&
                          'text-[#6b6863] dark:text-[#a39f9a]',
                        status === 'upcoming' &&
                          'text-[#9b9691] dark:text-[#6b6863]',
                      )}
                    >
                      {item.label}
                    </span>
                  </div>

                  {index < stepLabels.length - 1 ? (
                    <div
                      className={cn(
                        'h-px flex-1',
                        item.step < currentStep
                          ? 'bg-[#d8ceb7] dark:bg-[#7f725d]'
                          : 'bg-[rgba(26,25,22,0.08)] dark:bg-[rgba(255,255,255,0.08)]',
                      )}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_278px] gap-8 px-8 py-8">
          <div className="min-h-0 overflow-y-auto pr-1">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[#1a1916] dark:text-[#f5f4f2]">
                    先在{platform.label}开放平台创建应用
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">
                    这一步需要在{platform.label}官方后台完成，iClaw 不替代第三方应用创建。你完成后再回到这里继续下一步。
                  </p>
                </div>

                <section className={cn(SURFACE_CARD, 'p-5')}>
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
                        <p className="text-[13px] leading-6 text-[#3d3a36] dark:text-[#d4d2ce]">{step}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[22px] border border-[rgba(201,184,150,0.28)] bg-[rgba(201,184,150,0.12)] p-5 dark:border-[rgba(157,139,111,0.26)] dark:bg-[rgba(157,139,111,0.12)]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.48)] text-[#8b7552] dark:bg-[rgba(255,255,255,0.06)] dark:text-[#c9b896]">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <p className="text-[13px] leading-6 text-[#3d3a36] dark:text-[#d4d2ce]">
                      接入完成后，系统会把它作为独立机器人实例管理。后续你可以在详情页继续做默认助手配置、会话绑定和日志审计。
                    </p>
                  </div>
                </section>

                <div>
                  <button
                    type="button"
                    onClick={() => window.open(platform.guideUrl, '_blank', 'noopener,noreferrer')}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-[14px] border border-[rgba(24,32,47,0.08)] bg-[rgba(255,255,255,0.92)] px-4 py-2.5 text-[13px] font-medium text-[#3d3a36] hover:border-[rgba(201,184,150,0.30)] hover:bg-[rgba(255,255,255,1)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[#d4d2ce] dark:hover:border-[rgba(201,184,150,0.20)] dark:hover:bg-[rgba(255,255,255,0.06)]',
                      APPLE_FLAT_SURFACE,
                      SPRING_PRESSABLE,
                      INTERACTIVE_FOCUS_RING,
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>打开{platform.label}开放平台</span>
                  </button>
                  <p className="mt-2 text-[12px] text-[#9b9691] dark:text-[#6b6863]">
                    会在浏览器打开官方后台。建议完成创建后再回到这里继续。
                  </p>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[#1a1916] dark:text-[#f5f4f2]">
                    填写平台凭据
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">
                    只保留用户真正需要填写的核心字段。像回调地址这类由系统生成的项目，会自动带出并支持复制。
                  </p>
                </div>

                <section className={cn(SURFACE_CARD, 'space-y-5 p-5')}>
                  {platform.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          value={credentials[field.key] || ''}
                          onChange={(event) => setCredentials((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          readOnly={field.readOnly}
                          placeholder={field.placeholder}
                          className={cn(
                            'min-h-[48px] flex-1 rounded-[16px] border border-[rgba(26,25,22,0.10)] bg-[rgba(255,255,255,0.94)] px-4 text-[14px] text-[#1a1916] outline-none transition placeholder:text-[#a8a39d] focus:border-[#c9b896] focus:ring-2 focus:ring-[rgba(201,184,150,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[#f5f4f2] dark:placeholder:text-[#726c66] dark:focus:border-[#9d8b6f] dark:focus:ring-[rgba(157,139,111,0.20)]',
                            field.readOnly && 'bg-[#f6f3ed] dark:bg-[rgba(255,255,255,0.03)]',
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
                      {field.readOnly ? (
                        <p className="text-[12px] leading-5 text-[#9b9691] dark:text-[#6b6863]">
                          这个地址由系统生成，用来接收平台事件回调。
                        </p>
                      ) : null}
                    </div>
                  ))}
                </section>

                <section className="rounded-[20px] border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.06)] p-4 dark:bg-[rgba(59,130,246,0.10)]">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    <p className="text-[13px] leading-6 text-[#516075] dark:text-[#b7c7dd]">
                      凭据仅用于建立连接与签名校验。产品化视图不展示底层技术细节，避免用户在首次接入时被过多概念打断。
                    </p>
                  </div>
                </section>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[#1a1916] dark:text-[#f5f4f2]">
                    测试连接
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">
                    系统会模拟一次标准连接检查，确认平台凭据、事件入口和 OpenClaw 接收链路都已经准备完成。
                  </p>
                </div>

                <section className="flex min-h-[368px] items-center justify-center rounded-[24px] border border-[rgba(24,32,47,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(245,243,238,0.96))] p-8 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(30,29,27,0.98),rgba(20,19,17,0.98))] dark:shadow-[0_18px_36px_rgba(0,0,0,0.28)]">
                  {testStatus === 'testing' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <Loader2 className="h-12 w-12 animate-spin text-[#8f7b5d] dark:text-[#c9b896]" />
                      <div className="text-[18px] font-semibold text-[#1a1916] dark:text-[#f5f4f2]">正在验证连接</div>
                      <p className="max-w-[360px] text-[14px] leading-7 text-[#6b6863] dark:text-[#a39f9a]">
                        正在校验平台凭据、消息入口与回调链路，请稍候。
                      </p>
                    </div>
                  ) : null}

                  {testStatus === 'success' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(47,93,62,0.12)] text-[#2f5d3e] dark:bg-[rgba(61,111,77,0.22)] dark:text-[#a8e2ba]">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <div className="text-[18px] font-semibold text-[#1a1916] dark:text-[#f5f4f2]">
                        {platform.label}连接测试通过
                      </div>
                      <p className="max-w-[390px] text-[14px] leading-7 text-[#6b6863] dark:text-[#a39f9a]">
                        凭据校验、连接建立和回调链路均已通过。可以继续设置机器人的默认行为，并在完成后启用它。
                      </p>
                    </div>
                  ) : null}

                  {testStatus === 'error' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(245,158,11,0.12)] text-[rgb(180,83,9)] dark:bg-[rgba(245,158,11,0.18)] dark:text-[#ffd49a]">
                        <AlertTriangle className="h-8 w-8" />
                      </div>
                      <div className="text-[18px] font-semibold text-[#1a1916] dark:text-[#f5f4f2]">连接测试失败</div>
                      <p className="max-w-[360px] text-[14px] leading-7 text-[#6b6863] dark:text-[#a39f9a]">
                        请检查平台凭据是否填写完整、回调地址是否可访问，以及当前企业应用权限是否已开通。
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => setTestStatus('idle')}>
                        重新测试
                      </Button>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="space-y-7">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[#1a1916] dark:text-[#f5f4f2]">
                    配置机器人行为
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">
                    先给机器人一个轻量、可上线的默认配置。复杂路由和高级权限可以在详情页里继续补充。
                  </p>
                </div>

                <section className="space-y-3">
                  <div className={SECTION_LABEL}>触发方式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {triggerModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTriggerMode(option.value)}
                        className={cn(
                          'rounded-[22px] border p-4 text-left',
                          SPRING_PRESSABLE,
                          INTERACTIVE_FOCUS_RING,
                          triggerMode === option.value
                            ? 'border-[#c9b896] bg-[rgba(201,184,150,0.12)] shadow-[0_12px_28px_rgba(201,184,150,0.16)] dark:border-[#9d8b6f] dark:bg-[rgba(157,139,111,0.14)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.24)]'
                            : 'border-[rgba(24,32,47,0.08)] bg-[rgba(255,255,255,0.92)] hover:border-[rgba(201,184,150,0.32)] hover:bg-[rgba(255,255,255,1)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(27,27,27,0.92)] dark:hover:border-[rgba(201,184,150,0.20)] dark:hover:bg-[rgba(255,255,255,0.05)]',
                        )}
                      >
                        <div className="text-[15px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className={SECTION_LABEL}>回复格式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {replyFormatOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setReplyFormat(option.value)}
                        className={cn(
                          'rounded-[22px] border p-4 text-left',
                          SPRING_PRESSABLE,
                          INTERACTIVE_FOCUS_RING,
                          replyFormat === option.value
                            ? 'border-[#c9b896] bg-[rgba(201,184,150,0.12)] shadow-[0_12px_28px_rgba(201,184,150,0.16)] dark:border-[#9d8b6f] dark:bg-[rgba(157,139,111,0.14)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.24)]'
                            : 'border-[rgba(24,32,47,0.08)] bg-[rgba(255,255,255,0.92)] hover:border-[rgba(201,184,150,0.32)] hover:bg-[rgba(255,255,255,1)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(27,27,27,0.92)] dark:hover:border-[rgba(201,184,150,0.20)] dark:hover:bg-[rgba(255,255,255,0.05)]',
                        )}
                      >
                        <div className="text-[15px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[#6b6863] dark:text-[#a39f9a]">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">关键词触发示例</label>
                    <input
                      value={keywordDraft}
                      onChange={(event) => setKeywordDraft(event.target.value)}
                      className="min-h-[48px] w-full rounded-[16px] border border-[rgba(26,25,22,0.10)] bg-[rgba(255,255,255,0.94)] px-4 text-[14px] text-[#1a1916] outline-none transition focus:border-[#c9b896] focus:ring-2 focus:ring-[rgba(201,184,150,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[#f5f4f2] dark:focus:border-[#9d8b6f] dark:focus:ring-[rgba(157,139,111,0.20)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">离线自动回复</label>
                    <input
                      value={offlineReply}
                      onChange={(event) => setOfflineReply(event.target.value)}
                      className="min-h-[48px] w-full rounded-[16px] border border-[rgba(26,25,22,0.10)] bg-[rgba(255,255,255,0.94)] px-4 text-[14px] text-[#1a1916] outline-none transition focus:border-[#c9b896] focus:ring-2 focus:ring-[rgba(201,184,150,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[#f5f4f2] dark:focus:border-[#9d8b6f] dark:focus:ring-[rgba(157,139,111,0.20)]"
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {currentStep === 5 ? (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(47,93,62,0.12)] text-[#2f5d3e] dark:bg-[rgba(61,111,77,0.22)] dark:text-[#a8e2ba]">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="mt-6 text-[29px] font-semibold tracking-[-0.05em] text-[#1a1916] dark:text-[#f5f4f2]">
                  {platform.label}机器人已接入成功
                </h3>
                <p className="mt-4 max-w-[520px] text-[14px] leading-8 text-[#6b6863] dark:text-[#a39f9a]">
                  这个机器人现在会出现在 IM机器人视图区的已创建列表里。接下来你可以进入详情页继续绑定默认助手、会话策略和消息模板。
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full bg-[rgba(255,255,255,0.78)] px-3 py-1 text-[12px] text-[#6b6863] shadow-[0_6px_16px_rgba(15,23,42,0.06)] dark:bg-[rgba(255,255,255,0.06)] dark:text-[#a39f9a]">
                    触发方式：{triggerModeOptions.find((item) => item.value === triggerMode)?.label}
                  </span>
                  <span className="rounded-full bg-[rgba(255,255,255,0.78)] px-3 py-1 text-[12px] text-[#6b6863] shadow-[0_6px_16px_rgba(15,23,42,0.06)] dark:bg-[rgba(255,255,255,0.06)] dark:text-[#a39f9a]">
                    回复格式：{replyFormatOptions.find((item) => item.value === replyFormat)?.label}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="min-h-0 overflow-y-auto space-y-6 border-l border-[rgba(26,25,22,0.08)] pl-8 dark:border-[rgba(255,255,255,0.08)]">
            <section>
              <h4 className="text-[13px] text-[#6b6863] dark:text-[#a39f9a]">本次接入你将完成</h4>
              <div className="mt-4 space-y-2.5">
                {completionChecklist.map((item, index) => {
                  const completed = index < currentStep - 1;
                  return (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-[16px] border border-[rgba(24,32,47,0.08)] bg-[rgba(255,255,255,0.92)] px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(27,27,27,0.92)] dark:shadow-[0_12px_24px_rgba(0,0,0,0.24)]"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                          completed
                            ? 'bg-[#2f5d3e] text-white dark:bg-[#3d6f4d]'
                            : 'bg-[#e8e6e3] text-transparent dark:bg-[rgba(255,255,255,0.08)]',
                        )}
                      >
                        {completed ? <Check className="h-2.5 w-2.5" /> : null}
                      </div>
                      <span
                        className={cn(
                          'text-[12px] leading-6',
                          completed
                            ? 'text-[#8c8781] line-through dark:text-[#726c66]'
                            : 'text-[#3d3a36] dark:text-[#d4d2ce]',
                        )}
                      >
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h4 className="text-[13px] text-[#6b6863] dark:text-[#a39f9a]">平台提示</h4>
              <div className="mt-3 space-y-2.5">
                {platform.testHints.map((hint) => (
                  <div
                    key={hint}
                    className="rounded-[16px] border border-[rgba(24,32,47,0.08)] bg-[rgba(243,240,234,0.72)] p-3.5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="flex items-start gap-2.5">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[#9d8b6f] dark:text-[#c9b896]" />
                      <p className="text-[12px] leading-6 text-[#3d3a36] dark:text-[#d4d2ce]">{hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[18px] border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.06)] p-4 dark:bg-[rgba(59,130,246,0.10)]">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                <div>
                  <div className="text-[13px] font-medium text-[#1a1916] dark:text-[#f5f4f2]">产品化体验说明</div>
                  <p className="mt-1.5 text-[12px] leading-6 text-[#516075] dark:text-[#b7c7dd]">
                    我们把技术接入流程压缩成五步，用户只需要关心创建、填写、测试和启用，不需要直接理解底层网关细节。
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(26,25,22,0.08)] px-8 py-5 dark:border-[rgba(255,255,255,0.08)]">
          <div className="text-[13px] text-[#9b9691] dark:text-[#6b6863]">
            {currentStep < 5 ? `步骤 ${currentStep} / 5` : '接入已准备完成'}
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
                (currentStep === 2 && !canAdvanceFromCredentials) ||
                (currentStep === 3 && testStatus !== 'success')
              }
            >
              {currentStep === 5 ? '完成' : currentStep === 4 ? '保存并继续' : currentStep === 1 ? '我已完成创建' : '下一步'}
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
