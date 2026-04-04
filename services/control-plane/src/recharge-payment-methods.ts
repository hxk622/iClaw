import type {PaymentProvider} from './domain.ts';

export type RechargePaymentMethodProvider = Extract<PaymentProvider, 'wechat_qr' | 'alipay_qr'>;

export type ResolvedRechargePaymentMethodRecord = {
  provider: RechargePaymentMethodProvider;
  enabled: boolean;
  sortOrder: number;
  default: boolean;
  label: string | null;
  metadata: Record<string, unknown>;
  sourceLayer: 'platform_default' | 'oem_binding';
};

const SUPPORTED_RECHARGE_PAYMENT_METHOD_PROVIDERS = new Set<RechargePaymentMethodProvider>(['wechat_qr', 'alipay_qr']);

const DEFAULT_RECHARGE_PAYMENT_METHODS: Array<{
  provider: RechargePaymentMethodProvider;
  enabled: boolean;
  sortOrder: number;
  default: boolean;
  label: string;
  metadata: Record<string, unknown>;
}> = [
  {
    provider: 'wechat_qr',
    enabled: true,
    sortOrder: 10,
    default: true,
    label: '微信支付',
    metadata: {
      instruction: '请使用微信扫一扫完成支付',
    },
  },
  {
    provider: 'alipay_qr',
    enabled: true,
    sortOrder: 20,
    default: false,
    label: '支付宝',
    metadata: {
      instruction: '请使用支付宝扫一扫完成支付',
    },
  },
];

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeRechargePaymentMethodProvider(value: unknown): RechargePaymentMethodProvider | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!SUPPORTED_RECHARGE_PAYMENT_METHOD_PROVIDERS.has(normalized as RechargePaymentMethodProvider)) {
    return null;
  }
  return normalized as RechargePaymentMethodProvider;
}

function buildResolvedRechargePaymentMethod(
  value: {
    provider: RechargePaymentMethodProvider;
    enabled: boolean;
    sortOrder: number;
    default: boolean;
    label: string | null;
    metadata: Record<string, unknown>;
  },
  sourceLayer: ResolvedRechargePaymentMethodRecord['sourceLayer'],
): ResolvedRechargePaymentMethodRecord {
  return {
    provider: value.provider,
    enabled: value.enabled,
    sortOrder: value.sortOrder,
    default: value.default,
    label: value.label,
    metadata: cloneJson(value.metadata),
    sourceLayer,
  };
}

export function resolveRechargePaymentMethods(
  config: Record<string, unknown> | null | undefined,
): ResolvedRechargePaymentMethodRecord[] {
  const root = asObject(config);
  const rechargeConfig = asObject(asObject(asObject(root.surfaces).recharge).config);
  const hasExplicitPaymentMethods =
    Array.isArray(rechargeConfig.payment_methods) || Array.isArray(rechargeConfig.paymentMethods);
  const rawPaymentMethods = asArray(rechargeConfig.payment_methods ?? rechargeConfig.paymentMethods);
  const sourceLayer: ResolvedRechargePaymentMethodRecord['sourceLayer'] = hasExplicitPaymentMethods ? 'oem_binding' : 'platform_default';
  const sourceItems = hasExplicitPaymentMethods ? rawPaymentMethods : DEFAULT_RECHARGE_PAYMENT_METHODS;
  const seenProviders = new Set<RechargePaymentMethodProvider>();
  const items = (sourceItems.length
    ? sourceItems
        .map((item, index) => {
          const entry = asObject(item);
          const provider = normalizeRechargePaymentMethodProvider(entry.provider);
          if (!provider || seenProviders.has(provider)) {
            return null;
          }
          seenProviders.add(provider);
          const metadata = asObject(entry.metadata);
          return buildResolvedRechargePaymentMethod(
            {
              provider,
              enabled: entry.enabled !== false,
              sortOrder: Number(entry.sort_order ?? entry.sortOrder ?? (index + 1) * 10) || (index + 1) * 10,
              default: entry.is_default === true || entry.default === true,
              label: String(entry.label || metadata.label || '').trim() || null,
              metadata,
            },
            sourceLayer,
          );
        })
        .filter((item): item is ResolvedRechargePaymentMethodRecord => Boolean(item))
    : hasExplicitPaymentMethods
      ? []
      : DEFAULT_RECHARGE_PAYMENT_METHODS.map((item) => buildResolvedRechargePaymentMethod(item, sourceLayer))
  ).sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'));

  const enabledItems = items.filter((item) => item.enabled);
  const defaultProvider = enabledItems.find((item) => item.default)?.provider || enabledItems[0]?.provider || null;
  return items.map((item) => ({
    ...item,
    default: item.enabled && item.provider === defaultProvider,
  }));
}
