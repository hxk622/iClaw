import { Fragment, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { BRAND } from '@/app/lib/brand';
import type { ResolvedAuthExperienceConfig } from '@/app/lib/oem-runtime';

interface AuthPanelProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  experienceConfig: ResolvedAuthExperienceConfig;
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
    return {label: '请输入密码', tone: 'text-[var(--text-secondary)]', score: 0};
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) {
    return {label: '密码强度较弱', tone: 'text-[#c65b42]', score: 1};
  }
  if (score <= 3) {
    return {label: '密码强度中等', tone: 'text-[#ab7c2d]', score: 2};
  }
  return {label: '密码强度较强', tone: 'text-[#2f8f5f]', score: 3};
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
    <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
      <div className="h-px flex-1 bg-[var(--chip-brand-border)]" />
      <span>或使用第三方登录</span>
      <div className="h-px flex-1 bg-[var(--chip-brand-border)]" />
    </div>
  );
}

function FieldLabel({children}: {children: React.ReactNode}) {
  return <span className="text-[12px] font-medium text-[var(--text-secondary)]">{children}</span>;
}

function InputShell({children}: {children: React.ReactNode}) {
  return <div className="mt-1">{children}</div>;
}

const inputClassName =
  'h-11 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--button-primary-border-hover)] focus:ring-4 focus:ring-[var(--chip-brand-bg)]';

export function AuthPanel({
  open,
  loading,
  error,
  experienceConfig,
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
  const [activeAgreementKey, setActiveAgreementKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const activeAgreement = useMemo(
    () => experienceConfig.agreements.find((item) => item.key === activeAgreementKey) || null,
    [activeAgreementKey, experienceConfig.agreements],
  );
  const panelTitle = experienceConfig.title?.trim() || '登录以继续使用账户与额度体系';
  const panelSubtitle = experienceConfig.subtitle?.trim() || '';
  const socialNotice = experienceConfig.socialNotice?.trim() || '微信和 Gmail 登录暂未开放，请先使用账号密码登录。';

  const effectiveError = error || localError;

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setLocalError(null);
    setActiveAgreementKey(null);
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,22,18,0.22)] px-4 py-8 backdrop-blur-[10px] transition-opacity ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] rounded-[32px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] p-5 shadow-[0_32px_90px_rgba(26,22,18,0.16)] backdrop-blur dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))] md:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[var(--chip-brand-border)] bg-[linear-gradient(180deg,#ffffff,#f5efe3)] shadow-[var(--pressable-card-rest-shadow)]">
              <img src={BRAND.assets.faviconPngSrc} alt={BRAND.assets.logoAlt} className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary)]">{BRAND.displayName}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">{panelTitle}</div>
              {panelSubtitle ? <div className="mt-1 max-w-[420px] text-[12px] leading-5 text-[var(--text-muted)]">{panelSubtitle}</div> : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭登录弹窗"
            className="rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--chip-brand-bg)] hover:text-[var(--brand-primary)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 flex rounded-2xl border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] p-1">
          <button
            type="button"
            className={`flex-1 rounded-[14px] px-4 py-2.5 text-[13px] font-medium transition ${
              mode === 'login'
                ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-[var(--button-primary-shadow-hover)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
              mode === 'register'
                ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-[var(--button-primary-shadow-hover)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                    placeholder="设置你的用户名"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--chip-brand-bg)] hover:text-[var(--brand-primary)]"
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
                        index < passwordStrength.score ? 'bg-[var(--brand-primary)]' : 'bg-[rgba(15,23,42,0.08)]'
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

              <label className="flex items-start gap-3 rounded-2xl border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] px-4 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    setLocalError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-[var(--chip-brand-border-strong)] text-[var(--brand-primary)]"
                />
                <span>
                  我已阅读并同意 {BRAND.legalName} 的
                  {experienceConfig.agreements.map((agreement, index) => (
                    <Fragment key={agreement.key}>
                      {index > 0 ? '、' : ' '}
                      <button
                        type="button"
                        className="font-medium text-[var(--brand-primary)] underline-offset-2 transition hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setActiveAgreementKey(agreement.key);
                        }}
                      >
                        {agreement.title}
                      </button>
                    </Fragment>
                  ))}
                  。
                </span>
              </label>
            </>
          )}
        </div>

        {effectiveError ? (
          <p className="mt-4 rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[var(--state-error)]">
            {effectiveError}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="md"
          onClick={() => void submit()}
          disabled={loading || !canSubmit}
          block
          leadingIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          className="mt-5"
        >
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </Button>

        <SocialDivider />

        <div className="mb-3 rounded-2xl border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          {socialNotice}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="md"
            block
            disabled
            leadingIcon={<WechatIcon />}
            className="opacity-55"
          >
            <span>微信</span>
          </Button>
          <Button
            variant="secondary"
            size="md"
            block
            disabled
            leadingIcon={<GoogleIcon />}
            className="opacity-55"
          >
            <span>Gmail</span>
          </Button>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--text-secondary)]">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setLocalError(null);
            }}
            className="font-medium text-[var(--brand-primary)] transition hover:text-[var(--brand-primary-hover)]"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
      {activeAgreement ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 px-4 py-8 backdrop-blur-[4px]"
          onClick={() => setActiveAgreementKey(null)}
        >
          <div
            className="w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-6 py-5">
              <div>
                <div className="text-[18px] font-semibold text-[var(--text-primary)]">{activeAgreement.title}</div>
                <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  <span>{activeAgreement.version || '未设置版本'}</span>
                  <span className="mx-2">•</span>
                  <span>{activeAgreement.effectiveDate || '未设置生效日期'}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="关闭协议内容"
                className="rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--chip-brand-bg)] hover:text-[var(--brand-primary)]"
                onClick={() => setActiveAgreementKey(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {activeAgreement.summary ? (
                <div className="mb-4 rounded-2xl border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                  {activeAgreement.summary}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-[14px] leading-7 text-[var(--text-primary)]">{activeAgreement.content}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
