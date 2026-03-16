import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';

export type IMPlatformId = 'feishu' | 'dingtalk' | 'wecom' | 'qq';
export type TriggerMode = 'mention' | 'all' | 'keyword';
export type ReplyFormat = 'text' | 'card' | 'markdown';

export interface IMPlatformMeta {
  id: IMPlatformId;
  label: string;
  logo: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,14,23,0.34)] px-6 py-6 backdrop-blur-[3px]">
      <div className="relative flex h-full max-h-[860px] w-full max-w-[1040px] flex-col overflow-hidden rounded-[32px] border border-[rgba(15,23,42,0.08)] bg-[var(--bg-page)] shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
        <div className="border-b border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,248,246,0.84))] px-8 py-6 dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.96),rgba(18,18,18,0.94))]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                <img src={platform.logo} alt={platform.label} className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  接入{platform.label}机器人
                </div>
                <p className="mt-2 max-w-[620px] text-[14px] leading-7 text-[var(--text-secondary)]">
                  按步骤完成 {platform.label} 应用配置，并将其连接到 OpenClaw。整个接入流程都在这个模态窗内完成，不离开当前页面。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] border border-transparent p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            {stepLabels.map((item, index) => (
              <div key={item.step} className="flex flex-1 items-center gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors',
                      item.step === currentStep
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                        : item.step < currentStep
                          ? 'border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.14)] text-[rgb(5,150,105)] dark:text-[#9af0c5]'
                          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-muted)]',
                    )}
                  >
                    {item.step < currentStep ? <Check className="h-4 w-4" /> : item.step}
                  </div>
                  <div
                    className={cn(
                      'mt-2 text-[12px]',
                      item.step === currentStep ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                    )}
                  >
                    {item.label}
                  </div>
                </div>
                {index < stepLabels.length - 1 ? (
                  <div
                    className={cn(
                      'h-px flex-1',
                      item.step < currentStep ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-default)]',
                    )}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0 overflow-y-auto px-8 py-8">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-[20px] font-semibold text-[var(--text-primary)]">先在{platform.label}开放平台创建应用</div>
                  <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                    当前平台建议按官方标准应用方式接入。你先完成开放平台侧的应用创建，再回到这里继续填写凭据。
                  </p>
                </div>
                <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">配置步骤</div>
                  <div className="mt-4 space-y-3">
                    {platform.introSteps.map((step, index) => (
                      <div key={step} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[12px] font-semibold text-[var(--text-primary)]">
                          {index + 1}
                        </div>
                        <div className="flex-1 text-[14px] leading-7 text-[var(--text-secondary)]">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.06)] p-5 dark:bg-[rgba(59,130,246,0.10)]">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-[var(--brand-primary)]" />
                    <div className="text-[14px] leading-7 text-[var(--text-secondary)]">
                      接入完成后，我们会把它作为一个独立的机器人实例管理。用户看到的是机器人名称，系统内部再映射到 OpenClaw 的账号配置。
                    </div>
                  </div>
                </div>
                <div>
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon={<ExternalLink className="h-4 w-4" />}
                    onClick={() => window.open(platform.guideUrl, '_blank', 'noopener,noreferrer')}
                  >
                    前往{platform.label}开放平台
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-[20px] font-semibold text-[var(--text-primary)]">填写平台凭据</div>
                  <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                    先录入平台侧的应用凭据和回调信息。界面只展示用户需要填写的核心字段，避免暴露过多技术配置项。
                  </p>
                </div>
                <div className="grid gap-4">
                  {platform.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[13px] font-medium text-[var(--text-primary)]">{field.label}</label>
                      <div className="flex items-center gap-3">
                        <input
                          value={credentials[field.key] || ''}
                          onChange={(event) => setCredentials((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          readOnly={field.readOnly}
                          placeholder={field.placeholder}
                          className="min-h-[48px] flex-1 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
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
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-[20px] font-semibold text-[var(--text-primary)]">测试连接</div>
                  <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                    系统会模拟一次标准连接检查，确认凭据、网关连接和回调链路是否准备完成。
                  </p>
                </div>
                <div className="flex min-h-[300px] items-center justify-center rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(247,247,244,0.90))] p-8 dark:bg-[linear-gradient(180deg,rgba(31,31,31,0.96),rgba(19,19,19,0.94))]">
                  {testStatus === 'testing' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <Loader2 className="h-12 w-12 animate-spin text-[var(--brand-primary)]" />
                      <div className="text-[18px] font-semibold text-[var(--text-primary)]">正在验证连接</div>
                      <p className="max-w-[360px] text-[14px] leading-7 text-[var(--text-secondary)]">
                        正在校验平台凭据、事件入口与 OpenClaw 连接状态，请稍候。
                      </p>
                    </div>
                  ) : null}
                  {testStatus === 'success' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(34,197,94,0.14)] text-[rgb(22,163,74)] dark:text-[#9af0c5]">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <div className="text-[18px] font-semibold text-[var(--text-primary)]">{platform.label}连接测试通过</div>
                      <p className="max-w-[380px] text-[14px] leading-7 text-[var(--text-secondary)]">
                        凭据校验、连接建立和回调链路均通过。可以继续设置机器人行为，并在完成后将其启用。
                      </p>
                    </div>
                  ) : null}
                  {testStatus === 'error' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(245,158,11,0.15)] text-[rgb(217,119,6)] dark:text-[#ffd49a]">
                        <AlertTriangle className="h-8 w-8" />
                      </div>
                      <div className="text-[18px] font-semibold text-[var(--text-primary)]">连接测试失败</div>
                      <p className="max-w-[360px] text-[14px] leading-7 text-[var(--text-secondary)]">
                        请检查平台凭据是否填写完整、回调地址是否能访问，以及当前企业应用权限是否已经开通。
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => setTestStatus('idle')}>
                        重新测试
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="space-y-8">
                <div>
                  <div className="text-[20px] font-semibold text-[var(--text-primary)]">配置机器人行为</div>
                  <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                    接入完成后，先给机器人设置一个轻量的默认行为。复杂权限和精细路由可以后续在详情页继续调整。
                  </p>
                </div>

                <div>
                  <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">触发方式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {triggerModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTriggerMode(option.value)}
                        className={cn(
                          'rounded-[22px] border p-4 text-left transition',
                          triggerMode === option.value
                            ? 'border-[var(--brand-primary)] bg-[rgba(59,130,246,0.08)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
                        )}
                      >
                        <div className="text-[15px] font-medium text-[var(--text-primary)]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">回复格式</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {replyFormatOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setReplyFormat(option.value)}
                        className={cn(
                          'rounded-[22px] border p-4 text-left transition',
                          replyFormat === option.value
                            ? 'border-[var(--brand-primary)] bg-[rgba(59,130,246,0.08)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
                        )}
                      >
                        <div className="text-[15px] font-medium text-[var(--text-primary)]">{option.label}</div>
                        <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[var(--text-primary)]">关键词触发示例</label>
                    <input
                      value={keywordDraft}
                      onChange={(event) => setKeywordDraft(event.target.value)}
                      className="min-h-[48px] w-full rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[var(--text-primary)]">离线自动回复</label>
                    <input
                      value={offlineReply}
                      onChange={(event) => setOfflineReply(event.target.value)}
                      className="min-h-[48px] w-full rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === 5 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(34,197,94,0.14)] text-[rgb(22,163,74)] dark:text-[#9af0c5]">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="mt-6 text-[28px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                  {platform.label}机器人已接入成功
                </div>
                <p className="mt-4 max-w-[520px] text-[14px] leading-8 text-[var(--text-secondary)]">
                  这个机器人现在会出现在 IM机器人视图区的已创建列表里。接下来你可以进入详情页继续做默认助手绑定、会话策略和日志查看。
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">
                    触发方式：{triggerModeOptions.find((item) => item.value === triggerMode)?.label}
                  </span>
                  <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">
                    回复格式：{replyFormatOptions.find((item) => item.value === replyFormat)?.label}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(247,247,244,0.92),rgba(244,244,241,0.98))] px-6 py-8 dark:bg-[linear-gradient(180deg,rgba(22,22,22,0.96),rgba(16,16,16,0.98))]">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">本次接入你将完成</div>
            <div className="mt-4 space-y-3">
              {[
                '创建并配置平台侧应用',
                '填写基础凭据与回调信息',
                '完成一次标准连接测试',
                '定义初始触发和回复策略',
                '启用一个新的 OpenClaw 机器人实例',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 text-[13px] leading-6 text-[var(--text-secondary)]">{item}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[22px] border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.06)] p-4 dark:bg-[rgba(59,130,246,0.10)]">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-5 w-5 text-[var(--brand-primary)]" />
                <div>
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">平台提示</div>
                  <div className="mt-2 space-y-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {platform.testHints.map((hint) => (
                      <div key={hint}>{hint}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-default)] bg-[var(--bg-card)] px-8 py-5">
          <div className="text-[13px] text-[var(--text-secondary)]">
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
              {currentStep === 5 ? '完成' : currentStep === 4 ? '保存并继续' : '下一步'}
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
