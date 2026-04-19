import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, CreditCard, KeyRound, Link2, Loader2, Trash2, Unplug, Wallet } from 'lucide-react';
import { IClawClient, type CreditBalanceData, type CreditLedgerItemData } from '@iclaw/sdk';
import { Button } from '@/app/components/ui/Button';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { resolveUserAvatarUrl } from '@/app/lib/user-avatar';

const ACCOUNT_INPUT_CLASS =
  'h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]';
const ACCOUNT_DISABLED_INPUT_CLASS =
  'h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--text-secondary)] outline-none';

type AuthUser = {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  avatarRevision?: string | number | null;
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
  onOpenRechargeCenter: () => void;
  onUserUpdated: (user: AuthUser) => void;
  active?: boolean;
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
  if (provider === 'wechat_qr') return '微信扫码';
  if (provider === 'alipay_qr') return '支付宝扫码';
  return provider;
}

function creditEventLabel(eventType: string): string {
  if (eventType === 'daily_reset') return '每日赠送';
  if (eventType === 'topup') return '充值到账';
  if (eventType === 'usage_debit') return '使用扣减';
  return eventType;
}

type CreditLedgerDisplayItem = {
  id: string;
  eventType: string;
  createdAt: string;
  totalDelta: number;
  balanceAfter: number | null;
  detailLabel: string | null;
};

