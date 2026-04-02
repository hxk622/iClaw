import { type MouseEvent as ReactMouseEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Tag, X } from 'lucide-react';
import { type IClawClient, type PaymentOrderData } from '@iclaw/sdk';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type BillingCycle = 'monthly' | 'yearly';
type PlanTier = 'free' | 'plus' | 'pro' | 'ultra';
type PaidPlanTier = Exclude<PlanTier, 'free'>;
type PaymentMethod = 'wechat_qr' | 'alipay_qr';
type RechargeStep = 'plans' | 'payment';

type RechargePlan = {
  id: PlanTier;
  name: string;
  nameEn: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyCredits: number;
  yearlyCredits: number;
  isRecommended: boolean;
  isCurrentPlan: boolean;
  features: string[];
};

const RECHARGE_PLANS: RechargePlan[] = [
  {
    id: 'free',
    name: 'Free',
    nameEn: '',
    description: '完美适合初步体验和测试。',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyCredits: 200,
    yearlyCredits: 200,
    isRecommended: false,
    isCurrentPlan: true,
    features: [
      '每日额外赠 200 积分，次日重置',
      '完整的本地设备控制与自动化能力',
      '解锁所有核心 AI 技能',
      '跑通您的首个自动化工作流',
    ],
  },
  {
    id: 'plus',
    name: '高级版',
    nameEn: 'Plus',
    description: '助力您的日常工作流',
    monthlyPrice: 40,
    yearlyPrice: 384,
    monthlyCredits: 8800,
    yearlyCredits: 105600,
    isRecommended: true,
    isCurrentPlan: false,
    features: [
      '每月 8,800 积分',
      '每日额外 200 免费积分，次日重置',
      '可随时加购积分，按需付费',
      '构建日常多步工作流',
      '自动提升个人效率',
    ],
  },
  {
    id: 'pro',
    name: '专业版',
    nameEn: 'Pro',
    description: '面向高级用户的深度自动化',
    monthlyPrice: 80,
    yearlyPrice: 768,
    monthlyCredits: 17600,
    yearlyCredits: 211200,
    isRecommended: false,
    isCurrentPlan: false,
    features: [
      '每月 17,600 积分',
      '每日额外 200 免费积分，次日重置',
      '可随时加购积分，按需付费',
      '运行复杂批量任务处理',
      '应对中高频业务自动化需求',
    ],
  },
  {
    id: 'ultra',
    name: '旗舰版',
    nameEn: 'Ultra',
    description: '团队规模化的无限自动化能力',
    monthlyPrice: 200,
    yearlyPrice: 1920,
    monthlyCredits: 44000,
    yearlyCredits: 528000,
    isRecommended: false,
    isCurrentPlan: false,
    features: [
      '每月 44,000 积分',
      '每日额外 200 免费积分，次日重置',
      '可随时加购积分，按需付费',
      '部署 24/7 高负载复杂工作流',
      '为规模化业务提供无限自动化潜力',
    ],
  },
];

const PLAN_PAYMENT_PACKAGE_MAP: Record<PaidPlanTier, Record<BillingCycle, string>> = {
  // 这里承接充值档位的扫码下单与轮询。
  plus: { monthly: 'plan_plus_monthly', yearly: 'plan_plus_yearly' },
  pro: { monthly: 'plan_pro_monthly', yearly: 'plan_pro_yearly' },
  ultra: { monthly: 'plan_ultra_monthly', yearly: 'plan_ultra_yearly' },
};

const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; accentClassName: string }> = {
  wechat_qr: { label: '微信支付', accentClassName: 'bg-[#07C160] text-white shadow-lg shadow-green-900/30' },
  alipay_qr: { label: '支付宝', accentClassName: 'bg-[#1677FF] text-white shadow-lg shadow-blue-900/30' },
};

const PERSONAL_WECHAT_QR_URL = '/wechat-personal-qr.png';

const PANEL_OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.24)] p-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.44)] md:p-8';

function toPaidPlan(plan: PlanTier): PaidPlanTier {
  return plan === 'free' ? 'plus' : plan;
}

function getPlanById(id: PlanTier): RechargePlan {
  return RECHARGE_PLANS.find((plan) => plan.id === id) || RECHARGE_PLANS[0]!;
}

function formatPlanPrice(plan: RechargePlan, cycle: BillingCycle): number {
  return cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
}

