import { useMemo, useState } from 'react';
import { IClawClient } from '@iclaw/sdk';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';
import { Sidebar } from './components/Sidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:2026';
const DEV_TOKEN = (import.meta.env.VITE_DEV_TOKEN as string) || '';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const client = useMemo(() => new IClawClient({ apiBaseUrl: API_BASE_URL }), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || streaming) return;

    const userMessage: Message = { id: createId('user'), role: 'user', content: text };
    const assistantId = createId('assistant');
    setError(null);
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      await client.streamChat(
        {
          message: text,
          token: DEV_TOKEN,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg)),
            );
          },
          onError: (e) => {
            setError(`${e.code}: ${e.message}`);
          },
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : '请求失败';
      setError(message);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ChatArea messages={messages} streaming={streaming} error={error} />
        <InputBar onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  );
}
