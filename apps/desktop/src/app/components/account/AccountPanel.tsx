import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, CreditCard, KeyRound, Link2, Loader2, Trash2, Unplug, Wallet } from 'lucide-react';
import { IClawClient, type CreditBalanceData, type CreditLedgerItemData, type PaymentOrderData } from '@iclaw/sdk';
import { Button } from '@/app/components/ui/Button';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';

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
};

type LinkedAccount = {
  provider: string;
  provider_id: string;
  created_at: string;
};

type RechargeProvider = 'wechat_qr' | 'alipay_qr';

type TopupPackage = {
  id: string;
  label: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  badge: string;
};

const TOPUP_PACKAGES: TopupPackage[] = [
  { id: 'topup_1000', label: '轻量补给', credits: 1000, bonusCredits: 100, amountCnyFen: 1000, badge: '首充友好' },
  { id: 'topup_3000', label: '高频常用', credits: 3000, bonusCredits: 400, amountCnyFen: 3000, badge: '最常用' },
  { id: 'topup_5000', label: '工作流加满', credits: 5000, bonusCredits: 800, amountCnyFen: 5000, badge: '额外赠送更多' },
];

const RECHARGE_PROVIDERS: Array<{ id: RechargeProvider; label: string; hint: string }> = [
  { id: 'wechat_qr', label: '微信扫码', hint: '适合移动端主用微信的用户' },
  { id: 'alipay_qr', label: '支付宝扫码', hint: '适合偏好银行卡或支付宝余额' },
];

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

function userInitial(user: AuthUser | null, fallbackName: string): string {
  const source = (fallbackName || user?.name || user?.username || user?.email || 'i').trim();
  return source ? source[0]!.toUpperCase() : 'I';
}

function paymentStatusLabel(status: PaymentOrderData['status']): string {
  if (status === 'pending') return '等待支付';
  if (status === 'paid') return '已到账';
  if (status === 'expired') return '已过期';
  if (status === 'failed') return '支付失败';
  if (status === 'refunded') return '已退款';
  return status;
}

function formatCurrencyFen(value: number): string {
  return `￥${(value / 100).toFixed(2)}`;
}

