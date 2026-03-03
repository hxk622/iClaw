import { useState } from 'react';

interface AuthPanelProps {
  loading: boolean;
  error: string | null;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { name: string; email: string; password: string }) => Promise<void>;
}

export function AuthPanel({ loading, error, onLogin, onRegister }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register') {
      if (!name.trim()) return;
      await onRegister({ name: name.trim(), email: email.trim(), password });
      return;
    }
    await onLogin({ email: email.trim(), password });
  };

  return (
    <div className="flex h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="text-[20px] font-semibold text-[#1f1f1f]">欢迎使用 iClaw</h1>
        <p className="mt-1 text-[13px] text-[#8f8f8f]">先登录后开始对话</p>

        <div className="mt-4 flex rounded-lg bg-[#f6f6f6] p-1">
          <button
            className={`flex-1 rounded-md px-3 py-2 text-[13px] ${
              mode === 'login' ? 'bg-white text-[#1f1f1f]' : 'text-[#777]'
            }`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-2 text-[13px] ${
              mode === 'register' ? 'bg-white text-[#1f1f1f]' : 'text-[#777]'
            }`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        {mode === 'register' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="昵称"
            className="mt-4 w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none focus:border-[#3b82f6]"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          className="mt-3 w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none focus:border-[#3b82f6]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          className="mt-3 w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none focus:border-[#3b82f6]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />

        {error && <p className="mt-3 rounded-md bg-red-50 px-2 py-1 text-[12px] text-red-600">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-[#3b82f6] px-3 py-2 text-[14px] text-white transition-colors hover:bg-[#2563eb] disabled:opacity-50"
        >
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
      </div>
    </div>
  );
}
