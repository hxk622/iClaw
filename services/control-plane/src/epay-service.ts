import {HttpError} from './errors.ts';
import type {PaymentProvider} from './domain.ts';
import {createPaymentLaunchUrl, formatAmountCnyFen, type EpayConfig, verifySignature} from './epay.ts';

type SupportedEpayProvider = Extract<PaymentProvider, 'wechat_qr' | 'alipay_qr'>;

export type EpayCheckoutInput = {
  orderId: string;
  provider: PaymentProvider;
  packageName: string;
  amountCnyFen: number;
  publicBaseUrl: string;
  returnUrl?: string | null;
};

export type EpayCheckoutResult = {
  paymentUrl: string;
  metadata: Record<string, unknown>;
};

export type EpayWebhookResult = {
  eventId: string;
  orderId: string;
  providerOrderId: string;
  status: 'pending' | 'paid' | 'failed';
  paidAt: string | null;
};

export type EpayOrderQueryResult = {
  orderId: string;
  providerOrderId: string | null;
  status: 'pending' | 'paid' | 'failed';
  paidAt: string | null;
  raw: Record<string, unknown>;
};

function normalizeBaseUrl(value: string): string {
  const normalized = String(value || '').trim().replace(/\/$/, '');
  if (!normalized) {
    throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'public payment base url is not configured');
  }
  return normalized;
}

function isSupportedProvider(provider: PaymentProvider): provider is SupportedEpayProvider {
  return provider === 'wechat_qr' || provider === 'alipay_qr';
}

function toEpayPaymentType(provider: SupportedEpayProvider): 'alipay' | 'wxpay' {
  return provider === 'alipay_qr' ? 'alipay' : 'wxpay';
}

function normalizeWebhookString(input: Record<string, unknown>, key: string): string {
  return String(input[key] || '').trim();
}

function resolveEpayApiUrl(gateway: string): string {
  const normalized = String(gateway || '').trim();
  if (!normalized) {
    throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'epay gateway is not configured');
  }
  const url = new URL(normalized);
  url.pathname = url.pathname.replace(/\/submit(?:\.php)?$/i, '/api.php');
  if (!/\/api\.php$/i.test(url.pathname)) {
    url.pathname = '/api.php';
  }
  url.search = '';
  return url.toString();
}

function normalizePaidAt(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function mapQueryStatus(payload: Record<string, unknown>): 'pending' | 'paid' | 'failed' {
  const normalizedStatus = String(payload.status ?? payload.trade_status ?? payload.api_trade_state ?? '')
    .trim()
    .toUpperCase();
  if (normalizedStatus === '1' || normalizedStatus === 'TRADE_SUCCESS' || normalizedStatus === 'TRADE_FINISHED' || normalizedStatus === 'SUCCESS') {
    return 'paid';
  }
  if (normalizedStatus === '0' || normalizedStatus === 'WAIT_BUYER_PAY' || normalizedStatus === 'PENDING' || normalizedStatus === 'NOTPAY') {
    return 'pending';
  }
  if (normalizedStatus === '-1' || normalizedStatus === 'TRADE_CLOSED' || normalizedStatus === 'TRADE_FAILED' || normalizedStatus === 'FAILED' || normalizedStatus === 'CLOSED') {
    return 'failed';
  }
  return 'pending';
}

function mapTradeStatus(value: string): 'pending' | 'paid' | 'failed' {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'TRADE_SUCCESS' || normalized === 'TRADE_FINISHED') {
    return 'paid';
  }
  if (normalized === 'WAIT_BUYER_PAY' || normalized === 'PENDING') {
    return 'pending';
  }
  if (normalized === 'TRADE_CLOSED' || normalized === 'TRADE_FAILED' || normalized === 'FAILED') {
    return 'failed';
  }
  throw new HttpError(400, 'BAD_REQUEST', 'unsupported epay trade_status');
}

export class EpayService {
  private readonly config: EpayConfig;

  constructor(config: EpayConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return Boolean(
      String(this.config.partnerId || '').trim() &&
        String(this.config.key || '').trim() &&
        String(this.config.gateway || '').trim(),
    );
  }

  createCheckout(input: EpayCheckoutInput): EpayCheckoutResult {
    if (!this.isEnabled()) {
      throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'epay is not configured');
    }
    if (!isSupportedProvider(input.provider)) {
      throw new HttpError(400, 'BAD_REQUEST', 'epay only supports wechat_qr and alipay_qr');
    }

    const publicBaseUrl = normalizeBaseUrl(input.publicBaseUrl);
    const paymentUrl = createPaymentLaunchUrl(
      {
        type: toEpayPaymentType(input.provider),
        tradeNo: input.orderId,
        notifyUrl: `${publicBaseUrl}/payments/webhooks/epay`,
        returnUrl: String(input.returnUrl || '').trim() || `${publicBaseUrl}/payment-return`,
        name: input.packageName,
        money: formatAmountCnyFen(input.amountCnyFen),
        device: 'pc',
      },
      this.config,
    );

    return {
      paymentUrl,
      metadata: {
        payment_processor: 'epay',
        payment_processor_provider: input.provider,
        payment_processor_gateway: String(this.config.gateway || '').trim(),
      },
    };
  }

  parseWebhook(input: Record<string, unknown>): EpayWebhookResult {
    if (!this.isEnabled()) {
      throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'epay is not configured');
    }
    if (!verifySignature(input, this.config.key)) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid epay signature');
    }

    const orderId = normalizeWebhookString(input, 'out_trade_no');
    const providerOrderId = normalizeWebhookString(input, 'trade_no');
    const tradeStatus = normalizeWebhookString(input, 'trade_status');
    if (!orderId || !providerOrderId || !tradeStatus) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid epay webhook payload');
    }

    const status = mapTradeStatus(tradeStatus);
    return {
      eventId: `${providerOrderId}:${status}`,
      orderId,
      providerOrderId,
      status,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
    };
  }

  async queryOrder(orderId: string): Promise<EpayOrderQueryResult | null> {
    if (!this.isEnabled()) {
      return null;
    }
    const normalizedOrderId = String(orderId || '').trim();
    if (!normalizedOrderId) {
      return null;
    }
    const endpoint = new URL(resolveEpayApiUrl(this.config.gateway));
    endpoint.searchParams.set('act', 'order');
    endpoint.searchParams.set('pid', String(this.config.partnerId || '').trim());
    endpoint.searchParams.set('key', String(this.config.key || '').trim());
    endpoint.searchParams.set('out_trade_no', normalizedOrderId);

    const response = await fetch(endpoint.toString(), {method: 'GET'});
    if (!response.ok) {
      throw new HttpError(502, 'BAD_GATEWAY', `epay order query failed: ${response.status}`);
    }
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') {
      throw new HttpError(502, 'BAD_GATEWAY', 'epay order query returned invalid payload');
    }
    const code = String(payload.code ?? '').trim();
    if (code && code !== '1') {
      return null;
    }
    const status = mapQueryStatus(payload);
    const providerOrderId = String(payload.trade_no || payload.api_trade_no || '').trim() || null;
    return {
      orderId: normalizedOrderId,
      providerOrderId,
      status,
      paidAt: status === 'paid' ? normalizePaidAt(payload.endtime || payload.paid_at || payload.paytime) || new Date().toISOString() : null,
      raw: payload,
    };
  }
}
