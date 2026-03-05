import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Send, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { HealthStatusBar } from './HealthStatusBar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWorkspaceProps {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
  healthChecking: boolean;
  healthy: boolean;
  sidecarAttempted: boolean;
  healthError: string | null;
}

const quickPrompts = [
  '帮我规划一份月度资产配置方案',
  '解释一下基金定投的止盈策略',
  '根据我的风险偏好做一个组合建议',
];

export function ChatWorkspace({
  messages,
  streaming,
  error,
  disabled,
  onSend,
  healthChecking,
  healthy,
  sidecarAttempted,
  healthError,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, streaming]);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || disabled || streaming) return;
    setInput('');
    await onSend(text);
  };

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-page)]">
      <HealthStatusBar
        checking={healthChecking}
        healthy={healthy}
        sidecarAttempted={sidecarAttempted}
        error={healthError}
      />

      <div className="border-b border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-[var(--text-primary)]">理财工作台</h2>
            <p className="text-[12px] text-[var(--text-muted)]">专注分析、规划与执行建议</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">沪深300 +0.82%</div>
            <div className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">恒生指数 -0.34%</div>
          </div>
        </div>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[980px] flex-col gap-6 px-8 py-8">
          {messages.length === 0 && (
            <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">
                <Sparkles className="h-4 w-4" />
                iClaw-理财客
              </div>
              <h1 className="text-[30px] leading-[1.35] text-[var(--text-primary)]">今天想优化哪一块理财决策？</h1>
              <p className="mt-2 max-w-[720px] text-[14px] text-[var(--text-secondary)]">
                我可以帮你做资产配置、定投计划、风险评估与复盘建议。直接提问，或点一个模板开始。
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <button
                  onClick={() => void submit(quickPrompts[0]!)}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-left text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-card)]">
                    <Wallet className="h-4 w-4 text-[var(--state-info)]" />
                  </div>
                  {quickPrompts[0]}
                </button>
                <button
                  onClick={() => void submit(quickPrompts[1]!)}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-left text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-card)]">
                    <TrendingUp className="h-4 w-4 text-[var(--state-success)]" />
                  </div>
                  {quickPrompts[1]}
                </button>
                <button
                  onClick={() => void submit(quickPrompts[2]!)}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-left text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-card)]">
                    <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                  </div>
                  {quickPrompts[2]}
                </button>
              </div>
            </section>
          )}

          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[700px] rounded-2xl rounded-tr-md bg-[var(--brand-primary)] px-4 py-3 text-[var(--brand-on-primary)]'
                    : 'max-w-[780px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-primary)]'
                }
              >
                <p className="whitespace-pre-wrap text-[15px] leading-[1.75]">{message.content || '...'}</p>
              </div>
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在生成...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[var(--state-error)]/40 bg-[var(--state-error)]/10 px-3 py-2 text-[13px] text-[var(--state-error)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border-default)] bg-[var(--bg-page)] px-8 py-6">
        <div className="mx-auto max-w-[980px]">
          <div className="rounded-3xl border-2 border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-colors duration-[var(--motion-micro)] focus-within:border-[var(--brand-primary)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题，例如：我每月可投资 5000，如何分配股票、基金和现金？"
              className="min-h-[110px] w-full resize-none bg-transparent px-6 pt-5 pb-3 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              disabled={disabled || streaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit(input);
                }
              }}
            />
            <div className="flex items-center justify-between px-4 pb-4">
              <span className="text-[12px] text-[var(--text-muted)]">Enter 发送，Shift+Enter 换行</span>
              <button
                onClick={() => void submit(input)}
                disabled={!input.trim() || disabled || streaming}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-[var(--brand-on-primary)] transition-all duration-[var(--motion-micro)] hover:scale-[1.04] hover:bg-[var(--brand-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ transitionTimingFunction: 'var(--motion-spring)' }}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