interface RechargeCenterProps {
  client: IClawClient;
  token: string;
  onClose: () => void;
  active?: boolean;
}

export function RechargeCenter({ client, token, onClose, active = true }: RechargeCenterProps) {
  const [step, setStep] = useState<RechargeStep>('plans');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanTier>('plus');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wechat_qr');
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PaymentOrderData | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPlan = useMemo(() => getPlanById(selectedPlan), [selectedPlan]);
  const totalPrice = formatPlanPrice(currentPlan, billingCycle);
  const displayPaymentUrl =
    activeOrder?.provider === 'wechat_qr' ? PERSONAL_WECHAT_QR_URL : activeOrder?.payment_url || null;

  useEffect(() => {
    if (!active) return;
    if (!planDropdownOpen) return;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlanDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [active, planDropdownOpen]);

  useEffect(() => {
    if (!active) return;
    if (step !== 'payment') return;
    let cancelled = false;
    setCreatingOrder(true);
    setPaymentMessage(null);
    const packageId = PLAN_PAYMENT_PACKAGE_MAP[selectedPlan][billingCycle];

    const createOrder = async () => {
      try {
        const order = await client.createPaymentOrder({
          token,
          provider: paymentMethod,
          packageId,
          returnUrl: 'iclaw://payments/result',
        });
        if (cancelled) return;
        setActiveOrder(order);
      } catch (error) {
        if (!cancelled) {
          setActiveOrder(null);
          setPaymentMessage(error instanceof Error ? error.message : '创建支付订单失败');
        }
      } finally {
        if (!cancelled) {
          setCreatingOrder(false);
        }
      }
    };

    void createOrder();
    return () => {
      cancelled = true;
    };
  }, [active, billingCycle, client, paymentMethod, selectedPlan, step, token]);

  useEffect(() => {
    if (!active) return;
    if (!activeOrder) return;
    if (!['created', 'pending'].includes(activeOrder.status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const nextOrder = await client.getPaymentOrder(token, activeOrder.order_id);
        if (cancelled) return;
        setActiveOrder(nextOrder);
        if (nextOrder.status === 'paid') {
          setPaymentMessage('支付成功，充值余额稍后到账。');
        } else if (nextOrder.status === 'expired') {
          setPaymentMessage('二维码已过期，请重新选择支付方式。');
        } else if (nextOrder.status === 'failed') {
          setPaymentMessage('支付失败，请重新尝试。');
        }
      } catch (error) {
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
      window.clearInterval(timer);
    };
  }, [active, activeOrder, client, token]);

  const openPayment = (planId: PlanTier) => {
    if (planId === 'free') return;
    flushSync(() => {
      setSelectedPlan(toPaidPlan(planId));
      setPlanDropdownOpen(false);
      setPaymentMessage(null);
      setActiveOrder(null);
      setStep('payment');
    });
  };

  return (
    <div
      className={`${PANEL_OVERLAY_CLASS} ${active ? '' : 'pointer-events-none opacity-0'}`}
      aria-hidden={active ? undefined : true}
      onClick={onClose}
    >
      {step === 'plans' ? (
        <PlansView
          billingCycle={billingCycle}
          selectedPlan={selectedPlan}
          onBillingCycleChange={setBillingCycle}
          onPlanSelect={(planId) => {
            if (planId !== 'free') {
              setSelectedPlan(toPaidPlan(planId));
            }
          }}
          onClose={onClose}
          onUpgrade={openPayment}
        />
      ) : (
        <PaymentView
          billingCycle={billingCycle}
          currentPlan={currentPlan}
          totalPrice={totalPrice}
          paymentMethod={paymentMethod}
          displayPaymentUrl={displayPaymentUrl}
          onPaymentMethodChange={setPaymentMethod}
          planDropdownOpen={planDropdownOpen}
          onTogglePlanDropdown={() => setPlanDropdownOpen((current) => !current)}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
            setPlanDropdownOpen(false);
          }}
          dropdownRef={dropdownRef}
          onBack={() => {
            setPlanDropdownOpen(false);
            setPaymentMessage(null);
            setActiveOrder(null);
            setStep('plans');
          }}
          onClose={onClose}
          creatingOrder={creatingOrder}
          activeOrder={activeOrder}
          paymentMessage={paymentMessage}
          onPanelClick={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
}

function PlansView({
  billingCycle,
  selectedPlan,
  onBillingCycleChange,
  onPlanSelect,
  onClose,
  onUpgrade,
}: {
  billingCycle: BillingCycle;
  selectedPlan: PaidPlanTier;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  onPlanSelect: (planId: PlanTier) => void;
  onClose: () => void;
  onUpgrade: (planId: PlanTier) => void;
}) {
  const handlePlanCardClick = (planId: PlanTier) => {
    if (planId === 'free') {
      onPlanSelect(planId);
      return;
    }
    if (selectedPlan === planId) {
      onUpgrade(planId);
      return;
    }
    onPlanSelect(planId);
  };

  return (
    <div
      className="max-h-[calc(100vh-32px)] w-full max-w-[1400px] overflow-auto rounded-[32px] bg-white shadow-xl dark:border dark:border-[#2a3441] dark:bg-[#1a1f28] dark:shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative border-b border-gray-100 px-8 pb-8 pt-10 dark:border-[#2a3441] md:px-12 md:pt-12">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-[#2a3441] md:right-8 md:top-8"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>

        <h1 className="mb-6 text-center text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5] md:text-3xl">
          充值中心
        </h1>

        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-[#eceef3] bg-[linear-gradient(180deg,#ffffff_0%,#f5f6f9_100%)] p-1 shadow-[0_14px_30px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:border-[#303847] dark:bg-[linear-gradient(180deg,#232b36_0%,#1c222c_100%)] dark:shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
            <CycleButton
              active={billingCycle === 'monthly'}
              label="月套餐"
              onClick={() => onBillingCycleChange('monthly')}
            />
            <CycleButton
              active={billingCycle === 'yearly'}
              label="年套餐"
              onClick={() => onBillingCycleChange('yearly')}
              tagMode={billingCycle}
            />
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {RECHARGE_PLANS.map((plan) => {
            const selected = plan.id === selectedPlan;
            return (
              <div
                key={plan.id}
                role="button"
                aria-pressed={selected}
                tabIndex={0}
                onClick={() => handlePlanCardClick(plan.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePlanCardClick(plan.id);
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
              {plan.isRecommended ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div
                    className={cn(
                      'rounded-full px-4 py-1 text-xs font-medium shadow-lg',
                      selected
                        ? 'bg-[#E63946] text-white dark:bg-gradient-to-r dark:from-[#E63946] dark:to-[#ff4655] dark:shadow-red-900/40'
                        : 'bg-[#fff0f2] text-[#d92f3d] shadow-[0_12px_28px_rgba(230,57,70,0.12)] dark:bg-[rgba(230,57,70,0.14)] dark:text-[#ff7b85] dark:shadow-[0_12px_28px_rgba(0,0,0,0.2)]',
                    )}
                  >
                    推荐计划
                  </div>
                </div>
              ) : null}

                <div className="min-h-[126px] text-center">
                  <h3 className="mb-1 text-[20px] font-bold text-[#1a1a1a] dark:text-[#f0f2f5] md:text-[22px]">
                    {plan.nameEn ? `${plan.name} (${plan.nameEn})` : plan.name}
                  </h3>
                  <p className="min-h-[48px] text-sm leading-7 text-gray-600 dark:text-gray-400">{plan.description}</p>
                </div>

                <div className="min-h-[108px] pt-2 text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xs text-gray-500">¥</span>
                    <span className="text-4xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">
                      {billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                    </span>
                    <span className="text-sm text-gray-500">/月</span>
                  </div>
                  {billingCycle === 'yearly' && plan.yearlyPrice > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      年付 ¥{plan.yearlyPrice} · 合计 {plan.yearlyCredits.toLocaleString()} 积分
                    </p>
                  ) : plan.monthlyPrice > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">每月到账 {plan.monthlyCredits.toLocaleString()} 积分</p>
                  ) : null}
                </div>

                <div className="mt-auto pt-1">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onUpgrade(plan.id);
                    }}
                    disabled={plan.isCurrentPlan}
                    type="button"
                    className={cn(
                      'mb-8 w-full cursor-pointer rounded-[20px] py-3.5 text-base font-semibold',
                      SPRING_PRESSABLE,
                      plan.isCurrentPlan
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-[#2a3441] dark:text-gray-600'
                        : selected
                          ? 'bg-[#E63946] !text-white shadow-[0_20px_42px_rgba(230,57,70,0.24)] hover:bg-[#d92f3d] hover:!text-white dark:bg-[#ff4655] dark:hover:bg-[#ff5a66]'
                          : 'bg-[#111827] !text-white shadow-[0_18px_36px_rgba(17,24,39,0.16)] hover:bg-[#0b1220] hover:!text-white dark:bg-[#0f172a] dark:!text-white dark:hover:bg-[#111c31]',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <span>{plan.isCurrentPlan ? '当前正在使用' : '立即充值'}</span>
                      {plan.isCurrentPlan ? null : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                  </button>

                  <div>
                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-gray-500">包含特权</p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
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

function CycleButton({
  active,
  label,
  onClick,
  tagMode,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tagMode?: BillingCycle;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex min-w-[120px] cursor-pointer items-center justify-center rounded-full px-6 py-2.5 font-semibold transition-all',
        active
          ? 'bg-[#20283a] text-white shadow-[0_14px_28px_rgba(32,40,58,0.26)] dark:bg-[#101827] dark:shadow-[0_16px_30px_rgba(0,0,0,0.34)]'
          : 'bg-transparent text-[#7b8190] hover:bg-white hover:text-[#384152] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:text-[#a1a9b7] dark:hover:bg-[rgba(255,255,255,0.04)] dark:hover:text-[#eef2f8] dark:hover:shadow-none',
        tagMode && 'gap-2',
      )}
    >
      <span>{label}</span>
      {tagMode ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none shadow-[0_8px_18px_rgba(255,91,97,0.24)]',
            active
              ? 'bg-[#ff5b61] text-white shadow-[0_10px_20px_rgba(255,91,97,0.28)]'
              : 'bg-[#ff5b61] text-white',
          )}
        >
          <Tag className="h-3 w-3" />
          省20%
        </span>
      ) : null}
    </button>
  );
}

function PaymentView({
  billingCycle,
  currentPlan,
  totalPrice,
  paymentMethod,
  displayPaymentUrl,
  onPaymentMethodChange,
  planDropdownOpen,
  onTogglePlanDropdown,
  onSelectPlan,
  dropdownRef,
  onBack,
  onClose,
  creatingOrder,
  activeOrder,
  paymentMessage,
  onPanelClick,
}: {
  billingCycle: BillingCycle;
  currentPlan: RechargePlan;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  displayPaymentUrl: string | null;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  planDropdownOpen: boolean;
  onTogglePlanDropdown: () => void;
  onSelectPlan: (plan: PaidPlanTier) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  onBack: () => void;
  onClose: () => void;
  creatingOrder: boolean;
  activeOrder: PaymentOrderData | null;
  paymentMessage: string | null;
  onPanelClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="max-h-[calc(100vh-32px)] w-full max-w-[1200px] overflow-auto rounded-[32px] bg-white shadow-xl dark:border dark:border-[#2a3441] dark:bg-[#1a1f28] dark:shadow-2xl"
      onClick={onPanelClick}
    >
      <div className="relative border-b border-gray-100 px-8 pb-6 pt-8 dark:border-[#2a3441] md:px-12">
        <button
          onClick={onBack}
          className="absolute left-6 top-8 flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-[#E63946] dark:text-gray-400 md:left-8"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">返回计划</span>
        </button>

        <button
          onClick={onClose}
          className="absolute right-6 top-6 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-[#2a3441] md:right-8 md:top-8"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="p-8 md:p-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-[#2a3441] dark:bg-[#1f2630]">
            <h2 className="mb-2 text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">选择充值档位</h2>
            <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">请确认当前充值金额与对应到账额度</p>

            <div ref={dropdownRef} className="relative mb-8">
              <button
                onClick={onTogglePlanDropdown}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#E63946] dark:border-[#2a3441] dark:bg-[#252d3a]"
              >
                <div>
                  <p className="font-semibold text-[#1a1a1a] dark:text-[#f0f2f5]">
                    {currentPlan.nameEn ? `${currentPlan.name} (${currentPlan.nameEn})` : currentPlan.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {billingCycle === 'monthly'
                      ? `每月 ${currentPlan.monthlyCredits.toLocaleString()} 积分`
                      : `每年 ${currentPlan.yearlyCredits.toLocaleString()} 积分`}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-gray-600 transition-transform dark:text-gray-400',
                    planDropdownOpen && 'rotate-180',
                  )}
                />
              </button>

              {planDropdownOpen ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-xl dark:border-[#2a3441] dark:bg-[#252d3a] dark:shadow-2xl">
                  {(['plus', 'pro', 'ultra'] as PaidPlanTier[]).map((planId) => {
                    const plan = getPlanById(planId);
                    return (
                      <button
                        key={planId}
                        onClick={() => onSelectPlan(planId)}
                        className={cn(
                          'w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#2a3441]',
                          planId === currentPlan.id && 'bg-red-50 dark:bg-[#2a1f22]',
                        )}
                      >
                        <p className="font-semibold text-[#1a1a1a] dark:text-[#f0f2f5]">
                          {plan.nameEn ? `${plan.name} (${plan.nameEn})` : plan.name}
                        </p>
                        <p className="text-xs text-gray-500">{billingCycle === 'monthly' ? `每月 ${plan.monthlyCredits.toLocaleString()} 积分` : `每年 ${plan.yearlyCredits.toLocaleString()} 积分`}</p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="mb-8 border-b border-gray-200 pb-8 dark:border-[#2a3441]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-500">¥</span>
                <span className="text-5xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">{totalPrice}</span>
                <span className="text-gray-500 dark:text-gray-400">/ {billingCycle === 'monthly' ? '月' : '年'}</span>
              </div>
              {billingCycle === 'yearly' ? (
                <p className="mt-2 text-sm text-gray-500">平均每月 ¥{Math.round(totalPrice / 12)}，合计到账 {currentPlan.yearlyCredits.toLocaleString()} 积分</p>
              ) : currentPlan.monthlyPrice > 0 ? (
                <p className="mt-2 text-sm text-gray-500">本次到账 {currentPlan.monthlyCredits.toLocaleString()} 积分</p>
              ) : null}
            </div>

            <div>
              <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-400">包含特权</p>
              <ul className="space-y-3">
                {currentPlan.features.map((feature) => (
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

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-[#2a3441] dark:bg-[#1f2630]">
            <h2 className="mb-2 text-2xl font-bold text-[#1a1a1a] dark:text-[#f0f2f5]">请选择方式扫码支付</h2>
            <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">支持微信支付与支付宝</p>

            <div className="mb-8 flex gap-3">
              {(['wechat_qr', 'alipay_qr'] as PaymentMethod[]).map((method) => {
                const meta = PAYMENT_METHOD_META[method];
                const selected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    onClick={() => onPaymentMethodChange(method)}
                    className={cn(
                      'flex-1 cursor-pointer rounded-xl py-3 font-medium transition-all',
                      selected
                        ? meta.accentClassName
                        : 'border-2 border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-[#2a3441] dark:bg-[#252d3a] dark:text-gray-400 dark:hover:border-[#3a4551]',
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-8 text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">支付金额</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-lg text-[#E63946]">¥</span>
                <span className="text-4xl font-bold text-[#E63946]">{totalPrice}</span>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-8 dark:border-[#2a3441] dark:bg-[#252d3a]">
              <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-xl bg-gray-100 dark:bg-[#1a1f28]">
                {creatingOrder ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    正在生成{paymentMethod === 'wechat_qr' ? '微信' : '支付宝'}二维码
                  </div>
                ) : displayPaymentUrl ? (
                  <img
                    src={displayPaymentUrl}
                    alt={`${paymentMethod === 'wechat_qr' ? '微信' : '支付宝'}支付二维码`}
                    className="h-48 w-48 border-2 border-gray-300 bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center border-2 border-gray-300 bg-white px-4 text-center text-xs text-gray-400">
                    {paymentMethod === 'wechat_qr' ? '微信' : '支付宝'}
                    <br />
                    扫码支付二维码
                  </div>
                )}
              </div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                {paymentMethod === 'wechat_qr'
                  ? '请使用微信扫描二维码完成支付'
                  : '请使用支付宝扫描二维码完成支付'}
              </p>
              {paymentMessage ? (
                <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-500">{paymentMessage}</p>
              ) : null}
            </div>

            <div className="text-center text-xs text-gray-500">
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
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
