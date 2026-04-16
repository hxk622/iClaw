import { useEffect, useState } from 'react';
import { AlertCircle, Send, Sparkles } from 'lucide-react';

import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import type { ThoughtLibraryItem } from './model';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ThoughtLibraryChatShell({
  selectedItem,
  onOpenContextChat,
}: {
  selectedItem: ThoughtLibraryItem | null;
  onOpenContextChat?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'seed-default',
      role: 'assistant',
      content: '这里会围绕当前选中的素材、图谱或成果进行对话。你可以把第三栏理解为思维库的知识引擎。',
    },
  ]);

  useEffect(() => {
    if (!selectedItem) return;
    setMessages((current) => {
      const nextSeed: ChatMessage = {
        id: `seed-${selectedItem.id}`,
        role: 'assistant',
        content: `我已将「${selectedItem.title}」作为当前上下文。你可以让我总结、质疑、提炼、反驳，或者基于它继续生成成果。`,
      };
      return [nextSeed, ...current.filter((entry) => !entry.id.startsWith('seed-'))];
    });
  }, [selectedItem]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const contextTitle = selectedItem?.title || '当前对象';
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: 'user', content: trimmed },
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `已记录你的问题，并围绕「${contextTitle}」继续推理。后续接入真实聊天引擎后，这里会直接复用现有 chat 能力。`,
      },
    ]);
    setMessage('');
  };

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-panel)]/72">
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-3">
        <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--text-primary)]">
          <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
          <span>对话</span>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={webSearchEnabled}
            onChange={(event) => setWebSearchEnabled(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--border-primary)] accent-[var(--brand-primary)]"
          />
          <span>Web 搜索</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {webSearchEnabled ? (
          <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)] px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(245,158,11)]" />
            <div className="text-[12px] leading-6 text-[var(--text-secondary)]">
              外部搜索结果不会自动进入思维库，需你确认后才会进入素材层或图谱层。
            </div>
          </div>
        ) : null}

        {selectedItem ? (
          <div className="mb-4 rounded-[14px] border border-[rgba(180,154,112,0.28)] bg-[rgba(180,154,112,0.08)] px-3 py-2">
            <div className="text-[11px] text-[var(--text-muted)]">当前上下文</div>
            <div className="mt-1 inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(180,154,112,0.3)] bg-[var(--bg-panel)] px-3 py-1 text-[12px] text-[var(--text-primary)]">
              <span className="truncate">{selectedItem.title}</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {messages.map((entry) => (
            <div key={entry.id} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={cn(
                  'max-w-[88%] rounded-[16px] px-4 py-3 text-[13px] leading-6',
                  entry.role === 'user'
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                    : 'border border-[var(--border-primary)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
                )}
              >
                {entry.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border-primary)] px-4 py-4">
        {selectedItem ? (
          <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(180,154,112,0.28)] bg-[rgba(180,154,112,0.08)] px-3 py-1 text-[11px] text-[var(--text-primary)]">
            <span className="truncate">{selectedItem.title}</span>
          </div>
        ) : null}
        {selectedItem && onOpenContextChat ? (
          <button
            type="button"
            onClick={onOpenContextChat}
            className="mb-3 inline-flex h-9 items-center justify-center rounded-[12px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 text-[12px] text-[var(--text-primary)] transition hover:border-[rgba(180,154,112,0.28)] hover:bg-[rgba(180,154,112,0.08)]"
          >
            在主对话中打开
          </button>
        ) : null}
        <div className="relative">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={selectedItem ? `围绕「${selectedItem.title}」继续提问...` : '请选择对象后开始对话...'}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[108px] w-full resize-none rounded-[16px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-3 pr-12 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgba(180,154,112,0.14)]"
          />
          <button
            type="button"
            onClick={handleSend}
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--brand-on-primary)] transition hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {!selectedItem ? (
          <div className="mt-2">
            <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
              选择内容以建立对话上下文
            </Chip>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
