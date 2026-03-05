import { Send } from 'lucide-react';
import { useState } from 'react';

interface InputBarProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled = false }: InputBarProps) {
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    const text = message.trim();
    if (!text || disabled) return;
    setMessage('');
    await onSend(text);
  };

  return (
    <div className="bg-[var(--bg-page)] py-4">
      <div className="mx-auto max-w-[1000px] px-8">
        <div className="relative rounded-3xl border-2 border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-colors duration-[var(--motion-micro)] hover:border-[var(--border-strong)] focus-within:border-[var(--brand-primary)]">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="发消息..."
            className="min-h-[56px] w-full resize-none bg-transparent px-5 pt-4 pb-3 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            rows={1}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <div className="flex items-center justify-end gap-2 px-3 pb-3 pt-1">
            <button
              onClick={() => void handleSend()}
              className="rounded-xl bg-[var(--brand-primary)] p-2.5 transition-all duration-[var(--motion-micro)] hover:scale-[1.03] hover:bg-[var(--brand-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ transitionTimingFunction: 'var(--motion-spring)' }}
              disabled={!message.trim() || disabled}
            >
              <Send className="h-5 w-5 text-[var(--brand-on-primary)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
