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
    <div className="bg-white py-4">
      <div className="mx-auto max-w-[1000px] px-8">
        <div className="relative rounded-2xl border-2 border-[#e5e5e5] bg-white shadow-sm transition-colors hover:border-[#d4d4d4] focus-within:border-[#3b82f6]">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="发消息..."
            className="min-h-[52px] w-full resize-none bg-transparent px-4 pt-4 pb-3 text-[15px] text-[#1f1f1f] outline-none placeholder:text-[#8f8f8f]"
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
              className="rounded-lg bg-[#3b82f6] p-2 transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!message.trim() || disabled}
            >
              <Send className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
