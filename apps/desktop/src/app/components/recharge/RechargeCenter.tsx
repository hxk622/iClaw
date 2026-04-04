import {type MouseEvent as ReactMouseEvent, type RefObject, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react';
import {type IClawClient, type PaymentOrderData} from '@iclaw/sdk';
import {cn} from '@/app/lib/cn';
import {type ResolvedRechargePackageConfig, resolveRechargePackageConfig} from '@/app/lib/oem-runtime';
import {INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE} from '@/app/lib/ui-interactions';

type PaymentMethod = 'wechat_qr' | 'alipay_qr';
type RechargeStep = 'packages' | 'payment';
type RechargePackage = ResolvedRechargePackageConfig;

const FALLBACK_RECHARGE_PACKAGES: RechargePackage[] = [
  {
    packageId: 'topup_1000',
    packageName: '1000 龙虾币',
    credits: 1000,
    bonusCredits: 100,
    totalCredits: 1100,
    amountCnyFen: 1000,
    sortOrder: 10,
    recommended: false,
    default: false,
    description: '轻量补充，适合临时续航。',
    badgeLabel: '入门',
    highlight: '实得 1,100 龙虾币',
    featureList: ['基础到账 1,000 龙虾币', '额外赠送 100 龙虾币', '一次性充值，不会自动续费'],
    metadata: {},
  },
  {
    packageId: 'topup_3000',
    packageName: '3000 龙虾币',
    credits: 3000,
    bonusCredits: 400,
    totalCredits: 3400,
    amountCnyFen: 3000,
    sortOrder: 20,
    recommended: true,
    default: true,
    description: '主力充值包，覆盖日常高频使用。',
    badgeLabel: '最常用',
    highlight: '实得 3,400 龙虾币',
    featureList: ['基础到账 3,000 龙虾币', '额外赠送 400 龙虾币', '一次性充值，不会自动续费'],
    metadata: {},
  },
  {
    packageId: 'topup_5000',
    packageName: '5000 龙虾币',
    credits: 5000,
    bonusCredits: 800,
    totalCredits: 5800,
    amountCnyFen: 5000,
    sortOrder: 30,
    recommended: false,
    default: false,
    description: '高频工作流补能，适合持续重度使用。',
    badgeLabel: '高配',
    highlight: '实得 5,800 龙虾币',
    featureList: ['基础到账 5,000 龙虾币', '额外赠送 800 龙虾币', '一次性充值，不会自动续费'],
    metadata: {},
  },
];

const PAYMENT_METHOD_META: Record<PaymentMethod, {label: string; accentClassName: string}> = {
  wechat_qr: {label: '微信支付', accentClassName: 'bg-[#07C160] text-white shadow-lg shadow-green-900/30'},
  alipay_qr: {label: '支付宝', accentClassName: 'bg-[#1677FF] text-white shadow-lg shadow-blue-900/30'},
};

const PANEL_OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.24)] p-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.44)] md:p-8';

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

