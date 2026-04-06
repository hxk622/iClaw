import {type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Coins,
  Crown,
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

const PANEL_OVERLAY_CLASS =
  'fixed inset-0 z-50 overflow-y-auto bg-[rgba(8,12,20,0.24)] p-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.44)] md:p-8';

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

function getPackageCardMeta(item: RechargePackage, index: number, total: number) {
  if (item.recommended || item.default) {
    return {
      icon: <Zap className="h-5 w-5" />,
      badgeText: item.badgeLabel || '最受欢迎',
      badgeClassName: 'bg-blue-600 text-white dark:bg-blue-500',
      accentClassName:
        'border-[rgba(59,130,246,0.42)] bg-[linear-gradient(180deg,rgba(239,246,255,0.94)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_20px_50px_rgba(59,130,246,0.16)] dark:border-[rgba(96,165,250,0.4)] dark:bg-[linear-gradient(180deg,rgba(26,38,64,0.96)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_20px_50px_rgba(37,99,235,0.18)]',
      iconWrapClassName:
        'bg-[linear-gradient(180deg,rgba(59,130,246,0.18)_0%,rgba(99,102,241,0.20)_100%)] text-[#2563EB] dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.22)_0%,rgba(99,102,241,0.28)_100%)] dark:text-[#93C5FD]',
      eyebrowText: '超值推荐',
      eyebrowClassName:
        'border border-[rgba(96,165,250,0.24)] bg-[rgba(59,130,246,0.10)] text-[#2563EB] dark:border-[rgba(96,165,250,0.30)] dark:bg-[rgba(59,130,246,0.14)] dark:text-[#93C5FD]',
      promoText: '高频用户主力包，连续对话和任务执行更划算',
      priceGlowClassName: 'text-[#111827] dark:text-white',
      ctaClassName:
        'bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] !text-white hover:brightness-110 dark:border-none dark:bg-[linear-gradient(135deg,#3B82F6_0%,#6366F1_100%)] dark:!text-white',
    };
  }
  if (index === total - 1) {
    return {
      icon: <Crown className="h-5 w-5" />,
      badgeText: item.badgeLabel || '超值推荐',
      badgeClassName: 'bg-purple-600 text-white dark:bg-purple-500',
      accentClassName:
        'border-[rgba(168,85,247,0.34)] bg-[linear-gradient(180deg,rgba(250,245,255,0.94)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_16px_44px_rgba(168,85,247,0.12)] dark:border-[rgba(168,85,247,0.32)] dark:bg-[linear-gradient(180deg,rgba(48,24,66,0.96)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_20px_46px_rgba(168,85,247,0.16)]',
      iconWrapClassName:
        'bg-[linear-gradient(180deg,rgba(168,85,247,0.16)_0%,rgba(217,70,239,0.18)_100%)] text-[#7E22CE] dark:bg-[linear-gradient(180deg,rgba(168,85,247,0.24)_0%,rgba(217,70,239,0.24)_100%)] dark:text-[#D8B4FE]',
      eyebrowText: '长期储备',
      eyebrowClassName:
        'border border-[rgba(168,85,247,0.24)] bg-[rgba(168,85,247,0.08)] text-[#7E22CE] dark:border-[rgba(168,85,247,0.30)] dark:bg-[rgba(168,85,247,0.14)] dark:text-[#D8B4FE]',
      promoText: '单价更优，适合重度用户囤币和长期使用',
      priceGlowClassName: 'text-[#111827] dark:text-white',
      ctaClassName:
        'bg-[linear-gradient(135deg,#6D28D9_0%,#9333EA_100%)] !text-white hover:brightness-110 dark:border-none dark:bg-[linear-gradient(135deg,#7C3AED_0%,#A855F7_100%)] dark:!text-white',
    };
  }
  return {
    icon: <Sparkles className="h-5 w-5" />,
    badgeText: null,
    badgeClassName: '',
    accentClassName:
      'border-gray-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,250,251,0.98)_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-[#2F3742] dark:bg-[linear-gradient(180deg,rgba(26,26,26,0.98)_0%,rgba(20,20,20,0.98)_100%)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.26)]',
    iconWrapClassName: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    eyebrowText: '轻量续航',
    eyebrowClassName:
      'border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-[#1E1E1E] dark:text-gray-300',
    promoText: '轻松补能，适合日常对话、试用和临时续航',
    priceGlowClassName: 'text-gray-900 dark:text-gray-50',
    ctaClassName: PRIMARY_ACTION_BUTTON_CLASS,
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
        className={cn('relative h-[280px] w-[280px] overflow-hidden rounded-md', methodTheme.qrStageClassName)}
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
  const [activeOrder, setActiveOrder] = useState<PaymentOrderData | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [generatedLaunchQrUrl, setGeneratedLaunchQrUrl] = useState<string | null>(null);
  const [autoCreateOrderToken, setAutoCreateOrderToken] = useState(0);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
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

  const cancelPendingCreateOrder = () => {
    createOrderAbortRef.current?.abort();
    createOrderAbortRef.current = null;
    setCreatingOrder(false);
  };

  useEffect(() => () => cancelPendingCreateOrder(), []);

  const handlePayNow = async () => {
    if (!currentPackage) {
      setPaymentMessage('当前未配置可充值套餐，请先在 admin-web 发布充值配置。');
      return;
    }
    cancelPendingCreateOrder();
    const controller = new AbortController();
    createOrderAbortRef.current = controller;
    setCreatingOrder(true);
    setPaymentMessage(null);
    setActiveOrder(null);
    setGeneratedLaunchQrUrl(null);

    try {
      const order = await client.createPaymentOrder({
        token,
        provider: paymentMethod,
        packageId: currentPackage.packageId,
        returnUrl: 'iclaw://payments/result',
        appName,
        signal: controller.signal,
        timeoutMs: paymentOrderRequestTimeoutMs,
      });
      if (controller.signal.aborted) {
        return;
      }
      setActiveOrder(order);
      if (order.payment_url) {
        setPaymentMessage('支付二维码已就绪，请直接扫码完成支付。');
      } else {
        setPaymentMessage('支付订单已创建，但未返回支付入口。');
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setPaymentMessage(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      if (createOrderAbortRef.current === controller) {
        createOrderAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setCreatingOrder(false);
      }
    }
  };

  useEffect(() => {
    if (!active) return;
    if (step !== 'payment') return;
    if (creatingOrder) return;
    if (activeOrder) return;
    if (autoCreateOrderToken <= 0) return;
    void handlePayNow();
  }, [active, step, creatingOrder, activeOrder, autoCreateOrderToken]);

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
    if (!availablePackages.some((item) => item.packageId === packageId)) {
      return;
    }
    if (!availablePaymentMethods.length) {
      return;
    }
    flushSync(() => {
      setSelectedPackageId(packageId);
      setPaymentMessage(null);
      setActiveOrder(null);
      setStep('payment');
      setAutoCreateOrderToken((current) => current + 1);
    });
  };
  const closePaymentModal = () => {
    cancelPendingCreateOrder();
    setPaymentMessage(null);
    setActiveOrder(null);
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
            <div className="flex min-h-full w-full items-center justify-center">
              <PaymentView
                currentPackage={currentPackage}
                totalPrice={totalPrice}
                paymentMethod={paymentMethod}
                paymentMethods={availablePaymentMethods}
                activeOrder={activeOrder}
                resolvedQrUrl={resolvedQrUrl}
                onPaymentMethodChange={(method) => {
                  cancelPendingCreateOrder();
                  setPaymentMethod(method);
                  setActiveOrder(null);
                  setPaymentMessage(null);
                  setAutoCreateOrderToken((current) => current + 1);
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

  const handlePackageCardClick = (packageId: string) => {
    onPackageSelect(packageId);
  };

  return (
    <div
      className="mx-auto w-full max-w-[1240px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-[28px] border border-gray-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-8 shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-[#2A3442] dark:bg-[linear-gradient(180deg,rgba(18,20,24,0.98)_0%,rgba(15,15,15,0.98)_100%)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)] md:p-12"
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

        <div className="mb-10 text-center">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
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
          <div className="mb-2 flex items-center justify-center gap-3">
            <h1 className="text-[30px] leading-[1.25] tracking-[-0.02em] text-gray-900 dark:text-gray-50">充值龙虾币</h1>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f1d38a] bg-[linear-gradient(180deg,#fff7df_0%,#fde7a7_100%)] text-[#8a5a00] shadow-[0_6px_16px_rgba(180,134,0,0.14)] dark:border-[#5b471b] dark:bg-[linear-gradient(180deg,#3a2f16_0%,#2b220f_100%)] dark:text-[#f2cf75] dark:shadow-none">
              <Coins className="h-4 w-4" />
            </span>
          </div>
          <p className="mx-auto max-w-[720px] text-[15px] leading-7 text-gray-500 dark:text-gray-400">
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
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((item, index) => {
          const selected = item.packageId === selectedPackageId;
          const priceLabel = formatPriceAmount(item.amountCnyFen);
          const meta = getPackageCardMeta(item, index, packages.length);
          return (
            <div
              key={item.packageId}
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
                'relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border p-7 text-left outline-none transition-all duration-200',
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
                selected
                  ? 'translate-y-[-2px] border-gray-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:border-gray-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                  : 'hover:border-gray-300 dark:hover:border-[#4B5563]',
                meta.accentClassName,
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_100%)]" />
              {meta.badgeText ? (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <div className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide', meta.badgeClassName)}>
                    {meta.badgeText}
                  </div>
                </div>
              ) : null}

              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-colors', meta.iconWrapClassName)}>
                  {meta.icon}
                  </div>
                  <div>
                    <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-gray-100">{item.packageName}</h3>
                    <div className={cn('mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium', meta.eyebrowClassName)}>
                      {meta.eyebrowText}
                    </div>
                  </div>
                </div>
                {selected ? (
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] dark:bg-emerald-400 dark:shadow-[0_0_0_4px_rgba(52,211,153,0.14)]" />
                ) : null}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[15px] text-gray-500 dark:text-gray-400">¥</span>
                  <span className={cn('text-[42px] font-semibold leading-none tracking-tight', meta.priceGlowClassName)}>{priceLabel}</span>
                </div>
                {item.highlight ? (
                  <div className="mt-3 inline-flex rounded-full bg-[rgba(59,130,246,0.10)] px-3 py-1 text-[12px] font-medium text-[#2563EB] dark:bg-[rgba(96,165,250,0.16)] dark:text-[#93C5FD]">
                    {item.highlight}
                  </div>
                ) : null}
                {item.description ? (
                  <p className="mt-3 text-[13px] leading-6 text-gray-500 dark:text-gray-400">{item.description}</p>
                ) : null}
                {meta.promoText ? (
                  <p className="mt-2 text-[12px] font-medium leading-5 text-gray-600 dark:text-gray-300">{meta.promoText}</p>
                ) : null}
              </div>

              <div className="mb-7 flex-1 space-y-2.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-gray-500 dark:text-gray-400">{item.bonusCredits > 0 ? '基础到账' : '到账数量'}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatCreditsLabel(item.credits)}</span>
                </div>
                {item.bonusCredits > 0 ? (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-gray-500 dark:text-gray-400">赠送额度</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">+{formatCreditsLabel(item.bonusCredits)}</span>
                  </div>
                ) : null}
                <div className="my-2.5 h-px bg-gray-200/80 dark:bg-gray-800" />
                <div className="flex items-center justify-between pt-1 text-[14px]">
                  <span className="font-medium text-gray-900 dark:text-gray-100">合计到账</span>
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                    {formatCreditsLabel(item.totalCredits)} 龙虾币
                  </span>
                </div>
                {item.featureList.length ? (
                  <div className="mt-4 space-y-2 pt-1">
                    {item.featureList.slice(0, 5).map((feature, featureIndex) => (
                      <div
                        key={`${item.packageId}-feature-${featureIndex}`}
                        className="flex items-start gap-2 text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                      >
                        <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
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
                    'w-full cursor-pointer rounded-md py-2.5 text-[16px] font-medium transition-colors',
                    !hasPaymentMethods && 'cursor-not-allowed opacity-55',
                    meta.ctaClassName,
                  )}
                >
                  立即充值
                </button>
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
  const countdownLabel = formatCountdownLabel(remainingMs);
  const expiringSoon = isAwaitingPayment && remainingMs != null && remainingMs > 0 && remainingMs <= 60 * 1000;
  const shortOrderId = formatOrderIdShort(activeOrder?.order_id);

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
    !creatingOrder && !isPaid && (isFailed || (!activeOrder && Boolean(paymentMessage)) || (isExpired && !resolvedQrUrl));

  const handlePrimaryAction = () => {
    if (!isAwaitingPayment || isFailed || isExpired || !activeOrder) {
      onPayNow();
    }
  };

  return (
    <div
      className="relative h-auto max-h-[calc(100vh-48px)] w-[1000px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-gray-800 dark:bg-[#141414] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      data-testid="recharge-payment-view"
      onClick={onPanelClick}
    >
      <button
        onClick={onClose}
        data-testid="recharge-payment-close"
        className="absolute right-5 top-5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-full">
        <div className="flex w-[60%] flex-col border-r border-gray-200 bg-gray-50 p-10 dark:border-gray-800 dark:bg-[#0A0A0A]">
          <div className="mb-8">
            <h2 className="mb-3 text-[20px] font-semibold text-gray-900 dark:text-gray-50">扫码支付</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] text-gray-500 dark:text-gray-400">应付金额</span>
              <span className="text-[32px] font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-50">¥{totalPrice}</span>
            </div>
            <div
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] font-medium',
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
          </div>

          <div className="flex flex-1 items-center justify-center" data-testid="recharge-payment-qr-stage">
            <div className="relative">
              {creatingOrder ? (
                <div className="rounded-lg border border-gray-200/80 bg-white p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-md bg-gray-50 dark:bg-[#101010]">
                    <LoaderCircle className="h-7 w-7 animate-spin text-gray-600 dark:text-gray-400" />
                  </div>
                </div>
              ) : shouldShowExpiredQr ? (
                <BrandedPaymentQr paymentMethod={paymentMethod} qrUrl={resolvedQrUrl!} expired onRefresh={handlePrimaryAction} />
              ) : shouldShowQr ? (
                <BrandedPaymentQr paymentMethod={paymentMethod} qrUrl={resolvedQrUrl!} />
              ) : (
                <div className="rounded-lg border border-gray-200/80 bg-white p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-[#1A1A1A] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                  <div className="flex h-[280px] w-[280px] flex-col items-center justify-center rounded-md bg-gray-50 dark:bg-[#101010]">
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

          <div className="space-y-1.5 text-center">
            <p className="text-[14px] text-gray-600 dark:text-gray-300">{methodTheme.instruction}</p>
            {(isAwaitingPayment || expiringSoon) && countdownLabel ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                {expiringSoon ? '⚠️ ' : ''}
                二维码有效期 {countdownLabel}
              </p>
            ) : null}
            {paymentMessage ? <p className="text-[12px] text-gray-500 dark:text-gray-400">{paymentMessage}</p> : null}
          </div>
        </div>

        <div className="flex w-[40%] flex-col bg-white p-8 dark:bg-[#141414]">
          <div className="mb-7">
            <h3 className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">订单信息</h3>
            <div className="space-y-2.5 rounded-md border border-gray-200/50 bg-gray-50 p-4 dark:border-gray-800 dark:bg-[#1A1A1A]">
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

          <div className="mb-7">
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
                    disabled={creatingOrder || isPaid}
                    data-testid="recharge-payment-method"
                    data-payment-method={method}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-all',
                      creatingOrder || isPaid ? 'cursor-not-allowed opacity-60' : '',
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

          <div className="mb-7">
            <h3 className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">支付状态</h3>
            <div className={cn('flex items-center gap-2.5 rounded-md border p-3', statusCard.bgColor, statusCard.borderColor)}>
              <div className={statusCard.textColor}>
                <StatusIcon className={cn('h-4 w-4', statusCard.iconClassName)} />
              </div>
              <span className={cn('text-[13px] font-medium', statusCard.textColor)}>{statusCard.text}</span>
            </div>
            {expiryLabel && !isPaid ? <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">有效至 {expiryLabel}</p> : null}
          </div>

          <div className="mb-5 mt-auto space-y-2 text-[12px] text-gray-500 dark:text-gray-300">
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
                  'flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[14px] font-medium transition-colors',
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
                'flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[14px] font-medium transition-colors',
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
