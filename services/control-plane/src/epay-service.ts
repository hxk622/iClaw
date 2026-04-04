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
}