function resolveOrderStatusLabel(status: PaymentOrderData['status']): string {
  switch (status) {
    case 'paid':
      return '已支付';
    case 'failed':
      return '支付失败';
    case 'expired':
      return '已过期';
    case 'refunded':
      return '已退款';
    case 'created':
      return '待支付';
    case 'pending':
      return '支付中';
    default:
      return status;
  }
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

function PaymentBrandLogo({paymentMethod}: {paymentMethod: PaymentMethod}) {
  if (paymentMethod === 'alipay_qr') {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#1677FF] shadow-[0_14px_28px_rgba(22,119,255,0.28)] ring-4 ring-white/92">
        <span className="text-[44px] font-black leading-none tracking-[-0.08em] text-white">支</span>
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#07C160] shadow-[0_14px_28px_rgba(7,193,96,0.28)] ring-4 ring-white/92">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9">
        <path
          fill="#FFFFFF"
          d="M8.37 4.4C4.31 4.4 1 7.16 1 10.54c0 1.95 1.08 3.68 2.76 4.82l-.7 2.43 2.63-1.3c.88.2 1.79.3 2.68.3 4.06 0 7.37-2.76 7.37-6.15S12.43 4.4 8.37 4.4Zm-2.46 5.08a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.92 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
        />
        <path
          fill="#FFFFFF"
          d="M16.88 9.38c-3.39 0-6.12 2.28-6.12 5.1 0 1.52.8 2.89 2.07 3.82l-.56 1.96 2.1-1.04c.81.18 1.49.22 2.51.22 3.38 0 6.12-2.28 6.12-5.1s-2.74-4.96-6.12-4.96Zm-2.04 4.23a.67.67 0 1 1 0-1.34.67.67 0 0 1 0 1.34Zm4.07 0a.67.67 0 1 1 0-1.34.67.67 0 0 1 0 1.34Z"
        />
      </svg>
    </div>
  );
}

function PaymentScanBadge({paymentMethod}: {paymentMethod: PaymentMethod}) {
  return (
    <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-white/92 px-4 py-2 text-xs font-medium text-[#1f2937] shadow-[0_12px_24px_rgba(15,23,42,0.10)]">
      <ScanLine className="h-4 w-4" />
      <span>{paymentMethod === 'wechat_qr' ? '微信扫一扫' : '支付宝扫一扫'}</span>
    </div>
  );
}

function BrandedPaymentQr({
  paymentMethod,
  qrUrl,
}: {
  paymentMethod: PaymentMethod;
  qrUrl: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_28px_60px_rgba(15,23,42,0.14)]">
        <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0))]" />
        <img
          src={qrUrl}
          alt={`${paymentMethod === 'wechat_qr' ? '微信' : '支付宝'}支付二维码`}
          className="relative block h-64 w-64 rounded-[24px] object-contain"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PaymentBrandLogo paymentMethod={paymentMethod} />
        </div>
      </div>
      <PaymentScanBadge paymentMethod={paymentMethod} />
    </div>
  );
}

