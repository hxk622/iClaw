import {type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Coins,
  FolderCog,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {type IClawClient, type PaymentOrderData} from '@iclaw/sdk';
import {cn} from '@/app/lib/cn';
import alipayLogo from '@/app/assets/payment-logos/alipay.jpeg';
import wechatPayLogo from '@/app/assets/payment-logos/wechat-pay.svg';
import {
  type ResolvedRechargePackageConfig,
  type ResolvedRechargePaymentMethodConfig,
  resolveRechargePackageConfig,
  resolveRechargePaymentMethodConfig,
} from '@/app/lib/oem-runtime';
import {INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE} from '@/app/lib/ui-interactions';

type PaymentMethod = 'wechat_qr' | 'alipay_qr';
type RechargeStep = 'packages' | 'payment';
type RechargePackage = ResolvedRechargePackageConfig;
type RechargePaymentMethod = ResolvedRechargePaymentMethodConfig;
type PaymentTransitionSnapshot = {
  paymentMethod: PaymentMethod;
  qrUrl: string;
  kind: 'switch' | 'refresh';
};

const PANEL_OVERLAY_CLASS =
  'fixed inset-0 z-50 overflow-hidden bg-[rgba(8,12,20,0.24)] p-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.44)] md:p-8';

const PRIMARY_ACTION_BUTTON_CLASS =
  'bg-[#111827] !text-white hover:bg-[#0B1220] dark:border dark:border-[#DDE3EA] dark:bg-[#F7F9FC] dark:!text-[#0F172A] dark:hover:bg-[#ECF1F6]';

const SECONDARY_ACTION_BUTTON_CLASS =
  'border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] dark:border-[#3A3A3A] dark:bg-transparent dark:text-[#E5E7EB] dark:hover:bg-[#1A1A1A]';

function formatPaymentDeadline(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parsePaymentDeadline(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getTime();
}

function formatCountdownLabel(remainingMs: number | null): string | null {
  if (remainingMs == null) {
    return null;
  }
  const safeMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isDataImageUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function formatPriceAmount(amountCnyFen: number): string {
  const amount = amountCnyFen / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function formatCreditsLabel(value: number): string {
  return value.toLocaleString('zh-CN');
}

function formatOrderIdShort(orderId: string | null | undefined): string | null {
  if (!orderId) {
    return null;
  }
  return orderId.length > 12 ? `${orderId.slice(0, 6)} · ${orderId.slice(-4)}` : orderId;
}

function getPaymentMethodLogoSrc(paymentMethod: PaymentMethod): string {
  return paymentMethod === 'wechat_qr' ? wechatPayLogo : alipayLogo;
}

function getPaymentMethodLabel(paymentMethod: PaymentMethod, fallbackLabel?: string | null): string {
  if (fallbackLabel?.trim()) {
    return fallbackLabel.trim();
  }
  return paymentMethod === 'wechat_qr' ? '微信支付' : '支付宝';
}

function getRechargeMetadataText(metadata: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  const source = metadata || {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function includesLabel(value: string | null | undefined, pattern: RegExp): boolean {
  return typeof value === 'string' && pattern.test(value.trim());
}

function PaymentMethodLogo({
  paymentMethod,
  className,
  imageClassName,
}: {
  paymentMethod: PaymentMethod;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-white',
        className,
      )}
    >
      <img
        src={getPaymentMethodLogoSrc(paymentMethod)}
        alt={paymentMethod === 'wechat_qr' ? '微信支付 Logo' : '支付宝 Logo'}
        className={cn('h-full w-full object-contain', imageClassName)}
      />
    </div>
  );
}

function PaymentBrandLogo({paymentMethod}: {paymentMethod: PaymentMethod}) {
  return (
    <PaymentMethodLogo
      paymentMethod={paymentMethod}
      className="h-14 w-14 rounded-md border-white/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
      imageClassName={paymentMethod === 'wechat_qr' ? 'p-2.5' : 'p-1.5'}
    />
  );
}

function getPaymentMethodTheme(paymentMethod: PaymentMethod) {
  return paymentMethod === 'wechat_qr'
    ? {
        label: '微信支付',
        instruction: '请使用微信扫一扫完成支付',
        accentTextClassName: 'text-[#07C160]',
        accentBgClassName: 'bg-[rgba(7,193,96,0.10)] dark:bg-[rgba(7,193,96,0.22)]',
        accentBorderClassName: 'border-[rgba(7,193,96,0.18)] dark:border-[rgba(7,193,96,0.34)]',
        qrStageClassName: 'bg-[#FAFFF7] dark:bg-[#1A2E1A]',
        optionSelectedClassName:
          'border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-950/30',
        optionSelectedDotClassName: 'bg-green-600 dark:bg-green-500',
      }
    : {
        label: '支付宝',
        instruction: '请使用支付宝扫一扫完成支付',
        accentTextClassName: 'text-[#1677FF]',
        accentBgClassName: 'bg-[rgba(22,119,255,0.10)] dark:bg-[rgba(22,119,255,0.22)]',
        accentBorderClassName: 'border-[rgba(22,119,255,0.18)] dark:border-[rgba(22,119,255,0.34)]',
        qrStageClassName: 'bg-[#F5F9FF] dark:bg-[#1A2845]',
        optionSelectedClassName:
          'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30',
        optionSelectedDotClassName: 'bg-blue-600 dark:bg-blue-500',
      };
}

function getDefaultPaymentMethod(paymentMethods: RechargePaymentMethod[]): PaymentMethod {
  return paymentMethods.find((item) => item.default)?.provider || paymentMethods[0]?.provider || 'wechat_qr';
}

function getPackageCardMeta(item: RechargePackage) {
  const explicitBadgeText = item.badgeLabel?.trim() || null;
  const metadataEyebrowText = getRechargeMetadataText(item.metadata, 'eyebrow_label', 'eyebrowLabel');
  const metadataPromoText = getRechargeMetadataText(item.metadata, 'promo_text', 'promoText');
  const cardVariant = getRechargeMetadataText(item.metadata, 'card_variant', 'cardVariant');
  const isSuperRecommended = item.recommended || includesLabel(cardVariant, /super|featured|recommended/i);
  const isPlatformRecommended = item.default || includesLabel(cardVariant, /default|platform/i);

  if (isSuperRecommended) {
    return {
      icon: <Zap className="h-5 w-5" />,
      badgeText: explicitBadgeText || '超值推荐',
      badgeClassName:
        'border border-[rgba(37,99,235,0.24)] bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] dark:border-[rgba(96,165,250,0.28)] dark:bg-[linear-gradient(135deg,#3B82F6_0%,#6366F1_100%)] dark:text-white dark:shadow-[0_10px_24px_rgba(59,130,246,0.24)]',
      accentClassName:
        'border-[rgba(59,130,246,0.42)] bg-[linear-gradient(180deg,rgba(239,246,255,0.94)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_20px_50px_rgba(59,130,246,0.16)] dark:border-[rgba(96,165,250,0.4)] dark:bg-[linear-gradient(180deg,rgba(26,38,64,0.96)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_20px_50px_rgba(37,99,235,0.18)]',
      iconWrapClassName:
        'bg-[linear-gradient(180deg,rgba(59,130,246,0.18)_0%,rgba(99,102,241,0.20)_100%)] text-[#2563EB] dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.22)_0%,rgba(99,102,241,0.28)_100%)] dark:text-[#93C5FD]',
      eyebrowText: metadataEyebrowText || (item.default ? '主力档位' : '超值推荐'),
      eyebrowClassName:
        'border border-[rgba(96,165,250,0.24)] bg-[rgba(59,130,246,0.10)] text-[#2563EB] dark:border-[rgba(96,165,250,0.30)] dark:bg-[rgba(59,130,246,0.14)] dark:text-[#93C5FD]',
      promoText: metadataPromoText || (item.default ? '日常充值首选，兼顾单次成本与连续使用体验' : '高频用户主力包，连续对话和任务执行更划算'),
      priceGlowClassName: 'text-[#111827] dark:text-white',
      ctaClassName:
        'border border-[rgba(37,99,235,0.28)] bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] !text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] hover:brightness-110 hover:shadow-[0_14px_30px_rgba(37,99,235,0.26)] dark:border-[rgba(96,165,250,0.28)] dark:bg-[linear-gradient(135deg,#3B82F6_0%,#6366F1_100%)] dark:!text-white dark:shadow-[0_10px_24px_rgba(59,130,246,0.24)]',
    };
  }
  if (isPlatformRecommended) {
    return {
      icon: <Zap className="h-5 w-5" />,
      badgeText: getRechargeMetadataText(item.metadata, 'platform_badge_label', 'platformBadgeLabel', 'default_badge_label', 'defaultBadgeLabel') || '平台推荐',
      badgeClassName:
        'border border-[rgba(148,163,184,0.32)] bg-[rgba(248,250,252,0.94)] text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:border-[rgba(148,163,184,0.30)] dark:bg-[rgba(30,41,59,0.88)] dark:text-slate-100 dark:shadow-[0_8px_20px_rgba(0,0,0,0.18)]',
      accentClassName:
        'border-[rgba(71,85,105,0.30)] bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.98)_100%)] shadow-[0_16px_44px_rgba(71,85,105,0.12)] dark:border-[rgba(148,163,184,0.30)] dark:bg-[linear-gradient(180deg,rgba(28,33,43,0.98)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_20px_46px_rgba(15,23,42,0.26)]',
      iconWrapClassName:
        'bg-[linear-gradient(180deg,rgba(71,85,105,0.12)_0%,rgba(100,116,139,0.18)_100%)] text-slate-700 dark:bg-[linear-gradient(180deg,rgba(148,163,184,0.20)_0%,rgba(100,116,139,0.24)_100%)] dark:text-slate-200',
      eyebrowText: metadataEyebrowText || '主力档位',
      eyebrowClassName:
        'border border-[rgba(148,163,184,0.24)] bg-[rgba(226,232,240,0.58)] text-slate-700 dark:border-[rgba(148,163,184,0.28)] dark:bg-[rgba(51,65,85,0.32)] dark:text-slate-200',
      promoText: metadataPromoText || '日常充值首选，兼顾单次成本与连续使用体验',
      priceGlowClassName: 'text-[#111827] dark:text-white',
      ctaClassName:
        'border border-[rgba(148,163,184,0.38)] bg-[rgba(255,255,255,0.92)] text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.07)] hover:border-[rgba(100,116,139,0.42)] hover:bg-[rgba(248,250,252,0.98)] hover:text-slate-900 dark:border-[rgba(148,163,184,0.34)] dark:bg-[rgba(30,41,59,0.72)] dark:text-slate-100 dark:shadow-[0_8px_20px_rgba(0,0,0,0.18)] dark:hover:bg-[rgba(51,65,85,0.84)]',
    };
  }
  const neutralBadgeText = explicitBadgeText;
  const neutralEyebrowText = metadataEyebrowText || '灵活充值';
  const neutralPromoText = metadataPromoText;
  return {
    icon: <Sparkles className="h-5 w-5" />,
    badgeText: neutralBadgeText,
    badgeClassName: neutralBadgeText
      ? 'border border-[rgba(148,163,184,0.24)] bg-[rgba(255,255,255,0.82)] text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] dark:border-[rgba(148,163,184,0.24)] dark:bg-[rgba(30,41,59,0.82)] dark:text-slate-100 dark:shadow-[0_8px_18px_rgba(0,0,0,0.18)]'
      : '',
    accentClassName:
      'border-gray-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,250,251,0.98)_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-[#2F3742] dark:bg-[linear-gradient(180deg,rgba(26,26,26,0.98)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.26)]',
    iconWrapClassName: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    eyebrowText: neutralEyebrowText,
    eyebrowClassName:
      'border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-[#1E1E1E] dark:text-gray-300',
    promoText: neutralPromoText,
    priceGlowClassName: 'text-gray-900 dark:text-gray-50',
    ctaClassName:
      'border border-gray-200 bg-white text-gray-700 shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-[#3A3A3A] dark:bg-transparent dark:text-[#E5E7EB] dark:shadow-none dark:hover:bg-[#1A1A1A]',
  };
}

function BrandedPaymentQr({
  paymentMethod,
  qrUrl,
  expired = false,
  onRefresh,
}: {
  paymentMethod: PaymentMethod;
  qrUrl: string;
  expired?: boolean;
  onRefresh?: () => void;
}) {
  const methodTheme = getPaymentMethodTheme(paymentMethod);
  return (
    <div
      className="relative rounded-lg border border-gray-200/80 bg-white p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      data-testid={expired ? 'recharge-qr-card-expired' : 'recharge-qr-card'}
    >
      <div
        className={cn('relative h-[min(280px,32vh)] w-[min(280px,32vh)] overflow-hidden rounded-md', methodTheme.qrStageClassName)}
        data-testid="recharge-qr-container"
      >
        <img
          src={qrUrl}
          alt={`${paymentMethod === 'wechat_qr' ? '微信' : '支付宝'}支付二维码`}
          data-testid="recharge-qr-image"
          className={cn(
            'absolute inset-0 h-full w-full object-contain transition-[filter,transform,opacity] duration-300',
            expired && 'scale-[1.01] opacity-75 blur-[0.5px]',
          )}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PaymentBrandLogo paymentMethod={paymentMethod} />
        </div>
        {expired ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm dark:bg-gray-900/95"
            data-testid="recharge-qr-expired-mask"
          >
            <button
              type="button"
              onClick={onRefresh}
              data-testid="recharge-qr-refresh"
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-md px-5 py-3.5 transition-colors',
                PRIMARY_ACTION_BUTTON_CLASS,
              )}
            >
              <RefreshCw className="h-5 w-5" />
              <span className="text-[13px] font-medium">刷新二维码</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getDefaultPackageId(packages: RechargePackage[]): string {
  return (
    packages.find((item) => item.default)?.packageId ||
    packages.find((item) => item.recommended)?.packageId ||
    packages[0]?.packageId ||
    ''
  );
}

interface RechargeCenterProps {
  client: IClawClient;
  token: string;
  appName?: string;
  runtimeConfig?: Record<string, unknown> | null;
  onClose: () => void;
  onPaymentSettled?: () => Promise<void> | void;
  active?: boolean;
}

export function RechargeCenter({
  client,
  token,
  appName,
  runtimeConfig,
  onClose,
  onPaymentSettled,
  active = true,
}: RechargeCenterProps) {
  const successAutoCloseTimeoutMs = 5_000;
  const paymentOrderRequestTimeoutMs = 8_000;
  const [step, setStep] = useState<RechargeStep>('packages');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wechat_qr');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [switchingPaymentMethod, setSwitchingPaymentMethod] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PaymentOrderData | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [generatedLaunchQrUrl, setGeneratedLaunchQrUrl] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [transitionSnapshot, setTransitionSnapshot] = useState<PaymentTransitionSnapshot | null>(null);
  const createOrderAbortRef = useRef<AbortController | null>(null);

  const availablePackages = useMemo(() => resolveRechargePackageConfig(runtimeConfig) ?? [], [runtimeConfig]);
  const availablePaymentMethods = useMemo(() => resolveRechargePaymentMethodConfig(runtimeConfig) ?? [], [runtimeConfig]);
  const defaultPackageId = useMemo(() => getDefaultPackageId(availablePackages), [availablePackages]);
  const defaultPaymentMethod = useMemo(() => getDefaultPaymentMethod(availablePaymentMethods), [availablePaymentMethods]);
  const currentPackage =
    useMemo(
      () =>
        availablePackages.find((item) => item.packageId === selectedPackageId) ||
        availablePackages.find((item) => item.packageId === defaultPackageId) ||
        availablePackages[0] ||
        null,
      [availablePackages, defaultPackageId, selectedPackageId],
    ) || null;
  const totalPrice = formatPriceAmount(currentPackage?.amountCnyFen || 0);
  const displayPaymentUrl = isDataImageUrl(activeOrder?.payment_url) ? activeOrder?.payment_url || null : null;
  const launchPaymentUrl =
    activeOrder?.payment_url && !isDataImageUrl(activeOrder.payment_url) ? activeOrder.payment_url : null;
  const resolvedQrUrl = displayPaymentUrl || generatedLaunchQrUrl;

  useEffect(() => {
    if (!active) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  useEffect(() => {
    if (displayPaymentUrl) {
      setGeneratedLaunchQrUrl(null);
      return;
    }
    if (!launchPaymentUrl) {
      setGeneratedLaunchQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(launchPaymentUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setGeneratedLaunchQrUrl(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[desktop] failed to generate launch QR code', error);
          setGeneratedLaunchQrUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [displayPaymentUrl, launchPaymentUrl]);

  useEffect(() => {
    if (!availablePackages.length) {
      setSelectedPackageId('');
      return;
    }
    if (availablePackages.some((item) => item.packageId === selectedPackageId)) {
      return;
    }
    setSelectedPackageId(defaultPackageId);
  }, [availablePackages, defaultPackageId, selectedPackageId]);

  useEffect(() => {
    if (!availablePaymentMethods.length) {
      return;
    }
    if (availablePaymentMethods.some((item) => item.provider === paymentMethod)) {
      return;
    }
    setPaymentMethod(defaultPaymentMethod);
  }, [availablePaymentMethods, defaultPaymentMethod, paymentMethod]);

  const abortPendingCreateOrder = () => {
    createOrderAbortRef.current?.abort();
    createOrderAbortRef.current = null;
  };

  const cancelPendingCreateOrder = () => {
    abortPendingCreateOrder();
    setCreatingOrder(false);
    setSwitchingPaymentMethod(false);
  };

  useEffect(() => () => cancelPendingCreateOrder(), []);

  const handlePayNow = async (
    overrides?: {
      packageConfig?: RechargePackage | null;
      provider?: PaymentMethod;
      transitionSnapshot?: PaymentTransitionSnapshot | null;
    },
  ) => {
    const nextPackage = overrides?.packageConfig ?? currentPackage;
    const nextProvider = overrides?.provider ?? paymentMethod;
    const nextTransitionSnapshot = overrides?.transitionSnapshot ?? null;
    const isMethodSwitch = nextTransitionSnapshot?.kind === 'switch';
    if (!nextPackage) {
      setPaymentMessage('当前未配置可充值套餐，请先在 admin-web 发布充值配置。');
      return;
    }
    abortPendingCreateOrder();
    const controller = new AbortController();
    createOrderAbortRef.current = controller;
    setTransitionSnapshot(
      nextTransitionSnapshot ||
        (resolvedQrUrl
          ? {
              paymentMethod,
              qrUrl: resolvedQrUrl,
              kind: 'refresh',
            }
          : null),
    );
    setCreatingOrder(!isMethodSwitch);
    setSwitchingPaymentMethod(isMethodSwitch);
    if (!isMethodSwitch) {
      setPaymentMessage(null);
      setActiveOrder(null);
      setGeneratedLaunchQrUrl(null);
    }
    setPaymentMethod(nextProvider);

    try {
      const order = await client.createPaymentOrder({
        token,
        provider: nextProvider,
        packageId: nextPackage.packageId,
        returnUrl: 'iclaw://payments/result',
        appName,
        signal: controller.signal,
        timeoutMs: paymentOrderRequestTimeoutMs,
      });
      if (controller.signal.aborted) {
        return;
      }
      setActiveOrder(order);
      setTransitionSnapshot(null);
      setSwitchingPaymentMethod(false);
      if (order.payment_url) {
        setPaymentMessage('支付二维码已就绪，请直接扫码完成支付。');
      } else {
        setPaymentMessage('支付订单已创建，但未返回支付入口。');
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setTransitionSnapshot(null);
      setSwitchingPaymentMethod(false);
      setPaymentMessage(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      if (createOrderAbortRef.current === controller) {
        createOrderAbortRef.current = null;
      }
      if (!controller.signal.aborted && !isMethodSwitch) {
        setCreatingOrder(false);
      }
    }
  };

  useEffect(() => {
    if (!active) return;
    if (!activeOrder) return;
    if (!['created', 'pending'].includes(activeOrder.status)) return;
    let cancelled = false;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const nextOrder = await client.getPaymentOrder(token, activeOrder.order_id, {
          signal: controller.signal,
          timeoutMs: paymentOrderRequestTimeoutMs,
        });
        if (cancelled) return;
        setActiveOrder(nextOrder);
        if (nextOrder.status === 'paid') {
          try {
            await onPaymentSettled?.();
          } catch (error) {
            console.error('[desktop] failed to refresh balance after recharge', error);
          }
          if (cancelled) return;
          setPaymentMessage('支付成功，龙虾币已到账。');
        } else if (nextOrder.status === 'expired') {
          setPaymentMessage('支付订单已过期，请重新创建充值订单。');
        } else if (nextOrder.status === 'failed') {
          setPaymentMessage('支付失败，请重新尝试。');
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setPaymentMessage(error instanceof Error ? error.message : '订单状态刷新失败');
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [active, activeOrder, client, onPaymentSettled, token, paymentOrderRequestTimeoutMs]);

  useEffect(() => {
    if (!active || activeOrder?.status !== 'paid') {
      return;
    }
    const timer = window.setTimeout(() => {
      onClose();
    }, successAutoCloseTimeoutMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, activeOrder?.status, onClose]);

  const openPayment = (packageId: string) => {
    const nextPackage = availablePackages.find((item) => item.packageId === packageId) || null;
    if (!nextPackage) {
      return;
    }
    if (!availablePaymentMethods.length) {
      return;
    }
    flushSync(() => {
      setSelectedPackageId(packageId);
      setPaymentMessage(null);
      setActiveOrder(null);
      setTransitionSnapshot(null);
      setStep('payment');
    });
    void handlePayNow({
      packageConfig: nextPackage,
      provider: paymentMethod,
      transitionSnapshot: null,
    });
  };
  const closePaymentModal = () => {
    cancelPendingCreateOrder();
    setPaymentMessage(null);
    setActiveOrder(null);
    setTransitionSnapshot(null);
    setStep('packages');
  };

  return (
    <div
      className={`${PANEL_OVERLAY_CLASS} ${active ? '' : 'pointer-events-none opacity-0'}`}
      aria-hidden={active ? undefined : true}
      onClick={onClose}
    >
      <div className="relative flex min-h-full w-full items-center justify-center py-4">
        <PackageSelectionView
          packages={availablePackages}
          paymentMethods={availablePaymentMethods}
          selectedPackageId={currentPackage?.packageId || selectedPackageId}
          onPackageSelect={setSelectedPackageId}
          onClose={onClose}
          onContinue={openPayment}
        />

        {step === 'payment' && currentPackage ? (
          <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-[rgba(15,23,42,0.22)] px-4 py-6 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.58)] md:px-8"
            onClick={(event) => {
              event.stopPropagation();
              closePaymentModal();
            }}
          >
            <div className="flex min-h-full w-full items-start justify-center py-4 md:items-center md:py-8">
              <PaymentView
                currentPackage={currentPackage}
                totalPrice={totalPrice}
                paymentMethod={paymentMethod}
                paymentMethods={availablePaymentMethods}
                activeOrder={activeOrder}
                resolvedQrUrl={resolvedQrUrl}
                transitionSnapshot={transitionSnapshot}
                switchingPaymentMethod={switchingPaymentMethod}
                onPaymentMethodChange={(method) => {
                  if (method === paymentMethod) {
                    return;
                  }
                  void handlePayNow({
                    packageConfig: currentPackage,
                    provider: method,
                    transitionSnapshot: resolvedQrUrl
                      ? {
                          paymentMethod,
                          qrUrl: resolvedQrUrl,
                          kind: 'switch',
                        }
                      : null,
                  });
                }}
                onBack={closePaymentModal}
                onClose={closePaymentModal}
                creatingOrder={creatingOrder}
                paymentMessage={paymentMessage}
                onPayNow={handlePayNow}
                onPanelClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PackageSelectionView({
  packages,
  paymentMethods,
  selectedPackageId,
  onPackageSelect,
  onClose,
  onContinue,
}: {
  packages: RechargePackage[];
  paymentMethods: RechargePaymentMethod[];
  selectedPackageId: string;
  onPackageSelect: (packageId: string) => void;
  onClose: () => void;
  onContinue: (packageId: string) => void;
}) {
  const hasPaymentMethods = paymentMethods.length > 0;
  const packageCount = packages.length;
  const wideLayout = packageCount >= 4;
  const ultraWideLayout = packageCount >= 5;
  const modalMaxWidth = ultraWideLayout ? '1720px' : wideLayout ? '1480px' : '1240px';
  const packageGridStyle = packageCount
    ? {gridTemplateColumns: `repeat(${packageCount}, minmax(0, 1fr))`}
    : undefined;

  const handlePackageCardClick = (packageId: string) => {
    onPackageSelect(packageId);
  };

  return (
    <div
      className={cn(
        'mx-auto w-full overflow-hidden rounded-[28px] border border-gray-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-[#2A3442] dark:bg-[linear-gradient(180deg,rgba(18,20,24,0.98)_0%,rgba(15,15,15,0.98)_100%)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]',
        wideLayout ? 'p-6 md:p-8' : 'p-8 md:p-12',
      )}
      style={{maxWidth: `min(calc(100vw - 32px), ${modalMaxWidth})`}}
      data-testid="recharge-package-view"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-[-72px] top-[-88px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,rgba(59,130,246,0)_72%)] dark:bg-[radial-gradient(circle,rgba(59,130,246,0.16)_0%,rgba(59,130,246,0)_72%)]" />
        <div className="pointer-events-none absolute right-[-56px] top-[-24px] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.18)_0%,rgba(168,85,247,0)_70%)] dark:bg-[radial-gradient(circle,rgba(168,85,247,0.16)_0%,rgba(168,85,247,0)_70%)]" />
        <button
          onClick={onClose}
          data-testid="recharge-close"
          className="absolute right-0 top-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-300 dark:hover:bg-[#242424] dark:hover:text-gray-100"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className={cn('text-center', wideLayout ? 'mb-7' : 'mb-10')}>
          <div className={cn('flex flex-wrap items-center justify-center gap-2', wideLayout ? 'mb-3' : 'mb-4')}>
            <span className="inline-flex items-center rounded-full border border-[rgba(59,130,246,0.16)] bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[12px] font-medium text-[#2563EB] dark:border-[rgba(96,165,250,0.22)] dark:bg-[rgba(59,130,246,0.12)] dark:text-[#93C5FD]">
              支付成功后即时到账
            </span>
            <span className="inline-flex items-center rounded-full border border-[rgba(168,85,247,0.16)] bg-[rgba(168,85,247,0.08)] px-3 py-1 text-[12px] font-medium text-[#7E22CE] dark:border-[rgba(168,85,247,0.22)] dark:bg-[rgba(168,85,247,0.12)] dark:text-[#D8B4FE]">
              支持微信 / 支付宝
            </span>
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-[12px] font-medium text-gray-600 dark:border-gray-700 dark:bg-[#181818] dark:text-gray-300">
              一次性充值，不会自动续费
            </span>
          </div>
          <div className={cn('flex items-center justify-center gap-3', wideLayout ? 'mb-1.5' : 'mb-2')}>
            <h1
              className={cn(
                'leading-[1.25] tracking-[-0.02em] text-gray-900 dark:text-gray-50',
                ultraWideLayout ? 'text-[28px]' : wideLayout ? 'text-[29px]' : 'text-[30px]',
              )}
            >
              充值龙虾币
            </h1>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f1d38a] bg-[linear-gradient(180deg,#fff7df_0%,#fde7a7_100%)] text-[#8a5a00] shadow-[0_6px_16px_rgba(180,134,0,0.14)] dark:border-[#5b471b] dark:bg-[linear-gradient(180deg,#3a2f16_0%,#2b220f_100%)] dark:text-[#f2cf75] dark:shadow-none">
              <Coins className="h-4 w-4" />
            </span>
          </div>
          <p
            className={cn(
              'mx-auto text-gray-500 dark:text-gray-400',
              wideLayout ? 'max-w-[920px] text-[14px] leading-6' : 'max-w-[720px] text-[15px] leading-7',
            )}
          >
            选择最适合你的套餐。主推档更适合连续多轮对话、工具调用与高频任务执行，重度使用建议直接囤大包。
          </p>
          {!hasPaymentMethods ? (
            <p className="mt-4 text-[13px] text-amber-600 dark:text-amber-400">
              当前 OEM 尚未启用支付方式，请先在 admin-web 的支付中心完成配置。
            </p>
          ) : null}
        </div>
      </div>

      {packages.length ? (
        <div
          className={cn('mx-auto grid', wideLayout ? 'gap-3.5' : 'max-w-[1120px] gap-5')}
          style={packageGridStyle}
        >
        {packages.map((item) => {
          const selected = item.packageId === selectedPackageId;
          const priceLabel = formatPriceAmount(item.amountCnyFen);
          const meta = getPackageCardMeta(item);
          return (
            <div key={item.packageId} className="relative">
              <div
                role="button"
                aria-pressed={selected}
                tabIndex={0}
                data-testid="recharge-package-card"
                data-package-id={item.packageId}
                onClick={() => handlePackageCardClick(item.packageId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePackageCardClick(item.packageId);
                  }
                }}
                className={cn(
                  'relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border text-left outline-none transition-all duration-200',
                  ultraWideLayout ? 'p-4' : wideLayout ? 'p-5' : 'p-7',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  selected
                    ? 'translate-y-[-2px] border-gray-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:border-gray-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                    : 'hover:border-gray-300 dark:hover:border-[#4B5563]',
                  meta.accentClassName,
                )}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_100%)]" />

                <div className={cn('flex items-start justify-between gap-3', wideLayout ? 'mb-4' : 'mb-5')}>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-xl transition-colors',
                        ultraWideLayout ? 'h-9 w-9' : 'h-10 w-10',
                        meta.iconWrapClassName,
                      )}
                    >
                    {meta.icon}
                    </div>
                    <div>
                      <h3
                        className={cn(
                          'font-semibold tracking-[-0.01em] text-gray-900 dark:text-gray-100',
                          ultraWideLayout ? 'text-[17px]' : wideLayout ? 'text-[18px]' : 'text-[19px]',
                        )}
                      >
                        {item.packageName}
                      </h3>
                      <div
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 font-medium',
                          wideLayout ? 'mt-1.5 text-[10px]' : 'mt-2 text-[11px]',
                          meta.eyebrowClassName,
                        )}
                      >
                        {meta.eyebrowText}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {meta.badgeText ? (
                      <div
                        className={cn(
                          'inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold leading-none',
                          meta.badgeClassName,
                        )}
                      >
                        {meta.badgeText}
                      </div>
                    ) : null}
                    {selected ? (
                      <span className="mt-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] dark:bg-emerald-400 dark:shadow-[0_0_0_4px_rgba(52,211,153,0.14)]" />
                    ) : null}
                  </div>
                </div>

                <div className={cn(wideLayout ? 'mb-4' : 'mb-6')}>
                  <div className="flex items-baseline gap-0.5">
                    <span className={cn('text-gray-500 dark:text-gray-400', wideLayout ? 'text-[14px]' : 'text-[15px]')}>¥</span>
                    <span
                      className={cn(
                        'font-semibold leading-none tracking-tight',
                        ultraWideLayout ? 'text-[34px]' : wideLayout ? 'text-[38px]' : 'text-[42px]',
                        meta.priceGlowClassName,
                      )}
                    >
                      {priceLabel}
                    </span>
                  </div>
                  {item.highlight ? (
                    <div
                      className={cn(
                        'inline-flex rounded-full bg-[rgba(59,130,246,0.10)] px-3 py-1 font-medium text-[#2563EB] dark:bg-[rgba(96,165,250,0.16)] dark:text-[#93C5FD]',
                        wideLayout ? 'mt-2 text-[11px]' : 'mt-3 text-[12px]',
                      )}
                    >
                      {item.highlight}
                    </div>
                  ) : null}
                  {item.description ? (
                    <p className={cn('text-gray-500 dark:text-gray-400', wideLayout ? 'mt-2 text-[12px] leading-5' : 'mt-3 text-[13px] leading-6')}>
                      {item.description}
                    </p>
                  ) : null}
                  {meta.promoText ? (
                    <p
                      className={cn(
                        'font-medium text-gray-600 dark:text-gray-300',
                        wideLayout ? 'mt-1.5 text-[11px] leading-[18px]' : 'mt-2 text-[12px] leading-5',
                      )}
                    >
                      {meta.promoText}
                    </p>
                  ) : null}
                </div>

                <div className={cn('flex-1', wideLayout ? 'mb-5 space-y-2' : 'mb-7 space-y-2.5')}>
                  <div className={cn('flex items-center justify-between', wideLayout ? 'text-[13px]' : 'text-[14px]')}>
                    <span className="text-gray-500 dark:text-gray-400">{item.bonusCredits > 0 ? '基础到账' : '到账数量'}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCreditsLabel(item.credits)}</span>
                  </div>
                  {item.bonusCredits > 0 ? (
                    <div className={cn('flex items-center justify-between', wideLayout ? 'text-[13px]' : 'text-[14px]')}>
                      <span className="text-gray-500 dark:text-gray-400">赠送额度</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">+{formatCreditsLabel(item.bonusCredits)}</span>
                    </div>
                  ) : null}
                  <div className={cn('h-px bg-gray-200/80 dark:bg-gray-800', wideLayout ? 'my-2' : 'my-2.5')} />
                  <div className={cn('flex items-center justify-between pt-1', wideLayout ? 'text-[13px]' : 'text-[14px]')}>
                    <span className="font-medium text-gray-900 dark:text-gray-100">合计到账</span>
                    <span className={cn('font-semibold text-gray-900 dark:text-gray-100', wideLayout ? 'text-[14px]' : 'text-[15px]')}>
                      {formatCreditsLabel(item.totalCredits)} 龙虾币
                    </span>
                  </div>
                  {item.featureList.length ? (
                    <div className={cn('pt-1', wideLayout ? 'mt-3 space-y-1.5' : 'mt-4 space-y-2')}>
                      {item.featureList.slice(0, 5).map((feature, featureIndex) => (
                        <div
                          key={`${item.packageId}-feature-${featureIndex}`}
                          className={cn(
                            'flex items-start gap-2 text-gray-500 dark:text-gray-400',
                            wideLayout ? 'text-[12px] leading-[18px]' : 'text-[13px] leading-5',
                          )}
                        >
                          <span className={cn('shrink-0 rounded-full bg-gray-300 dark:bg-gray-600', wideLayout ? 'mt-[5px] h-1.5 w-1.5' : 'mt-[6px] h-1.5 w-1.5')} />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto">
                  <button
                    type="button"
                    data-testid="recharge-package-continue"
                    data-package-id={item.packageId}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onContinue(item.packageId);
                    }}
                    disabled={!hasPaymentMethods}
                    className={cn(
                      'w-full cursor-pointer rounded-md font-medium transition-colors',
                      wideLayout ? 'py-[9px] text-[15px]' : 'py-2.5 text-[16px]',
                      !hasPaymentMethods && 'cursor-not-allowed opacity-55',
                      meta.ctaClassName,
                    )}
                  >
                    立即充值
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="mx-auto flex max-w-[780px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-10 py-16 text-center dark:border-gray-600 dark:bg-[#181818]">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
            <FolderCog className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-[20px] font-semibold text-gray-900 dark:text-gray-100">暂未配置充值套餐</h2>
          <p className="mt-3 max-w-[520px] text-[14px] leading-7 text-gray-500 dark:text-gray-400">
            当前充值中心不再使用前端写死套餐。请先在 `admin-web` 配置并发布 recharge packages，桌面端会按运行时配置自动展示。
          </p>
        </div>
      )}
    </div>
  );
}

function PaymentView({
  currentPackage,
  totalPrice,
  paymentMethod,
  paymentMethods,
  activeOrder,
  resolvedQrUrl,
  transitionSnapshot,
  switchingPaymentMethod,
  onPaymentMethodChange,
  onBack,
  onClose,
  creatingOrder,
  paymentMessage,
  onPayNow,
  onPanelClick,
}: {
  currentPackage: RechargePackage;
  totalPrice: string;
  paymentMethod: PaymentMethod;
  paymentMethods: RechargePaymentMethod[];
  activeOrder: PaymentOrderData | null;
  resolvedQrUrl: string | null;
  transitionSnapshot: PaymentTransitionSnapshot | null;
  switchingPaymentMethod: boolean;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onBack: () => void;
  onClose: () => void;
  creatingOrder: boolean;
  paymentMessage: string | null;
  onPayNow: () => void;
  onPanelClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const orderStatus = activeOrder?.status || null;
  const expiryLabel = formatPaymentDeadline(activeOrder?.expires_at || null);
  const expiryDeadlineTs = parsePaymentDeadline(activeOrder?.expires_at || null);
  const methodTheme = getPaymentMethodTheme(paymentMethod);
  const currentPaymentMethodConfig = paymentMethods.find((item) => item.provider === paymentMethod) || null;
  const [nowTs, setNowTs] = useState(() => Date.now());
  const isPaid = orderStatus === 'paid';
  const isFailed = orderStatus === 'failed';
  const isRefunded = orderStatus === 'refunded';
  const remainingMs =
    expiryDeadlineTs != null && !isPaid && !isFailed && !isRefunded ? Math.max(0, expiryDeadlineTs - nowTs) : null;
  const hasLocallyExpired = remainingMs === 0 && expiryDeadlineTs != null && !isPaid && !isFailed && !isRefunded;
  const isExpired = orderStatus === 'expired' || hasLocallyExpired;
  const isAwaitingPayment = !creatingOrder && Boolean(activeOrder) && !isPaid && !isFailed && !isExpired;
  const shouldShowQr = Boolean(resolvedQrUrl) && !isPaid && !isFailed && !isExpired;
  const shouldShowExpiredQr = Boolean(resolvedQrUrl) && isExpired && !isPaid && !isFailed;
  const shouldShowTransitionQr =
    Boolean(transitionSnapshot?.qrUrl) &&
    (switchingPaymentMethod || (creatingOrder && !shouldShowQr && !shouldShowExpiredQr)) &&
    !isPaid &&
    !isFailed;
  const countdownLabel = formatCountdownLabel(remainingMs);
  const expiringSoon = isAwaitingPayment && remainingMs != null && remainingMs > 0 && remainingMs <= 60 * 1000;
  const shortOrderId = formatOrderIdShort(activeOrder?.order_id);
  const transitionTitle =
    transitionSnapshot?.kind === 'switch'
      ? `正在切换至 ${getPaymentMethodLabel(paymentMethod, currentPaymentMethodConfig?.label)} 收款码`
      : '正在刷新收款码';
  const transitionDescription =
    transitionSnapshot?.kind === 'switch' ? '当前二维码保持展示，避免卡片闪动。' : '请稍候，新的二维码正在生成。';

  useEffect(() => {
    if (expiryDeadlineTs == null || isPaid || isFailed || isExpired || isRefunded) {
      return;
    }
    setNowTs(Date.now());
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [expiryDeadlineTs, isExpired, isFailed, isPaid, isRefunded]);

  const statusCard = creatingOrder
    ? {
        icon: LoaderCircle,
        iconClassName: 'animate-spin',
        text: '订单创建中',
        textColor: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-900',
      }
    : isPaid
      ? {
          icon: CheckCircle2,
          iconClassName: '',
          text: '支付成功',
          textColor: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950/30',
          borderColor: 'border-green-200 dark:border-green-900',
        }
      : isFailed
        ? {
            icon: AlertCircle,
            iconClassName: '',
            text: '支付失败',
            textColor: 'text-red-700 dark:text-red-400',
            bgColor: 'bg-red-50 dark:bg-red-950/30',
            borderColor: 'border-red-200 dark:border-red-900',
          }
        : isExpired
          ? {
              icon: Clock3,
              iconClassName: '',
              text: '二维码已过期',
              textColor: 'text-gray-600 dark:text-gray-400',
              bgColor: 'bg-gray-50 dark:bg-gray-900/30',
              borderColor: 'border-gray-200 dark:border-gray-800',
            }
          : isAwaitingPayment
            ? {
                icon: Clock3,
                iconClassName: '',
                text: expiringSoon ? '即将过期' : '等待支付',
                textColor: expiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-amber-700 dark:text-amber-400',
                bgColor: expiringSoon ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
                borderColor: expiringSoon ? 'border-orange-200 dark:border-orange-900' : 'border-amber-200 dark:border-amber-900',
              }
            : {
                icon: Clock3,
                iconClassName: '',
                text: '等待创建订单',
                textColor: 'text-gray-600 dark:text-gray-400',
                bgColor: 'bg-gray-50 dark:bg-gray-900/30',
                borderColor: 'border-gray-200 dark:border-gray-800',
              };
  const StatusIcon = statusCard.icon;
  const showStatusAction =
    !creatingOrder &&
    !switchingPaymentMethod &&
    !isPaid &&
    (isFailed || (!activeOrder && Boolean(paymentMessage)) || (isExpired && !resolvedQrUrl));

  const handlePrimaryAction = () => {
    if (!isAwaitingPayment || isFailed || isExpired || !activeOrder) {
      onPayNow();
    }
  };

  return (
    <div
      className="relative h-[calc(100vh-32px)] max-h-[720px] w-[1040px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[28px] border border-gray-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-[#253042] dark:bg-[linear-gradient(180deg,rgba(18,20,24,0.98)_0%,rgba(15,15,15,0.98)_100%)] dark:shadow-[0_24px_90px_rgba(0,0,0,0.48)]"
      data-testid="recharge-payment-view"
      onClick={onPanelClick}
    >
      <div className="pointer-events-none absolute left-[-72px] top-[-72px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16)_0%,rgba(59,130,246,0)_72%)] dark:bg-[radial-gradient(circle,rgba(59,130,246,0.14)_0%,rgba(59,130,246,0)_72%)]" />
      <div className="pointer-events-none absolute right-[-48px] top-[-8px] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.16)_0%,rgba(168,85,247,0)_72%)] dark:bg-[radial-gradient(circle,rgba(168,85,247,0.14)_0%,rgba(168,85,247,0)_72%)]" />
      <button
        onClick={onClose}
        data-testid="recharge-payment-close"
        className="absolute right-5 top-5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200/80 bg-white/80 text-gray-400 shadow-sm backdrop-blur-sm transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-gray-700 dark:bg-[#191919]/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-full min-h-0">
        <div className="relative flex w-[60%] min-h-0 flex-col border-r border-gray-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.94)_100%)] p-7 dark:border-[#263241] dark:bg-[linear-gradient(180deg,rgba(10,10,10,0.98)_0%,rgba(14,18,24,0.98)_100%)]">
          <div className="mb-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[12px] font-medium text-[#2563EB] dark:border-[rgba(96,165,250,0.22)] dark:bg-[rgba(59,130,246,0.12)] dark:text-[#93C5FD]">
                扫码即可完成支付
              </span>
              <span className="inline-flex items-center rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-3 py-1 text-[12px] font-medium text-[#15803D] dark:border-[rgba(74,222,128,0.20)] dark:bg-[rgba(34,197,94,0.12)] dark:text-[#86EFAC]">
                支付成功后即时到账
              </span>
            </div>
            <h2 className="mb-2 text-[22px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-50">扫码支付</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] text-gray-500 dark:text-gray-400">应付金额</span>
              <span className="text-[34px] font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-50">¥{totalPrice}</span>
            </div>
            <div
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-sm',
                methodTheme.accentBorderClassName,
                methodTheme.accentBgClassName,
                methodTheme.accentTextClassName,
              )}
            >
              <PaymentMethodLogo
                paymentMethod={paymentMethod}
                className="h-4 w-4 rounded-[4px] border-white/80 bg-white shadow-none dark:border-white/80"
                imageClassName={paymentMethod === 'wechat_qr' ? 'p-[2px]' : 'p-px'}
              />
              {getPaymentMethodLabel(paymentMethod, currentPaymentMethodConfig?.label)}
            </div>
            <p className="mt-3 max-w-[440px] text-[13px] leading-6 text-gray-500 dark:text-gray-400">
              请使用 {getPaymentMethodLabel(paymentMethod, currentPaymentMethodConfig?.label)} 扫描下方二维码完成充值。付款完成后，龙虾币会自动同步到账。
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center" data-testid="recharge-payment-qr-stage">
            <div className="relative">
              {shouldShowTransitionQr ? (
                <div className="relative">
                  <BrandedPaymentQr
                    paymentMethod={transitionSnapshot!.paymentMethod}
                    qrUrl={transitionSnapshot!.qrUrl}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(255,255,255,0.74)] backdrop-blur-[2px] dark:bg-[rgba(10,10,10,0.68)]"
                    data-testid="recharge-qr-transition-mask"
                    data-transition-kind={transitionSnapshot?.kind || 'refresh'}
                  >
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/80 bg-white/90 px-5 py-4 text-center shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#151515]/92 dark:shadow-[0_12px_32px_rgba(0,0,0,0.42)]">
                      <LoaderCircle className="h-6 w-6 animate-spin text-gray-700 dark:text-gray-200" />
                      <div
                        className="text-[14px] font-semibold text-gray-900 dark:text-gray-100"
                        data-testid="recharge-qr-transition-title"
                      >
                        {transitionTitle}
                      </div>
                      <p className="max-w-[220px] text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                        {transitionDescription}
                      </p>
                    </div>
                  </div>
                </div>
              ) : creatingOrder ? (
                <div className="rounded-lg border border-gray-200/80 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                  <div className="flex h-[min(280px,32vh)] w-[min(280px,32vh)] items-center justify-center rounded-md bg-gray-50 dark:bg-[#101010]">
                    <LoaderCircle className="h-7 w-7 animate-spin text-gray-600 dark:text-gray-400" />
                  </div>
                </div>
              ) : shouldShowExpiredQr ? (
                <BrandedPaymentQr paymentMethod={paymentMethod} qrUrl={resolvedQrUrl!} expired onRefresh={handlePrimaryAction} />
              ) : shouldShowQr ? (
                <BrandedPaymentQr paymentMethod={paymentMethod} qrUrl={resolvedQrUrl!} />
              ) : (
                <div className="rounded-lg border border-gray-200/80 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                  <div className="flex h-[min(280px,32vh)] w-[min(280px,32vh)] flex-col items-center justify-center rounded-md bg-gray-50 dark:bg-[#101010]">
                    <Clock3 className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">正在准备收款码</p>
                  </div>
                </div>
              )}

              {isPaid ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg border border-green-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-green-900 dark:bg-[#1A1A1A] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                        <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-500" />
                      </div>
                      <div className="text-center">
                        <div className="mb-1 text-[20px] font-semibold text-gray-900 dark:text-gray-50">支付成功</div>
                        <div className="text-[14px] text-gray-500 dark:text-gray-400">龙虾币已到账</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {isFailed ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg border border-red-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-red-900 dark:bg-[#1A1A1A] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                        <AlertCircle className="h-9 w-9 text-red-600 dark:text-red-500" />
                      </div>
                      <div className="text-center">
                        <div className="mb-1 text-[20px] font-semibold text-gray-900 dark:text-gray-50">支付失败</div>
                        <div className="text-[14px] text-gray-500 dark:text-gray-400">请重新尝试</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1 text-center">
            <p className="text-[14px] text-gray-600 dark:text-gray-300">{methodTheme.instruction}</p>
            {(isAwaitingPayment || expiringSoon) && countdownLabel ? (
              <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                {expiringSoon ? '⚠️ ' : ''}
                二维码有效期 {countdownLabel}
              </p>
            ) : null}
            {paymentMessage ? <p className="text-[12px] text-gray-500 dark:text-gray-400">{paymentMessage}</p> : null}
          </div>
        </div>

        <div className="flex w-[40%] min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.96)_100%)] p-6 pt-16 dark:bg-[linear-gradient(180deg,rgba(20,20,20,0.98)_0%,rgba(17,17,17,0.98)_100%)]">
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">订单信息</h3>
              <span className="inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-[#1A1A1A] dark:text-gray-300">
                {currentPackage.badgeLabel || currentPackage.packageName}
              </span>
            </div>
            <div className="space-y-3 rounded-[20px] border border-gray-200/70 bg-white/90 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-500 dark:text-gray-400">套餐</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{currentPackage.packageName}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-500 dark:text-gray-400">金额</span>
                <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">¥{totalPrice}</span>
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-800" />
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-500 dark:text-gray-400">到账龙虾币</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCreditsLabel(currentPackage.totalCredits)}</span>
              </div>
              {shortOrderId ? (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500 dark:text-gray-400">订单编号</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{shortOrderId}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-5">
            <h3 className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">支付方式</h3>
            <div className="space-y-2">
              {paymentMethods.map((methodConfig) => {
                const method = methodConfig.provider;
                const selected = paymentMethod === method;
                const optionTheme = getPaymentMethodTheme(method);
                return (
                  <button
                    key={method}
                    onClick={() => onPaymentMethodChange(method)}
                    disabled={creatingOrder || switchingPaymentMethod || isPaid}
                    data-testid="recharge-payment-method"
                    data-payment-method={method}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-all',
                      creatingOrder || switchingPaymentMethod || isPaid ? 'cursor-not-allowed opacity-60' : '',
                      selected
                        ? optionTheme.optionSelectedClassName
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#31343A] dark:bg-[#1A1A1A] dark:hover:border-[#4B5563]',
                    )}
                  >
                    <div
                      className="shrink-0"
                    >
                      <PaymentMethodLogo
                        paymentMethod={method}
                        className="h-9 w-9 rounded-md"
                        imageClassName={method === 'wechat_qr' ? 'p-1.5' : 'p-0.5'}
                      />
                    </div>
                    <span className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
                      {getPaymentMethodLabel(method, methodConfig.label)}
                    </span>
                    {selected ? (
                      <div
                        className={cn(
                          'ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                          optionTheme.optionSelectedDotClassName,
                        )}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <h3 className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">支付状态</h3>
            <div className={cn('flex items-center gap-2.5 rounded-xl border p-3.5', statusCard.bgColor, statusCard.borderColor)}>
              <div className={statusCard.textColor}>
                <StatusIcon className={cn('h-4 w-4', statusCard.iconClassName)} />
              </div>
              <span className={cn('text-[13px] font-medium', statusCard.textColor)}>{statusCard.text}</span>
            </div>
            {expiryLabel && !isPaid ? <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">有效至 {expiryLabel}</p> : null}
          </div>

          <div className="mb-4 mt-auto space-y-1.5 rounded-[20px] border border-gray-200/70 bg-white/90 p-3.5 text-[12px] text-gray-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:text-gray-300 dark:shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-400" />
              <span>官方扫码通道，安全可靠</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-400" />
              <span>支付结果自动同步</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-400" />
              <span>支付成功后即时到账</span>
            </div>
          </div>

          <div className="space-y-2">
            {showStatusAction ? (
              <button
                type="button"
                onClick={handlePrimaryAction}
                data-testid="recharge-payment-primary-action"
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-medium transition-colors shadow-sm',
                  PRIMARY_ACTION_BUTTON_CLASS,
                )}
              >
                <RefreshCw className="h-4 w-4" />
                <span>重试创建订单</span>
              </button>
            ) : null}
            <button
              onClick={onBack}
              data-testid="recharge-back-to-packages"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-medium transition-colors',
                SECONDARY_ACTION_BUTTON_CLASS,
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回套餐页</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