function buildCreditLedgerDisplayItems(items: CreditLedgerItemData[]): CreditLedgerDisplayItem[] {
  const grouped = new Map<string, CreditLedgerDisplayItem & {dailyFreeDebit: number; topupDebit: number}>();
  const orderedKeys: string[] = [];

  items.forEach((item) => {
    const canGroupUsageDebit = item.event_type === 'usage_debit' && item.reference_type === 'chat_run' && Boolean(item.reference_id);
    const groupingKey = canGroupUsageDebit ? `usage:${item.reference_id}` : `single:${item.id}`;

    if (!grouped.has(groupingKey)) {
      grouped.set(groupingKey, {
        id: canGroupUsageDebit ? String(item.reference_id) : item.id,
        eventType: item.event_type,
        createdAt: item.created_at,
        totalDelta: 0,
        balanceAfter: canGroupUsageDebit ? null : item.balance_after,
        detailLabel: null,
        dailyFreeDebit: 0,
        topupDebit: 0,
      });
      orderedKeys.push(groupingKey);
    }

    const target = grouped.get(groupingKey)!;
    target.totalDelta += item.delta;

    if (!canGroupUsageDebit) {
      return;
    }

    if (item.bucket === 'daily_free') {
      target.dailyFreeDebit += Math.abs(item.amount);
    } else if (item.bucket === 'topup') {
      target.topupDebit += Math.abs(item.amount);
    }
  });

  return orderedKeys.map((key) => {
    const item = grouped.get(key)!;
    if (item.eventType !== 'usage_debit') {
      return item;
    }

    const detailParts: string[] = [];
    if (item.dailyFreeDebit > 0) {
      detailParts.push(`赠送 ${item.dailyFreeDebit}`);
    }
    if (item.topupDebit > 0) {
      detailParts.push(`充值 ${item.topupDebit}`);
    }

    return {
      id: item.id,
      eventType: item.eventType,
      createdAt: item.createdAt,
      totalDelta: item.totalDelta,
      balanceAfter: null,
      detailLabel: detailParts.join(' · ') || null,
    } satisfies CreditLedgerDisplayItem;
  });
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

export function AccountPanel({
  client,
  token,
  user,
  onClose,
  onOpenRechargeCenter,
  onUserUpdated,
  active = true,
}: AccountPanelProps) {
  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(resolveUserAvatarUrl(user));
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
  const [credits, setCredits] = useState<CreditBalanceData | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerItemData[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const displayLedger = useMemo(() => buildCreditLedgerDisplayItems(ledger).slice(0, 8), [ledger]);

  useEffect(() => {
    setName(user?.name || '');
    setAvatarPreview(resolveUserAvatarUrl(user));
    setAvatarDataBase64(null);
    setAvatarContentType(null);
    setAvatarFilename(null);
    setRemoveAvatar(false);
  }, [user?.avatar, user?.avatarUrl, user?.avatar_url, user?.name]);

  const refreshMeta = async (silent = false) => {
    if (!silent) {
      setLoadingMeta(true);
    }
    setMetaError(null);
    try {
      const [creditsData, ledgerData, linkedData] = await Promise.all([
        client.creditsMe(token),
        client.creditsLedger(token),
        client.linkedAccounts(token),
      ]);
      setCredits(creditsData || null);
      setLedger((ledgerData.items || []).slice(0, 24));
      setLinkedAccounts((((linkedData as {items?: LinkedAccount[]})?.items) || []).slice(0, 6));
    } finally {
      if (!silent) {
        setLoadingMeta(false);
      }
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        await refreshMeta();
      } catch (error) {
        if (!cancelled) {
          setMetaError(error instanceof Error ? error.message : '加载账号信息失败');
          setLoadingMeta(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [active, client, token]);

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
      const latestProfile = ((await client.me(token).catch(() => null)) as AuthUser | null) || updated;
      const avatarChanged = Boolean(avatarDataBase64) || removeAvatar;
      onUserUpdated({
        ...(user || {}),
        ...latestProfile,
        avatarRevision: avatarChanged ? Date.now() : latestProfile.avatarRevision ?? user?.avatarRevision ?? null,
      });
      setAvatarPreview(resolveUserAvatarUrl(latestProfile));
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
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-[rgba(26,22,18,0.22)] px-5 py-5 backdrop-blur-[2px] ${
        active ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={active ? undefined : true}
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_28px_90px_rgba(42,31,10,0.18)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--drawer-eyebrow-bg)] px-6 py-3 backdrop-blur-[10px]">
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="rounded-md px-2 py-1 text-sm text-[var(--text-secondary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            返回对话
          </Button>
          <div className="text-sm text-[var(--text-secondary)]">个人中心</div>
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <DrawerSection
                title="账号资料"
                className="rounded-[28px] bg-[var(--bg-card)]"
                icon={null}
              >
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Profile</div>
                  <h1 className="mt-2 text-2xl text-[var(--text-primary)]">账号资料</h1>
                </div>
                <div className="mb-5 flex flex-col gap-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 md:flex-row md:items-center md:justify-between">
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
                    <Button
                      onClick={() => avatarInputRef.current?.click()}
                      variant="secondary"
                      size="sm"
                      className="rounded-2xl text-sm"
                    >
                      <Camera className="h-4 w-4" />
                      更换头像
                    </Button>
                    <Button
                      onClick={handleRemoveAvatar}
                      disabled={!avatarPreview && !user?.avatar_url}
                      variant="secondary"
                      size="sm"
                      className="rounded-2xl text-sm text-[var(--text-secondary)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      移除
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">用户名</span>
                    <input
                      disabled
                      value={user?.username || ''}
                      className={ACCOUNT_DISABLED_INPUT_CLASS}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">邮箱</span>
                    <input
                      disabled
                      value={user?.email || ''}
                      className={ACCOUNT_DISABLED_INPUT_CLASS}
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
                      className={ACCOUNT_INPUT_CLASS}
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={() => void handleSaveProfile()}
                    disabled={savingProfile}
                    variant="primary"
                    size="sm"
                    className="rounded-2xl text-sm"
                  >
                    {savingProfile ? '保存中...' : '保存资料'}
                  </Button>
                  {profileMessage ? <span className="text-sm text-[var(--text-secondary)]">{profileMessage}</span> : null}
                </div>
              </DrawerSection>

              <DrawerSection title="修改密码" icon={<KeyRound className="h-5 w-5" />}>
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
                      className={ACCOUNT_INPUT_CLASS}
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
                      className={ACCOUNT_INPUT_CLASS}
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={() => void handleChangePassword()}
                    disabled={changingPassword}
                    variant="secondary"
                    size="sm"
                    className="rounded-2xl text-sm"
                  >
                    {changingPassword ? '更新中...' : '更新密码'}
                  </Button>
                  {passwordMessage ? <span className="text-sm text-[var(--text-secondary)]">{passwordMessage}</span> : null}
                </div>
              </DrawerSection>
            </section>

            <aside className="space-y-6">
              <DrawerSection title="积分余额" icon={<Wallet className="h-5 w-5" />}>
                {loadingMeta ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载账户信息...
                  </div>
                ) : metaError ? (
                  <InfoTile label="加载失败" value={metaError} tone="warning" />
                ) : (
                  <InfoTile
                    label="可用余额"
                    value={credits?.total_available_balance ?? credits?.available_balance ?? credits?.balance ?? 0}
                    description={credits?.currency_display || '积分'}
                  />
                )}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <InfoTile
                    label="今日赠送"
                    value={credits?.daily_free_balance ?? 0}
                    description={credits?.daily_free_expires_at ? `重置于 ${formatDate(credits.daily_free_expires_at)}` : '每日重置'}
                  />
                  <InfoTile
                    label="充值余额"
                    value={credits?.topup_balance ?? 0}
                    description="长期可用"
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={onOpenRechargeCenter}
                    variant="primary"
                    size="sm"
                    className="rounded-2xl text-sm"
                  >
                    充值中心
                  </Button>
                  <span className="text-xs text-[var(--text-secondary)]">统一从充值中心进入，支持微信扫码和支付宝扫码。</span>
                </div>
              </DrawerSection>

              <DrawerSection title="已绑定登录方式" icon={<Link2 className="h-5 w-5" />}>
                <div className="space-y-3">
                  {linkedAccounts.length === 0 ? (
                    <InfoTile label="登录方式" value="当前只有邮箱密码登录。" />
                  ) : (
                    linkedAccounts.map((item) => (
                      <div key={`${item.provider}:${item.provider_id}`} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-[var(--text-primary)]">{providerLabel(item.provider)}</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">{formatDate(item.created_at)}</div>
                          </div>
                          {(item.provider === 'wechat' || item.provider === 'google') ? (
                            <Button
                              onClick={() => void handleUnlink(item.provider as 'wechat' | 'google')}
                              disabled={unlinkingProvider === item.provider}
                              variant="secondary"
                              size="sm"
                              className="rounded-xl px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                            >
                              {unlinkingProvider === item.provider ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                              解绑
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DrawerSection>

              <DrawerSection title="最近流水" icon={<CreditCard className="h-5 w-5" />}>
                <div className="space-y-3">
                  {displayLedger.length === 0 ? (
                    <InfoTile label="流水" value="还没有积分流水。" />
                  ) : (
                    displayLedger.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--text-primary)]">{creditEventLabel(item.eventType)}</span>
                          <span className={item.totalDelta >= 0 ? 'text-sm text-[var(--state-success)]' : 'text-sm text-[var(--state-error)]'}>
                            {item.totalDelta >= 0 ? `+${item.totalDelta}` : item.totalDelta}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>{item.detailLabel || (item.balanceAfter != null ? `余额 ${item.balanceAfter} 积分` : ' ')}</span>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DrawerSection>
            </aside>
          </div>
        </main>

      </div>
    </div>
  );
}