function getDefaultPackageId(packages: RechargePackage[]): string {
  return (
    packages.find((item) => item.default)?.packageId ||
    packages.find((item) => item.recommended)?.packageId ||
    packages[0]?.packageId ||
    FALLBACK_RECHARGE_PACKAGES[0]!.packageId
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
  const successAutoCloseTimeoutMs = 3_000;
  const paymentOrderRequestTimeoutMs = 8_000;
  const [step, setStep] = useState<RechargeStep>('packages');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wechat_qr');
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PaymentOrderData | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [generatedLaunchQrUrl, setGeneratedLaunchQrUrl] = useState<string | null>(null);
  const [autoCreateOrderToken, setAutoCreateOrderToken] = useState(0);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(getDefaultPackageId(FALLBACK_RECHARGE_PACKAGES));
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createOrderAbortRef = useRef<AbortController | null>(null);

  const availablePackages = useMemo(() => {
    const resolved = resolveRechargePackageConfig(runtimeConfig);
    return resolved && resolved.length ? resolved : FALLBACK_RECHARGE_PACKAGES;
  }, [runtimeConfig]);
  const defaultPackageId = useMemo(() => getDefaultPackageId(availablePackages), [availablePackages]);
  const currentPackage =
    useMemo(
      () =>
        availablePackages.find((item) => item.packageId === selectedPackageId) ||
        availablePackages.find((item) => item.packageId === defaultPackageId) ||
        availablePackages[0] ||
        FALLBACK_RECHARGE_PACKAGES[0]!,
      [availablePackages, defaultPackageId, selectedPackageId],
    ) || FALLBACK_RECHARGE_PACKAGES[0]!;
  const totalPrice = formatPriceAmount(currentPackage.amountCnyFen);
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
    if (availablePackages.some((item) => item.packageId === selectedPackageId)) {
      return;
    }
    setSelectedPackageId(defaultPackageId);
  }, [availablePackages, defaultPackageId, selectedPackageId]);

  useEffect(() => {
    if (!active) return;
    if (!packageDropdownOpen) return;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPackageDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [active, packageDropdownOpen]);

  const cancelPendingCreateOrder = () => {
    createOrderAbortRef.current?.abort();
    createOrderAbortRef.current = null;
    setCreatingOrder(false);
  };

  useEffect(() => () => cancelPendingCreateOrder(), []);

  const handlePayNow = async () => {
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
    flushSync(() => {
      setSelectedPackageId(packageId);
      setPackageDropdownOpen(false);
      setPaymentMessage(null);
      setActiveOrder(null);
      setStep('payment');
      setAutoCreateOrderToken((current) => current + 1);
    });
  };

  return (
    <div
      className={`${PANEL_OVERLAY_CLASS} ${active ? '' : 'pointer-events-none opacity-0'}`}
      aria-hidden={active ? undefined : true}
      onClick={onClose}
    >
      {step === 'packages' ? (
        <PackageSelectionView
          packages={availablePackages}
          selectedPackageId={currentPackage.packageId}
          onPackageSelect={setSelectedPackageId}
          onClose={onClose}
          onContinue={openPayment}
        />
      ) : (
        <PaymentView
          packages={availablePackages}
          currentPackage={currentPackage}
          totalPrice={totalPrice}
          paymentMethod={paymentMethod}
          activeOrder={activeOrder}
          resolvedQrUrl={resolvedQrUrl}
          onPaymentMethodChange={(method) => {
            cancelPendingCreateOrder();
            setPaymentMethod(method);
            setActiveOrder(null);
            setPaymentMessage(null);
            setAutoCreateOrderToken((current) => current + 1);
          }}
          packageDropdownOpen={packageDropdownOpen}
          onTogglePackageDropdown={() => setPackageDropdownOpen((current) => !current)}
          onSelectPackage={(packageId) => {
            cancelPendingCreateOrder();
            setSelectedPackageId(packageId);
            setPackageDropdownOpen(false);
            setActiveOrder(null);
            setPaymentMessage(null);
            setAutoCreateOrderToken((current) => current + 1);
          }}
          dropdownRef={dropdownRef}
          onBack={() => {
            cancelPendingCreateOrder();
            setPackageDropdownOpen(false);
            setPaymentMessage(null);
            setActiveOrder(null);
            setStep('packages');
          }}
          onClose={() => {
            cancelPendingCreateOrder();
            onClose();
          }}
          creatingOrder={creatingOrder}
          paymentMessage={paymentMessage}
          onPayNow={handlePayNow}
          onPanelClick={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
}

function PackageSelectionView({
  packages,
  selectedPackageId,
  onPackageSelect,
  onClose,
  onContinue,
}: {
  packages: RechargePackage[];
  selectedPackageId: string;
  onPackageSelect: (packageId: string) => void;
  onClose: () => void;
  onContinue: (packageId: string) => void;
}) {
  const handlePackageCardClick = (packageId: string) => {
    if (selectedPackageId === packageId) {
      onContinue(packageId);
      return;
    }
    onPackageSelect(packageId);
  };

  return (
    <div
      className="max-h-[calc(100vh-32px)] w-full max-w-[1280px] overflow-auto rounded-[32px] bg-white shadow-xl dark:border dark:border-[#2a3441] dark:bg-[#1a1f28] dark:shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative border-b border-gray-100 px-8 pb-8 pt-10 dark:border-[#2a3441] md:px-12 md:pt-12">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-[#2a3441] md:right-8 md:top-8"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="mx-auto max-w-[720px] text-center">
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5] md:text-3xl">充值龙虾币</h1>
          <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-400">
            所有充值均为一次性到账，不会自动续费。支付成功后，龙虾币会直接写入当前账号余额。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {['即时到账', '不会自动续费', '支持微信 / 支付宝'].map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#f0d6d9] bg-[#fff7f8] px-4 py-1.5 text-xs font-medium text-[#c13c48] dark:border-[#49333a] dark:bg-[#261d21] dark:text-[#ff8a93]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {packages.map((item) => {
            const selected = item.packageId === selectedPackageId;
            const priceLabel = formatPriceAmount(item.amountCnyFen);
            return (
              <div
                key={item.packageId}
                role="button"
                aria-pressed={selected}
                tabIndex={0}
                onClick={() => handlePackageCardClick(item.packageId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePackageCardClick(item.packageId);
                  }
                }}
                className={cn(
                  'relative flex h-full cursor-pointer flex-col rounded-[28px] border-2 p-8 text-left outline-none',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  selected
                    ? 'border-[#E63946] bg-[linear-gradient(180deg,#ffffff_0%,#fff7f8_100%)] shadow-[0_24px_60px_rgba(230,57,70,0.16)] dark:border-[#ff5a66] dark:bg-[linear-gradient(180deg,#261d21_0%,#1a1f28_100%)] dark:shadow-[0_24px_60px_rgba(230,57,70,0.18)]'
                    : 'border-gray-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] hover:border-[#f0b4ba] hover:shadow-[0_24px_48px_rgba(15,23,42,0.1)] dark:border-[#2a3441] dark:bg-[#1f2630] dark:shadow-[0_18px_40px_rgba(0,0,0,0.22)] dark:hover:border-[#435064] dark:hover:shadow-[0_24px_52px_rgba(0,0,0,0.28)]',
                )}
              >
                {item.badgeLabel ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div
                      className={cn(
                        'rounded-full px-4 py-1 text-xs font-medium shadow-lg',
                        selected
                          ? 'bg-[#E63946] text-white dark:bg-gradient-to-r dark:from-[#E63946] dark:to-[#ff4655] dark:shadow-red-900/40'
                          : 'bg-[#fff0f2] text-[#d92f3d] shadow-[0_12px_28px_rgba(230,57,70,0.12)] dark:bg-[rgba(230,57,70,0.14)] dark:text-[#ff7b85] dark:shadow-[0_12px_28px_rgba(0,0,0,0.2)]',
                      )}
                    >
                      {item.badgeLabel}
                    </div>
                  </div>
                ) : null}

                <div className="min-h-[132px] text-center">
                  <h3 className="text-[24px] font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">{item.packageName}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">{item.description}</p>
                  {item.highlight ? (
                    <p className="mt-3 text-sm font-medium text-[#d92f3d] dark:text-[#ff8a93]">{item.highlight}</p>
                  ) : null}
                </div>

                <div className="min-h-[132px] pt-4 text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-gray-500">¥</span>
                    <span className="text-5xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">{priceLabel}</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    基础到账 {formatCreditsLabel(item.credits)} 龙虾币
                    {item.bonusCredits > 0 ? ` · 赠送 ${formatCreditsLabel(item.bonusCredits)}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">合计到账 {formatCreditsLabel(item.totalCredits)} 龙虾币</p>
                </div>

                <div className="mt-auto pt-4">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onContinue(item.packageId);
                    }}
                    className={cn(
                      'mb-8 w-full cursor-pointer rounded-[20px] py-3.5 text-base font-semibold',
                      SPRING_PRESSABLE,
                      selected
                        ? 'bg-[#E63946] !text-white shadow-[0_20px_42px_rgba(230,57,70,0.24)] hover:bg-[#d92f3d] hover:!text-white dark:bg-[#ff4655] dark:hover:bg-[#ff5a66]'
                        : 'bg-[#111827] !text-white shadow-[0_18px_36px_rgba(17,24,39,0.16)] hover:bg-[#0b1220] hover:!text-white dark:bg-[#0f172a] dark:!text-white dark:hover:bg-[#111c31]',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <span>立即充值</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </button>

                  <div>
                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-gray-500">到账说明</p>
                    <ul className="space-y-2.5">
                      {item.featureList.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#E63946]" />
                          <span className="text-sm leading-7 text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PaymentView({
  packages,
  currentPackage,
  totalPrice,
  paymentMethod,
  activeOrder,
  resolvedQrUrl,
  onPaymentMethodChange,
  packageDropdownOpen,
  onTogglePackageDropdown,
  onSelectPackage,
  dropdownRef,
  onBack,
  onClose,
  creatingOrder,
  paymentMessage,
  onPayNow,
  onPanelClick,
}: {
  packages: RechargePackage[];
  currentPackage: RechargePackage;
  totalPrice: string;
  paymentMethod: PaymentMethod;
  activeOrder: PaymentOrderData | null;
  resolvedQrUrl: string | null;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  packageDropdownOpen: boolean;
  onTogglePackageDropdown: () => void;
  onSelectPackage: (packageId: string) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  onBack: () => void;
  onClose: () => void;
  creatingOrder: boolean;
  paymentMessage: string | null;
  onPayNow: () => void;
  onPanelClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const orderStatus = activeOrder?.status || null;
  const expiryLabel = formatPaymentDeadline(activeOrder?.expires_at || null);
  const isPaid = orderStatus === 'paid';
  const isFailed = orderStatus === 'failed';
  const isExpired = orderStatus === 'expired';
  const isAwaitingPayment = !creatingOrder && Boolean(activeOrder) && !isPaid && !isFailed && !isExpired;
  const shouldShowQr = Boolean(resolvedQrUrl) && !isPaid && !isFailed && !isExpired;
  const statusCard = creatingOrder
    ? {
        tone: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100',
        icon: LoaderCircle,
        iconClassName: 'animate-spin',
        title: '正在创建支付订单',
        description: '正在向支付渠道申请订单，请稍候。',
      }
    : isPaid
      ? {
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
          icon: CheckCircle2,
          iconClassName: '',
          title: '充值成功',
          description: `本次充值 ${formatCreditsLabel(currentPackage.totalCredits)} 龙虾币已到账，当前页面余额会同步刷新，并将在 3 秒后返回当前页面。`,
        }
      : isFailed
        ? {
            tone: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100',
            icon: AlertCircle,
            iconClassName: '',
            title: '支付失败',
            description: '本次订单未完成扣款，请重新创建充值订单后再支付。',
          }
        : isExpired
          ? {
              tone: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
              icon: Clock3,
              iconClassName: '',
              title: '订单已过期',
              description: '支付窗口已失效，需要重新创建一个新的充值订单。',
            }
          : isAwaitingPayment
            ? {
                tone: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100',
                icon: Clock3,
                iconClassName: '',
                title: '等待完成支付',
                description: `支付完成后将自动刷新状态，并为当前账号充值 ${formatCreditsLabel(currentPackage.totalCredits)} 龙虾币。`,
              }
            : {
                tone: 'border-gray-200 bg-gray-50 text-gray-800 dark:border-[#2a3441] dark:bg-[#1a1f28] dark:text-gray-200',
                icon: Clock3,
                iconClassName: '',
                title: '尚未创建订单',
                description: `请选择支付方式并创建订单。订单创建成功后，当前模态窗会直接展示真实支付二维码，本次将为当前账号充值 ${formatCreditsLabel(currentPackage.totalCredits)} 龙虾币。`,
              };
  const StatusIcon = statusCard.icon;
  const statusActionLabel = isFailed || isExpired ? '重新创建订单' : '重新生成二维码';
  const showStatusAction = !creatingOrder && !isPaid && !isAwaitingPayment;

  const handlePrimaryAction = () => {
    if (!isAwaitingPayment || isFailed || isExpired) {
      onPayNow();
    }
  };

  return (
    <div
      className="flex max-h-[min(840px,calc(100vh-24px))] w-full max-w-[1120px] flex-col overflow-hidden rounded-[28px] bg-white shadow-xl dark:border dark:border-[#2a3441] dark:bg-[#1a1f28] dark:shadow-2xl"
      onClick={onPanelClick}
    >
      <div className="relative border-b border-gray-100 px-6 pb-4 pt-6 dark:border-[#2a3441] md:px-8">
        <button
          onClick={onBack}
          className="absolute left-5 top-6 flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-[#E63946] dark:text-gray-400 md:left-8"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">返回充值包</span>
        </button>

        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-[#2a3441] md:right-7 md:top-5"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5 md:px-8 md:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.96fr)]">
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-[#2a3441] dark:bg-[#1f2630]">
            <h2 className="mb-2 text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">确认充值包</h2>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">当前页面只处理一次性充值，支付完成后龙虾币会直接到账，不会自动续费。</p>

            <div ref={dropdownRef} className="relative mb-6">
              <button
                onClick={onTogglePackageDropdown}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#E63946] dark:border-[#2a3441] dark:bg-[#252d3a]"
              >
                <div>
                  <p className="font-semibold text-[#1a1a1a] dark:text-[#f0f2f5]">{currentPackage.packageName}</p>
                  <p className="text-xs text-gray-500">
                    合计到账 {formatCreditsLabel(currentPackage.totalCredits)} 龙虾币
                    {currentPackage.bonusCredits > 0 ? ` · 其中赠送 ${formatCreditsLabel(currentPackage.bonusCredits)}` : ''}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-gray-600 transition-transform dark:text-gray-400',
                    packageDropdownOpen && 'rotate-180',
                  )}
                />
              </button>

              {packageDropdownOpen ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-xl dark:border-[#2a3441] dark:bg-[#252d3a] dark:shadow-2xl">
                  {packages.map((item) => (
                    <button
                      key={item.packageId}
                      onClick={() => onSelectPackage(item.packageId)}
                      className={cn(
                        'w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#2a3441]',
                        item.packageId === currentPackage.packageId && 'bg-red-50 dark:bg-[#2a1f22]',
                      )}
                    >
                      <p className="font-semibold text-[#1a1a1a] dark:text-[#f0f2f5]">{item.packageName}</p>
                      <p className="text-xs text-gray-500">
                        合计到账 {formatCreditsLabel(item.totalCredits)} 龙虾币 · ¥{formatPriceAmount(item.amountCnyFen)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mb-6 border-b border-gray-200 pb-6 dark:border-[#2a3441]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-500">¥</span>
                <span className="text-5xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">{totalPrice}</span>
                <span className="text-gray-500 dark:text-gray-400">一次性充值</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                基础到账 {formatCreditsLabel(currentPackage.credits)} 龙虾币
                {currentPackage.bonusCredits > 0 ? ` · 赠送 ${formatCreditsLabel(currentPackage.bonusCredits)}` : ''}
              </p>
              <p className="mt-1 text-sm font-medium text-[#d92f3d] dark:text-[#ff8a93]">
                合计到账 {formatCreditsLabel(currentPackage.totalCredits)} 龙虾币
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-400">到账说明</p>
              <ul className="space-y-2.5">
                {currentPackage.featureList.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E63946] dark:shadow-lg dark:shadow-red-900/30">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-[#2a3441] dark:bg-[#1f2630]">
            <h2 className="mb-2 text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">请选择方式完成支付</h2>
            <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">当前模态窗就是支付页。请选择微信或支付宝后，直接扫描右侧收款码完成支付。</p>

            <div className={cn('mb-4 rounded-2xl border px-4 py-4', statusCard.tone)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-current dark:bg-black/10">
                    <StatusIcon className={cn('h-5 w-5', statusCard.iconClassName)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{statusCard.title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-90">{statusCard.description}</p>
                    {paymentMessage ? <p className="mt-2 text-xs opacity-80">{paymentMessage}</p> : null}
                    {activeOrder ? (
                      <p className="mt-2 text-xs opacity-75">
                        订单状态: {resolveOrderStatusLabel(activeOrder.status)}
                        {expiryLabel && !isPaid ? ` · 有效至 ${expiryLabel}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                {showStatusAction ? (
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-current/18 bg-white/70 px-3 py-2 text-xs font-medium transition-colors hover:bg-white dark:bg-black/10 dark:hover:bg-black/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {statusActionLabel}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 flex gap-3">
              {(['wechat_qr', 'alipay_qr'] as PaymentMethod[]).map((method) => {
                const meta = PAYMENT_METHOD_META[method];
                const selected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    onClick={() => onPaymentMethodChange(method)}
                    className={cn(
                      'flex-1 cursor-pointer rounded-xl py-3 font-medium transition-all',
                      creatingOrder || isPaid ? 'cursor-not-allowed opacity-60' : '',
                      selected
                        ? meta.accentClassName
                        : 'border-2 border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-[#2a3441] dark:bg-[#252d3a] dark:text-gray-400 dark:hover:border-[#3a4551]',
                    )}
                    disabled={creatingOrder || isPaid}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 dark:border-[#2a3441] dark:bg-[#252d3a]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f0f2f5]">扫码支付</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {paymentMethod === 'wechat_qr' ? '微信扫码' : '支付宝扫码'}
                    </p>
                  </div>
                  <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-500 dark:border-[#364152] dark:bg-[#1f2630] dark:text-gray-300">
                    {paymentMethod === 'wechat_qr' ? '微信官方收款码样式' : '支付宝官方收款码样式'}
                  </div>
                </div>
                <div className="flex min-h-[420px] items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,#eef2f7_0%,#e7edf6_100%)] p-6 dark:bg-[linear-gradient(180deg,#111827_0%,#182130_100%)]">
                  {creatingOrder ? (
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">正在创建支付订单...</div>
                  ) : isPaid ? (
                    <div className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-emerald-200 bg-emerald-50 px-6 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                      <div>
                        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-200">充值已完成</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-600/80 dark:text-emerald-200/70">
                          龙虾币已到账，3 秒后自动返回当前页面。
                        </p>
                      </div>
                    </div>
                  ) : isFailed ? (
                    <div className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-red-200 bg-red-50 px-6 text-center dark:border-red-900/60 dark:bg-red-950/30">
                      <AlertCircle className="h-12 w-12 text-red-500" />
                      <div>
                        <p className="text-base font-semibold text-red-700 dark:text-red-200">支付失败</p>
                        <p className="mt-1 text-xs leading-5 text-red-600/80 dark:text-red-200/70">
                          本次未完成扣款，请重新生成新的收款码。
                        </p>
                      </div>
                    </div>
                  ) : isExpired ? (
                    <div className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-amber-200 bg-amber-50 px-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
                      <Clock3 className="h-12 w-12 text-amber-500" />
                      <div>
                        <p className="text-base font-semibold text-amber-700 dark:text-amber-200">订单已过期</p>
                        <p className="mt-1 text-xs leading-5 text-amber-600/80 dark:text-amber-200/70">
                          当前收款码已失效，请重新创建订单后再支付。
                        </p>
                      </div>
                    </div>
                  ) : shouldShowQr ? (
                    <BrandedPaymentQr paymentMethod={paymentMethod} qrUrl={resolvedQrUrl!} />
                  ) : (
                    <div className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-gray-300 bg-white px-6 text-center dark:border-[#3a4551] dark:bg-[#111827]">
                      <Clock3 className="h-10 w-10 text-gray-300" />
                      <div>
                        <p className="text-sm font-semibold text-gray-500">正在准备收款码</p>
                        <p className="mt-2 text-xs leading-5 text-gray-400">订单创建成功后，这里会直接显示可支付的二维码。</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
                  {shouldShowQr
                    ? paymentMethod === 'wechat_qr'
                      ? '请直接使用微信扫描上方二维码完成支付。'
                      : '请直接使用支付宝扫描上方二维码完成支付。'
                    : isPaid
                      ? `支付已完成，${formatCreditsLabel(currentPackage.totalCredits)} 龙虾币已经写入当前账号。`
                      : isFailed
                        ? '支付未成功，本次不会充值龙虾币。'
                        : isExpired
                          ? '订单已过期，请重新创建后再支付。'
                          : '系统正在生成新的收款码，请稍候。'}
                </p>
                {isPaid ? (
                  <p className="mt-2 text-center text-xs text-emerald-700/80 dark:text-emerald-200/80">
                    将自动关闭充值窗口并回到你刚才的页面，不会刷新当前应用。
                  </p>
                ) : null}
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              <p>
                充值即表示您同意我们的{' '}
                <a href="#" className="cursor-pointer text-[#E63946] hover:underline">
                  充值说明
                </a>{' '}
                和{' '}
                <a href="#" className="cursor-pointer text-[#E63946] hover:underline">
                  支付服务协议
                </a>
              </p>
              <p className="mt-2">这是一次性充值，不会产生后续自动扣费。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
