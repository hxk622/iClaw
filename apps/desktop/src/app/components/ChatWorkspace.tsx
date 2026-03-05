import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  FileText,
  LoaderCircle,
  PiggyBank,
  Receipt,
  Send,
  Target,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react';

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
}

const marketData = [
  { name: '上证', value: '3,287.48', change: '+0.85%', positive: true },
  { name: '深圳', value: '10,921.34', change: '+1.15%', positive: true },
  { name: '恒生', value: '2,068.17', change: '+4.45%', positive: true },
  { name: '纳指', value: '19,858.23', change: '-0.35%', positive: false },
  { name: '道', value: '2,634', change: '+0.21%', positive: true },
  { name: '美元/人民币', value: '7.1823', change: '-0.15%', positive: false },
] as const;

const quickActions = [
  { icon: TrendingUp, label: '行情分析' },
  { icon: Target, label: '个股研究' },
  { icon: Zap, label: '基金筛选' },
  { icon: FileText, label: '财报解读' },
  { icon: Wind, label: '风险评估' },
] as const;

const suggestions = [
  { icon: TrendingUp, label: '行情分析' },
  { icon: Target, label: '个股研究' },
  { icon: Zap, label: '基金筛选' },
  { icon: Receipt, label: '财报解读' },
  { icon: PiggyBank, label: '北向资金' },
  { icon: BarChart3, label: '板块轮动' },
  { icon: Wind, label: '投资组合' },
  { icon: Receipt, label: '期货商品' },
] as const;

export function ChatWorkspace({
  messages,
  streaming,
  error,
  disabled,
  onSend,
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
      <div className="flex h-10 items-center gap-6 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-xs">
        <div className="flex flex-1 items-center gap-6 overflow-x-auto">
          {marketData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[var(--text-secondary)]">{item.name}:</span>
              <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
              <span className={item.positive ? 'text-[var(--state-success)]' : 'text-[var(--state-error)]'}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-28">
            <div className="flex w-full max-w-3xl flex-col items-center text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] shadow-[var(--shadow-popover)]">
                <span className="text-5xl text-[var(--brand-on-primary)]">理</span>
              </div>

              <h1 className="mb-2 text-3xl text-[var(--text-primary)]">理财客</h1>
              <p className="mb-2 text-sm uppercase tracking-wider text-[var(--text-muted)]">LiCaiClaw - AI Investment Agent</p>
              <p className="mb-8 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                您好！我是您的 AI 理财助手，擅长投资分析、基金筛选、行情解读与组合管理。请选择服务或直接向我提问。
              </p>

              <div className="mb-6 flex flex-wrap justify-center gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => void submit(action.label)}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] transition-all duration-[var(--motion-micro)] hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] active:scale-[0.98]"
                    style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                  >
                    <action.icon className="h-4 w-4 text-[var(--text-secondary)]" />
                    {action.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {suggestions.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => void submit(item.label)}
                    className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <item.icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-[var(--brand-on-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    }`}
                  >
                    {message.role === 'user' ? '我' : '理'}
                  </div>

                  <div
                    className={`max-w-[72%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                        : 'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content || '...'}</p>
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
        )}
      </div>

      <div className="px-8 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="发消息或输入 / 选择技能"
                rows={1}
                className="max-h-48 min-h-[100px] w-full resize-none rounded-3xl border-2 border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--brand-primary)]"
                disabled={disabled || streaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
              />
            </div>

            <button
              onClick={() => void submit(input)}
              disabled={!input.trim() || disabled || streaming}
              className="flex h-[100px] w-[100px] flex-shrink-0 items-center justify-center rounded-3xl bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-[var(--shadow-popover)] transition-all duration-[var(--motion-micro)] hover:scale-[1.04] hover:bg-[var(--brand-primary-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ transitionTimingFunction: 'var(--motion-spring)' }}
            >
              <Send className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
