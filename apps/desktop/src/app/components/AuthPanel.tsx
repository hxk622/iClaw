import {useEffect, useMemo, useState} from 'react';
import {Eye, EyeOff, Loader2, X} from 'lucide-react';

interface AuthPanelProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  socialLoadingProvider?: 'wechat' | 'google' | null;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onLogin: (input: {identifier: string; password: string}) => Promise<void>;
  onRegister: (input: {username: string; name: string; email: string; password: string}) => Promise<void>;
  onSocialLogin: (provider: 'wechat' | 'google') => Promise<void>;
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32);
}

function getPasswordStrength(password: string): {label: string; tone: string; score: number} {
  const value = password.trim();
  if (!value) {
    return {label: '请输入密码', tone: 'text-[#8e8069]', score: 0};
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) {
    return {label: '密码强度较弱', tone: 'text-[#c96b4a]', score: 1};
  }
  if (score <= 3) {
    return {label: '密码强度中等', tone: 'text-[#b28839]', score: 2};
  }
  return {label: '密码强度较强', tone: 'text-[#3f8a53]', score: 3};
}

function WechatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#07C160"
        d="M8.37 4.4C4.31 4.4 1 7.16 1 10.54c0 1.95 1.08 3.68 2.76 4.82l-.7 2.43 2.63-1.3c.88.2 1.79.3 2.68.3 4.06 0 7.37-2.76 7.37-6.15S12.43 4.4 8.37 4.4Zm-2.46 5.08a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.92 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
      />
      <path
        fill="#07C160"
        d="M16.88 9.38c-3.39 0-6.12 2.28-6.12 5.1 0 1.52.8 2.89 2.07 3.82l-.56 1.96 2.1-1.04c.81.18 1.49.22 2.51.22 3.38 0 6.12-2.28 6.12-5.1s-2.74-4.96-6.12-4.96Zm-2.04 4.23a.67.67 0 1 1 0-1.34.67.67 0 0 1 0 1.34Zm4.07 0a.67.67 0 1 1 0-1.34.67.67 0 0 1 0 1.34Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12.23 10.21v3.95h5.49c-.24 1.27-.97 2.35-2.05 3.07l3.31 2.57c1.93-1.78 3.04-4.39 3.04-7.48 0-.72-.07-1.42-.2-2.11h-9.59Z"
      />
      <path
        fill="#34A853"
        d="M6.52 14.28 5.77 14l-2.67 2.08A9.97 9.97 0 0 0 12 22c2.74 0 5.04-.9 6.72-2.45l-3.31-2.57c-.91.61-2.08.97-3.41.97-2.64 0-4.88-1.78-5.68-4.17Z"
      />
      <path
        fill="#4A90E2"
        d="M3.1 7.92A10 10 0 0 0 3.1 16.08l3.42-2.63a5.95 5.95 0 0 1 0-2.89L3.1 7.92Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.05c1.45 0 2.74.5 3.76 1.49l2.82-2.82C17.03 3.28 14.73 2 12 2a9.97 9.97 0 0 0-8.9 5.92l3.42 2.64C7.32 7.83 9.36 6.05 12 6.05Z"
      />
    </svg>
  );
}

function SocialDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[#a3957f]">
      <div className="h-px flex-1 bg-[#e7ddcd]" />
      <span>或使用第三方登录</span>
      <div className="h-px flex-1 bg-[#e7ddcd]" />
    </div>
  );
}

function FieldLabel({children}: {children: React.ReactNode}) {
  return <span className="text-[12px] font-medium text-[#756a57]">{children}</span>;
}

function InputShell({children}: {children: React.ReactNode}) {
  return <div className="mt-1">{children}</div>;
}

const inputClassName =
  'h-11 w-full rounded-xl border border-[#ddd4c4] bg-white px-3.5 text-[14px] text-[#171614] outline-none transition placeholder:text-[#beb4a3] focus:border-[#b69763] focus:ring-2 focus:ring-[#ead6b0]/60';

