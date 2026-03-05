import { LoaderCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  error: string | null;
}

export function ChatArea({ messages, streaming, error }: ChatAreaProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-page)]">
      <div className="border-b border-[var(--border-default)] px-6 py-2.5 text-center">
        <h1 className="mb-0 text-[13px] font-medium text-[var(--text-primary)]">iClaw-理财客</h1>
        <p className="text-[11px] text-[var(--text-muted)]">内容由 OpenClaw 返回，前端原样展示</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-8 py-8">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-[14px] text-[var(--text-secondary)]">
              发送第一条消息开始对话。
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'mb-4 flex justify-end' : 'mb-6'}>
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[620px] rounded-2xl rounded-tr-md bg-[var(--brand-primary)] px-4 py-2.5 text-[var(--brand-on-primary)]'
                    : 'max-w-[780px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3'
                }
              >
                <p
                  className={`whitespace-pre-wrap text-[15px] leading-[1.7] ${
                    message.role === 'user' ? 'text-[var(--brand-on-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {message.content || '...'}
                </p>
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
            <div className="mt-4 rounded-lg border border-[var(--state-error)]/40 bg-[var(--state-error)]/10 px-3 py-2 text-[13px] text-[var(--state-error)]">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