function formatCountdown(expiresAt: string | null): string {
  if (!expiresAt) return '--:--';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
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
  const [credits, setCredits] = useState<CreditBalanceData | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerItemData[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [recharging, setRecharging] = useState(false);
  const [confirmingRecharge, setConfirmingRecharge] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<RechargeProvider>('wechat_qr');
  const [selectedPackageId, setSelectedPackageId] = useState<string>(TOPUP_PACKAGES[1]!.id);
  const [activeOrder, setActiveOrder] = useState<PaymentOrderData | null>(null);
  const [rechargeMessage, setRechargeMessage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(user?.name || '');
    setAvatarPreview(user?.avatar_url || null);
    setAvatarDataBase64(null);
    setAvatarContentType(null);
    setAvatarFilename(null);
    setRemoveAvatar(false);
  }, [user?.avatar_url, user?.name]);

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
      setLedger((ledgerData.items || []).slice(0, 8));
      setLinkedAccounts((((linkedData as {items?: LinkedAccount[]})?.items) || []).slice(0, 6));
    } finally {
      if (!silent) {
        setLoadingMeta(false);
      }
    }
  };

  useEffect(() => {
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
  }, [client, token]);

  const selectedPackage = TOPUP_PACKAGES.find((item) => item.id === selectedPackageId) || TOPUP_PACKAGES[0]!;
  const activePackage = activeOrder
    ? TOPUP_PACKAGES.find((item) => item.id === activeOrder.package_id) || selectedPackage
    : selectedPackage;

  useEffect(() => {
    if (!activeOrder || activeOrder.status === 'paid' || activeOrder.status === 'expired' || activeOrder.status === 'failed' || activeOrder.status === 'refunded') {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const nextOrder = await client.getPaymentOrder(token, activeOrder.order_id);
        if (cancelled) return;
        setActiveOrder(nextOrder);
        if (nextOrder.status === 'paid') {
          setRechargeMessage('充值已到账，余额已刷新。');
          await refreshMeta(true);
        }
      } catch (error) {
        if (!cancelled) {
          setRechargeMessage(error instanceof Error ? error.message : '订单状态刷新失败');
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOrder?.order_id, activeOrder?.status, client, token]);

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

  const handleCreateRechargeOrder = async () => {
    setRecharging(true);
    setRechargeMessage(null);
    try {
      const order = await client.createPaymentOrder({
        token,
        provider: selectedProvider,
        packageId: selectedPackage.id,
        returnUrl: 'iclaw://payments/result',
      });
      setActiveOrder(order);
      setRechargeModalOpen(true);
    } catch (error) {
      setRechargeMessage(error instanceof Error ? error.message : '创建充值订单失败');
    } finally {
      setRecharging(false);
    }
  };

  const handleTestRechargeSuccess = async () => {
    if (!activeOrder) return;
    setConfirmingRecharge(true);
    setRechargeMessage(null);
    try {
      const nextOrder = await client.applyPaymentWebhook({
        provider: activeOrder.provider,
        eventId: `evt_${Date.now()}`,
        orderId: activeOrder.order_id,
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      setActiveOrder(nextOrder);
      await refreshMeta(true);
      setRechargeMessage('测试支付成功，充值余额已到账。');
    } catch (error) {
      setRechargeMessage(error instanceof Error ? error.message : '测试入账失败');
    } finally {
      setConfirmingRecharge(false);
    }
  };

  const handleOpenRechargeModal = () => {
    setRechargeModalOpen(true);
    setRechargeMessage(null);
  };

  const handleCloseRechargeModal = () => {
    if (confirmingRecharge) return;
    setRechargeModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(26,22,18,0.22)] px-5 py-5 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative flex h-full max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_28px_90px_rgba(42,31,10,0.18)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-white/78 px-6 py-3 backdrop-blur-[10px] dark:bg-[rgba(12,12,12,0.72)]">
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
              <DrawerSection title="龙虾币余额" icon={<Wallet className="h-5 w-5" />}>
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
                    description={credits?.currency_display || '龙虾币'}
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
                    onClick={handleOpenRechargeModal}
                    variant="secondary"
                    size="sm"
                    className="rounded-2xl text-sm"
                  >
                    去充值
                  </Button>
                  <span className="text-xs text-[var(--text-secondary)]">支持微信扫码和支付宝扫码，当前二维码为联调占位图。</span>
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
                  {ledger.length === 0 ? (
                    <InfoTile label="流水" value="还没有龙虾币流水。" />
                  ) : (
                    ledger.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--text-primary)]">{creditEventLabel(item.event_type)}</span>
                          <span className={item.delta >= 0 ? 'text-sm text-[var(--state-success)]' : 'text-sm text-[var(--state-error)]'}>
                            {item.delta >= 0 ? `+${item.delta}` : item.delta}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>余额 {item.balance_after} 龙虾币</span>
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DrawerSection>
            </aside>
          </div>
        </main>

        {rechargeModalOpen ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(18,17,14,0.38)] px-4 py-6 backdrop-blur-[8px]" onClick={handleCloseRechargeModal}>
            <div
              className="grid w-full max-w-5xl gap-0 overflow-hidden rounded-[30px] border border-[rgba(117,96,49,0.18)] bg-[linear-gradient(135deg,rgba(255,252,244,0.98),rgba(246,239,223,0.97))] shadow-[0_36px_120px_rgba(39,29,7,0.26)] lg:grid-cols-[1.02fr_0.98fr]"
              onClick={(event) => event.stopPropagation()}
            >
              <section className="border-b border-[rgba(117,96,49,0.14)] px-6 py-6 lg:border-b-0 lg:border-r">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Recharge Console</div>
                    <h2 className="mt-2 text-2xl text-[var(--text-primary)]">扫码充值</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      先完成正式扫码流程联调。当前二维码为本地占位图，但订单、轮询和到账链路都按真实流程走。
                    </p>
                  </div>
                  <Button onClick={handleCloseRechargeModal} variant="ghost" size="sm" className="rounded-2xl px-3 py-1.5 text-sm text-[var(--text-secondary)]">
                    关闭
                  </Button>
                </div>

                <div className="mt-6">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">01 / 选择档位</div>
                  <div className="mt-3 grid gap-3">
                    {TOPUP_PACKAGES.map((item) => {
                      const selected = item.id === selectedPackageId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedPackageId(item.id)}
                          className={`rounded-[24px] border px-4 py-4 text-left transition ${
                            selected
                              ? 'border-[rgba(181,141,53,0.44)] bg-[rgba(255,248,231,0.92)] shadow-[0_16px_36px_rgba(126,95,27,0.12)]'
                              : 'border-[var(--border-default)] bg-[rgba(255,255,255,0.66)] hover:border-[rgba(181,141,53,0.28)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm text-[var(--text-primary)]">{item.label}</div>
                              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                                {item.credits} 龙虾币 + 赠送 {item.bonusCredits}
                              </div>
                            </div>
                            <div className="rounded-full bg-[rgba(145,111,32,0.1)] px-2.5 py-1 text-xs text-[rgba(117,86,16,0.92)]">{item.badge}</div>
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div className="text-2xl text-[var(--text-primary)]">{formatCurrencyFen(item.amountCnyFen)}</div>
                            <div className="text-xs text-[var(--text-secondary)]">到账共 {item.credits + item.bonusCredits}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">02 / 选择支付方式</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {RECHARGE_PROVIDERS.map((item) => {
                      const selected = item.id === selectedProvider;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedProvider(item.id)}
                          className={`rounded-[22px] border px-4 py-4 text-left transition ${
                            selected
                              ? 'border-[rgba(30,113,255,0.28)] bg-[rgba(255,255,255,0.92)] shadow-[0_16px_34px_rgba(48,80,135,0.11)]'
                              : 'border-[var(--border-default)] bg-[rgba(255,255,255,0.62)] hover:border-[rgba(30,113,255,0.16)]'
                          }`}
                        >
                          <div className="text-sm text-[var(--text-primary)]">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-[rgba(117,96,49,0.14)] bg-[rgba(255,255,255,0.62)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">本次订单</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {providerLabel(selectedProvider)} · {selectedPackage.label}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl text-[var(--text-primary)]">{formatCurrencyFen(selectedPackage.amountCnyFen)}</div>
                      <div className="text-xs text-[var(--text-secondary)]">到账 {selectedPackage.credits + selectedPackage.bonusCredits}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      onClick={() => void handleCreateRechargeOrder()}
                      disabled={recharging}
                      variant="secondary"
                      size="sm"
                      className="rounded-2xl px-4 py-2 text-sm"
                    >
                      {recharging ? '生成中...' : activeOrder ? '重新生成二维码' : '生成二维码'}
                    </Button>
                    <span className="text-xs text-[var(--text-secondary)]">订单有效期 15 分钟，过期后可重新生成。</span>
                  </div>
                </div>
              </section>

              <section className="px-6 py-6">
                <div className="rounded-[28px] border border-[rgba(38,38,33,0.08)] bg-[rgba(255,255,255,0.72)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">03 / 扫码支付</div>
                      <div className="mt-2 text-lg text-[var(--text-primary)]">
                        {activeOrder ? providerLabel(activeOrder.provider) : providerLabel(selectedProvider)}
                      </div>
                    </div>
                    <div className="rounded-full bg-[rgba(23,23,20,0.06)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      {activeOrder ? paymentStatusLabel(activeOrder.status) : '等待生成'}
                    </div>
                  </div>

                  <div className="mt-5 flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-[rgba(117,96,49,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(252,247,236,0.92))] p-6">
                    {activeOrder?.payment_url ? (
                      <img src={activeOrder.payment_url} alt="payment qr placeholder" className="h-[300px] w-[300px] rounded-[24px] object-cover shadow-[0_18px_50px_rgba(45,33,11,0.12)]" />
                    ) : (
                      <div className="max-w-[260px] text-center">
                        <div className="text-base text-[var(--text-primary)]">还没有生成二维码</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">选好档位和支付方式后，生成一张用于桌面联调的占位二维码。</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <InfoTile label="当前档位" value={activeOrder?.package_name || activePackage.label} description={`${activePackage.credits} + 赠送 ${activePackage.bonusCredits}`} />
                    <InfoTile label="支付金额" value={formatCurrencyFen(activeOrder?.amount_cny_fen || activePackage.amountCnyFen)} description="人民币" />
                    <InfoTile
                      label="剩余时间"
                      value={activeOrder ? formatCountdown(activeOrder.expires_at) : '--:--'}
                      description={activeOrder?.expires_at ? `截止 ${formatDate(activeOrder.expires_at)}` : '生成订单后开始倒计时'}
                    />
                  </div>

                  <div className="mt-5 rounded-[22px] border border-[rgba(38,38,33,0.08)] bg-[rgba(247,242,230,0.72)] px-4 py-4">
                    <div className="text-sm text-[var(--text-primary)]">联调说明</div>
                    <div className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                      当前二维码是本地占位图，用来打通完整充值流程。真实微信/支付宝下单接入后，直接替换二维码来源和 webhook 验签即可。
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => void handleTestRechargeSuccess()}
                        disabled={!activeOrder || activeOrder.status === 'paid' || confirmingRecharge}
                        variant="secondary"
                        size="sm"
                        className="rounded-2xl px-4 py-2 text-sm"
                      >
                        {confirmingRecharge ? '入账中...' : '测试支付成功'}
                      </Button>
                      {activeOrder?.status === 'paid' ? (
                        <span className="text-xs text-[var(--state-success)]">充值完成，可以关闭窗口继续使用。</span>
                      ) : activeOrder?.status === 'expired' ? (
                        <span className="text-xs text-[var(--state-error)]">订单已过期，请重新生成二维码。</span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">生成后会自动轮询订单状态。</span>
                      )}
                    </div>
                    {rechargeMessage ? <div className="mt-3 text-xs text-[var(--text-secondary)]">{rechargeMessage}</div> : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