export function AuthPanel({
  open,
  loading,
  error,
  socialLoadingProvider = null,
  initialMode = 'login',
  onClose,
  onLogin,
  onRegister,
  onSocialLogin,
}: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const effectiveError = error || localError;

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setLocalError(null);
  }, [initialMode, open]);
  const canSubmit = useMemo(() => {
    if (!password.trim()) return false;
    if (mode === 'login') {
      return Boolean(identifier.trim());
    }
    return Boolean(normalizedUsername && email.trim() && confirmPassword.trim() && agreedToTerms);
  }, [agreedToTerms, confirmPassword, email, identifier, mode, normalizedUsername, password]);

  const submit = async () => {
    setLocalError(null);
    if (!password.trim()) return;

    if (mode === 'register') {
      if (!normalizedUsername || !email.trim()) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setLocalError('请输入有效的邮箱地址');
        return;
      }
      if (normalizedUsername.length < 3) {
        setLocalError('用户名至少需要 3 个字符');
        return;
      }
      if (password.length < 8) {
        setLocalError('密码至少需要 8 个字符');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致');
        return;
      }
      if (!agreedToTerms) {
        setLocalError('请先同意服务协议和隐私说明');
        return;
      }

      await onRegister({
        username: normalizedUsername,
        name: normalizedUsername,
        email: email.trim(),
        password,
      });
      return;
    }

    if (!identifier.trim()) return;
    await onLogin({identifier: identifier.trim(), password});
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,16,0.24)] px-4 py-8 backdrop-blur-[2px] transition-opacity ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[30px] border border-[#ddd3c1] bg-[#f8f4ec]/98 p-5 shadow-[0_28px_90px_rgba(42,31,10,0.22)] backdrop-blur md:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#d7ccb9] bg-white">
              <img src="/favicon.png" alt="iClaw logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#ab8d57]">iClaw</div>
              <div className="text-[13px] text-[#706554]">登录以继续使用账户与额度体系</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭登录弹窗"
            className="rounded-full p-2 text-[#8d7d61] transition hover:bg-[#efe7d8] hover:text-[#3b3328]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 flex rounded-2xl bg-[#ece5d8] p-1">
          <button
            type="button"
            className={`flex-1 rounded-[14px] px-4 py-2.5 text-[13px] font-medium transition ${
              mode === 'login' ? 'bg-[#171614] text-white shadow-sm' : 'text-[#6f6555]'
            }`}
            onClick={() => {
              setMode('login');
              setLocalError(null);
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[14px] px-4 py-2.5 text-[13px] font-medium transition ${
              mode === 'register' ? 'bg-[#171614] text-white shadow-sm' : 'text-[#6f6555]'
            }`}
            onClick={() => {
              setMode('register');
              setLocalError(null);
            }}
          >
            注册
          </button>
        </div>

        <div className="space-y-3.5">
          {mode === 'register' && (
            <>
              <label className="block">
                <FieldLabel>用户名</FieldLabel>
                <InputShell>
                  <input
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder=""
                    className={inputClassName}
                  />
                </InputShell>
              </label>
            </>
          )}

          <label className="block">
            <FieldLabel>{mode === 'login' ? '用户名或邮箱' : '邮箱地址'}</FieldLabel>
            <InputShell>
              <input
                value={mode === 'login' ? identifier : email}
                onChange={(e) => {
                  setLocalError(null);
                  if (mode === 'login') {
                    setIdentifier(e.target.value);
                  } else {
                    setEmail(e.target.value);
                  }
                }}
                placeholder={mode === 'login' ? '用户名或邮箱' : 'you@example.com'}
                className={inputClassName}
              />
            </InputShell>
          </label>

          <label className="block">
            <FieldLabel>密码</FieldLabel>
            <InputShell>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder={mode === 'login' ? '输入密码' : '至少 8 位'}
                  className={`${inputClassName} pr-11`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8d7d61] transition hover:bg-[#f4ecdf]"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </InputShell>
            {mode === 'register' ? (
              <div className="mt-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`h-1.5 flex-1 rounded-full ${
                        index < passwordStrength.score ? 'bg-[#b69763]' : 'bg-[#e6dccd]'
                      }`}
                    />
                  ))}
                </div>
                <div className={`mt-1 text-[12px] ${passwordStrength.tone}`}>{passwordStrength.label}</div>
              </div>
            ) : null}
          </label>

          {mode === 'register' && (
            <>
              <label className="block">
                <FieldLabel>确认密码</FieldLabel>
                <InputShell>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="再次输入密码"
                    className={inputClassName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submit();
                    }}
                  />
                </InputShell>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-[#e5dccd] bg-[#f4eee3] px-4 py-3 text-[12px] leading-6 text-[#665d50]">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    setLocalError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-[#b8a17a] text-[#171614]"
                />
                <span>我已阅读并同意 iClaw 的服务协议、隐私说明，以及账号 credit 相关计费规则。</span>
              </label>
            </>
          )}
        </div>

        {effectiveError ? (
          <p className="mt-4 rounded-2xl border border-[#efc2c2] bg-[#fff1f1] px-4 py-3 text-[13px] text-[#b23d3d]">
            {effectiveError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !canSubmit}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#171614] px-4 text-[14px] font-medium text-white transition hover:bg-[#24211d] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>

        <SocialDivider />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading || socialLoadingProvider !== null}
            onClick={() => void onSocialLogin('wechat')}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#ddd4c4] bg-white text-[14px] font-medium text-[#171614] transition hover:border-[#b89a68] hover:bg-[#fcfaf6] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {socialLoadingProvider === 'wechat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <WechatIcon />}
            <span>微信</span>
          </button>
          <button
            type="button"
            disabled={loading || socialLoadingProvider !== null}
            onClick={() => void onSocialLogin('google')}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#ddd4c4] bg-white text-[14px] font-medium text-[#171614] transition hover:border-[#b89a68] hover:bg-[#fcfaf6] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {socialLoadingProvider === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            <span>Google</span>
          </button>
        </div>

        <p className="mt-4 text-center text-[12px] text-[#8b7d67]">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setLocalError(null);
            }}
            className="font-medium text-[#8e6a2b] transition hover:text-[#6f531f]"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
