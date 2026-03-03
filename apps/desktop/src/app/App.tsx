import { useEffect, useMemo, useState } from 'react';
import { IClawClient } from '@iclaw/sdk';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { AuthPanel } from './components/AuthPanel';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';
import { Sidebar } from './components/Sidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:2026';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const client = useMemo(() => new IClawClient({ apiBaseUrl: API_BASE_URL }), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readAuth();
    if (!auth) return;
    setAccessToken(auth.accessToken);
    void client.me(auth.accessToken).catch(async () => {
      try {
        const refreshed = await client.refresh(auth.refreshToken);
        writeAuth({
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || auth.refreshToken,
        });
        setAccessToken(refreshed.access_token);
      } catch {
        clearAuth();
        setAccessToken(null);
      }
    });
  }, [client]);

  const handleLogin = async (input: { email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.login(input);
      writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (input: { name: string; email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.register(input);
      writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAccessToken(null);
    setMessages([]);
    setError(null);
  };

  const sendMessage = async (content: string) => {
    if (!accessToken) return;
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
          token: accessToken,
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

  if (!accessToken) {
    return (
      <AuthPanel
        loading={authLoading}
        error={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end border-b border-[#efefef] px-4 py-2">
          <button
            onClick={handleLogout}
            className="rounded-md border border-[#e5e5e5] px-3 py-1 text-[12px] text-[#666] hover:bg-[#fafafa]"
          >
            退出登录
          </button>
        </div>
        <ChatArea messages={messages} streaming={streaming} error={error} />
        <InputBar onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  );
}
