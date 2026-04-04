import crypto from 'node:crypto';

export interface EpayConfig {
  partnerId: string;
  key: string;
  gateway: string;
}

export interface EpayPurchaseInput {
  type: 'alipay' | 'wxpay';
  tradeNo: string;
  notifyUrl: string;
  returnUrl: string;
  name: string;
  money: string;
  device?: 'pc' | 'mobile';
}

export interface EpayNotifyInput {
  out_trade_no?: string;
  trade_no?: string;
  type?: string;
  money?: string;
  trade_status?: string;
  sign?: string;
  sign_type?: string;
}

function normalizeConfig(config: EpayConfig): EpayConfig {
  return {
    partnerId: String(config.partnerId || '').trim(),
    key: String(config.key || '').trim(),
    gateway: String(config.gateway || '').trim(),
  };
}

export function buildSignString(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .flatMap((key) => {
      const value = params[key];
      if (key === 'sign' || key === 'sign_type' || value == null || value === '') {
        return [];
      }
      return [`${key}=${String(value)}`];
    })
    .join('&');
}

export function createSignature(params: Record<string, unknown>, key: string): string {
  const signString = buildSignString(params);
  return crypto
    .createHash('md5')
    .update(`${signString}${String(key || '').trim()}`, 'utf8')
    .digest('hex');
}

export function verifySignature(params: Record<string, unknown>, key: string): boolean {
  const received = String(params.sign || '').trim().toLowerCase();
  if (!received) {
    return false;
  }
  return received === createSignature(params, key).toLowerCase();
}

export function createPurchase(input: EpayPurchaseInput, config: EpayConfig): {gateway: string; params: Record<string, string>} {
  const normalizedConfig = normalizeConfig(config);
  const params: Record<string, string> = {
    pid: normalizedConfig.partnerId,
    type: input.type,
    out_trade_no: input.tradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name,
    money: input.money,
    device: input.device || 'pc',
  };
  params.sign = createSignature(params, normalizedConfig.key);
  params.sign_type = 'MD5';
  return {
    gateway: normalizedConfig.gateway,
    params,
  };
}

export function createPaymentLaunchUrl(input: EpayPurchaseInput, config: EpayConfig): string {
  const purchase = createPurchase(input, config);
  const url = new URL(purchase.gateway);
  for (const [key, value] of Object.entries(purchase.params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function formatAmountCnyFen(amountCnyFen: number): string {
  if (!Number.isFinite(amountCnyFen) || amountCnyFen <= 0) {
    throw new Error('amount_cny_fen must be a positive integer');
  }
  return (Math.round(amountCnyFen) / 100).toFixed(2);
}
