import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, CreditCard, KeyRound, Link2, Loader2, Trash2, Unplug, Wallet } from 'lucide-react';
import { IClawClient } from '@iclaw/sdk';

type AuthUser = {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type CreditBalance = {
  balance?: number;
  currency?: string;
};

type CreditLedgerItem = {
  id: string;
  event_type: string;
  delta: number;
  balance_after: number;
  created_at: string;
};

type LinkedAccount = {
  provider: string;
  provider_id: string;
  created_at: string;
};

interface AccountPanelProps {
  client: IClawClient;
  token: string;
  user: AuthUser | null;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function providerLabel(provider: string): string {
  if (provider === 'wechat') return '微信';
  if (provider === 'google') return 'Google';
  return provider;
}

function userInitial(user: AuthUser | null, fallbackName: string): string {
  const source = (fallbackName || user?.name || user?.username || user?.email || 'i').trim();
  return source ? source[0]!.toUpperCase() : 'I';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('头像读取失败'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

export function AccountPanel({ client, token, user, onClose, onUserUpdated }: AccountPanelProps) {
  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const [avatarDataBase64, setAvatarDataBase64] = useState<string | null>(null);
  const [avatarContentType, setAvatarContentType] = useState<string | null>(null);
  const [avatarFilename, setAvatarFilename] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerItem[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(user?.name || '');
    setAvatarPreview(user?.avatar_url || null);
    setAvatarDataBase64(null);
    setAvatarContentType(null);
    setAvatarFilename(null);
    setRemoveAvatar(false);
  }, [user?.avatar_url, user?.name]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const [creditsData, ledgerData, linkedData] = await Promise.all([
          client.creditsMe(token),
          client.creditsLedger(token),
          client.linkedAccounts(token),
        ]);
        if (cancelled) return;
        setCredits((creditsData as CreditBalance) || null);
        setLedger((((ledgerData as {items?: CreditLedgerItem[]})?.items) || []).slice(0, 8));
        setLinkedAccounts((((linkedData as {items?: LinkedAccount[]})?.items) || []).slice(0, 6));
      } catch (error) {
        if (!cancelled) {
          setMetaError(error instanceof Error ? error.message : '加载账号信息失败');
        }
      } finally {
        if (!cancelled) {
          setLoadingMeta(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [client, token]);

  const handleSaveProfile = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setProfileMessage('昵称不能为空');
      return;
    }
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const updated = (await client.updateProfile({
        token,
        name: nextName,
        avatarDataBase64: avatarDataBase64 || undefined,
        avatarContentType: avatarContentType || undefined,
        avatarFilename: avatarFilename || undefined,
        removeAvatar,
      })) as AuthUser;
      onUserUpdated(updated);
      setAvatarPreview(updated.avatar_url || null);
      setAvatarDataBase64(null);
      setAvatarContentType(null);
      setAvatarFilename(null);
      setRemoveAvatar(false);
      setProfileMessage('资料已更新');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '资料更新失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileMessage('只支持图片文件');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage('图片大小不能超过 5MB');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarPreview(dataUrl);
      setAvatarDataBase64(dataUrl);
      setAvatarContentType(file.type);
      setAvatarFilename(file.name);
      setRemoveAvatar(false);
      setProfileMessage(null);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '头像读取失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarDataBase64(null);
    setAvatarContentType(null);
    setAvatarFilename(null);
    setRemoveAvatar(true);
    setProfileMessage(null);
  };

  const handleChangePassword = async () => {
    if (newPassword.trim().length < 8) {
      setPasswordMessage('新密码至少需要 8 个字符');
      return;
    }
    setChangingPassword(true);
    setPasswordMessage(null);
    try {
      const result = await client.changePassword({
        token,
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage(result.message || '密码已更新');
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '修改密码失败');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUnlink = async (provider: 'wechat' | 'google') => {
    setUnlinkingProvider(provider);
    setMetaError(null);
    try {
      await client.unlinkOAuthAccount(token, provider);
      setLinkedAccounts((current) => current.filter((item) => item.provider !== provider));
    } catch (error) {
      setMetaError(error instanceof Error ? error.message : '解绑失败');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(28,24,16,0.24)] px-5 py-5 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-[0_28px_90px_rgba(42,31,10,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            返回对话
          </button>
          <div className="text-sm text-[var(--text-secondary)]">个人中心</div>
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Profile</div>
                  <h1 className="mt-2 text-2xl text-[var(--text-primary)]">账号资料</h1>
                </div>
                <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-2xl text-[var(--brand-on-primary)]">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
                      ) : (
                        userInitial(user, name)
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">个人头像</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">支持 PNG / JPG / WEBP / GIF，最大 5MB</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => void handleSelectAvatar(event)}
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    >
                      <Camera className="h-4 w-4" />
                      更换头像
                    </button>
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={!avatarPreview && !user?.avatar_url}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                      移除
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">用户名</span>
                    <input
                      disabled
                      value={user?.username || ''}
                      className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--text-secondary)] outline-none"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">邮箱</span>
                    <input
                      disabled
                      value={user?.email || ''}
                      className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--text-secondary)] outline-none"
                    />
                  </label>
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">显示名称</span>
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setProfileMessage(null);
                      }}
                      className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => void handleSaveProfile()}
                    disabled={savingProfile}
                    className="rounded-2xl bg-[var(--brand-primary)] px-4 py-2 text-sm text-[var(--brand-on-primary)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                  >
                    {savingProfile ? '保存中...' : '保存资料'}
                  </button>
                  {profileMessage ? <span className="text-sm text-[var(--text-secondary)]">{profileMessage}</span> : null}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <div className="mb-5 flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-[var(--text-secondary)]" />
                  <h2 className="text-xl text-[var(--text-primary)]">修改密码</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">当前密码</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordMessage(null);
                      }}
                      placeholder="如果当前账号已有密码请填写"
                      className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">新密码</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordMessage(null);
                      }}
                      placeholder="至少 8 个字符"
                      className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => void handleChangePassword()}
                    disabled={changingPassword}
                    className="rounded-2xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  >
                    {changingPassword ? '更新中...' : '更新密码'}
                  </button>
                  {passwordMessage ? <span className="text-sm text-[var(--text-secondary)]">{passwordMessage}</span> : null}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-[var(--text-secondary)]" />
                  <h2 className="text-xl text-[var(--text-primary)]">Credit 余额</h2>
                </div>
                {loadingMeta ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载账户信息...
                  </div>
                ) : metaError ? (
                  <div className="text-sm text-[var(--state-error)]">{metaError}</div>
                ) : (
                  <>
                    <div className="text-4xl text-[var(--text-primary)]">{credits?.balance ?? 0}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{credits?.currency || 'credit'}</div>
                  </>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-[var(--text-secondary)]" />
                  <h2 className="text-xl text-[var(--text-primary)]">已绑定登录方式</h2>
                </div>
                <div className="space-y-3">
                  {linkedAccounts.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">当前只有邮箱密码登录。</div>
                  ) : (
                    linkedAccounts.map((item) => (
                      <div key={`${item.provider}:${item.provider_id}`} className="rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-[var(--text-primary)]">{providerLabel(item.provider)}</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">{formatDate(item.created_at)}</div>
                          </div>
                          {(item.provider === 'wechat' || item.provider === 'google') ? (
                            <button
                              onClick={() => void handleUnlink(item.provider as 'wechat' | 'google')}
                              disabled={unlinkingProvider === item.provider}
                              className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                            >
                              {unlinkingProvider === item.provider ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                              解绑
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-[var(--text-secondary)]" />
                  <h2 className="text-xl text-[var(--text-primary)]">最近流水</h2>
                </div>
                <div className="space-y-3">
                  {ledger.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">还没有 credit 流水。</div>
                  ) : (
                    ledger.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--text-primary)]">{item.event_type}</span>
                          <span className={item.delta >= 0 ? 'text-sm text-[var(--state-success)]' : 'text-sm text-[var(--state-error)]'}>
                            {item.delta >= 0 ? `+${item.delta}` : item.delta}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>余额 {item.balance_after}</span>
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
