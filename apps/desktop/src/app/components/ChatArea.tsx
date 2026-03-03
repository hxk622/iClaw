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
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="px-6 py-2.5 text-center">
        <h1 className="mb-0 text-[13px] text-[#1f1f1f]">iClaw</h1>
        <p className="text-[11px] text-[#8f8f8f]">内容由 OpenClaw 返回，前端原样展示</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[800px] px-8 py-8">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4 text-[14px] text-[#666]">
              发送第一条消息开始对话。
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'mb-4 flex justify-end' : 'mb-6'}>
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[600px] rounded-2xl rounded-tr-md bg-[#f0f9ff] px-4 py-2.5'
                    : 'max-w-[760px] rounded-2xl bg-[#ffffff] px-1 py-1'
                }
              >
                <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[#1f1f1f]">{message.content || '...'}</p>
              </div>
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-2 text-[13px] text-[#8f8f8f]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在生成...
            </div>
          )}

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}
