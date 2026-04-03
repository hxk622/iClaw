import {HttpError} from './errors.ts';
import type {ControlPlaneStore} from './store.ts';
import {TOPUP_PACKAGES, normalizePaymentProvider} from './service.ts';
import type {PaymentWebhookInput, CreatePaymentOrderInput} from './domain.ts'
import {config} from './config.ts';


import crypto from 'crypto';

// Epay 支付配置
export interface EpayConfig {
  partnerId: string; // 商户ID (epay_id)
  key: string;       // 商户密钥 (epay_key)
  gateway: string;   // 支付网关地址 (pay_address)
}

// 发起支付所需的参数
export interface EpayPurchaseInput {
  type: 'alipay' | 'wxpay' | 'qqpay'; // 支付方式
  tradeNo: string;      // 商户订单号
  notifyUrl: string;    // 异步通知地址
  returnUrl: string;    // 同步跳转地址
  name: string;         // 商品名称
  money: string;        // 金额 (单位: 元)
}

// Epay 回调参数
export interface EpayNotifyInput {
  trade_no: string;         // 商户订单号
  out_trade_no: string;     // Epay 订单号
  type: string;             // 支付方式
  money: string;            // 金额
  trade_status: string;     // 交易状态 (TRADE_SUCCESS)
  sign: string;             // 签名
  sign_type: 'MD5';         // 签名类型
}

/**
 * 对参数进行排序并生成待签名的字符串
 * @param params 参数对象
 * @returns 待签名的字符串
 */
function buildSignString(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const pairs: string[] = [];
  for (const key of sortedKeys) {
    const value = params[key];
    if (key !== 'sign' && key !== 'sign_type' && value !== null && value !== undefined && value !== '') {
      pairs.push(`${key}=${value}`);
    }
  }
  return pairs.join('&');
}

/**
 * 计算 Epay 签名
 * @param params 参与签名的参数
 * @param key 商户密钥
 * @returns 签名
 */
function createSignature(params: Record<string, any>, key: string): string {
  const signString = buildSignString(params);
  const stringToSign = `${signString}${key}`;
  return crypto.createHash('md5').update(stringToSign).digest('hex');
}

/**
 * 验证 Epay 回调签名
 * @param params Epay 回调的所有参数
 * @param key 商户密钥
 * @returns 签名是否有效
 */
export function verifySignature(params: Record<string, any>, key: string): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) {
    return false;
  }
  const expectedSign = createSignature(params, key);
  return receivedSign === expectedSign;
}

/**
 * 生成 Epay 支付的跳转 URL 和参数
 * @param input 支付参数
 * @param config Epay 配置
 * @returns 包含支付网关 URL 和表单参数的对象
 */
export function createPurchase(input: EpayPurchaseInput, config: EpayConfig) {
  const params: Record<string, any> = {
    pid: config.partnerId,
    type: input.type,
    out_trade_no: input.tradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name,
    money: input.money,
  };

  const sign = createSignature(params, config.key);
  params['sign'] = sign;
  params['sign_type'] = 'MD5';
  
  return {
    gateway: config.gateway,
    params,
  };
}

export interface EpayPurchaseView {
  gateway: string;
  params: Record<string, any>;
}

export class EpayService {
  private readonly store: ControlPlaneStore;
  private readonly decryptSecret: (payload: string | null | undefined) => Record<string, string>;
  private readonly publicUrl: string;

  constructor(store: ControlPlaneStore, decryptSecret: (payload: string | null | undefined) => Record<string, string>, publicUrl: string) {
    this.store = store;
    this.decryptSecret = decryptSecret;
    this.publicUrl = publicUrl;
  }

  async createEpayPaymentOrder(userId: string, input: CreatePaymentOrderInput): Promise<EpayPurchaseView> {
    const provider = 'epay';
    const packageId = (input.package_id || '').trim();
    const appName = (input.app_name || '').trim();
    const packageConfig = TOPUP_PACKAGES.get(packageId);

    if (!packageConfig) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid package_id');
    }

    const epayConfig: EpayConfig = {
      partnerId: config.epayPartnerId,
      key: config.epayKey,
      gateway: config.epayGateway,
    };

    if (!epayConfig.partnerId || !epayConfig.key || !epayConfig.gateway) {
      throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'epay is not configured correctly');
    }

    const order = await this.store.createPaymentOrder(userId, {
      ...input,
      provider,
      package_id: packageId,
      return_url: (input.return_url || '').trim(),
      app_name: appName,
      app_version: (input.app_version || '').trim(),
      release_channel: (input.release_channel || '').trim(),
      platform: (input.platform || '').trim(),
      arch: (input.arch || '').trim(),
      user_agent: (input.user_agent || '').trim(),
      metadata: {},
      ...packageConfig,
    });

    const epayInput: EpayPurchaseInput = {
        type: 'alipay',
        tradeNo: order.id,
        notifyUrl: `${this.publicUrl}/api/epay/webhooks`,
        returnUrl: order.returnUrl || `${this.publicUrl}/payment-return`,
        name: order.packageName,
        money: (order.amountCnyFen / 100).toFixed(2),
    };

    const purchase = createPurchase(epayInput, epayConfig);
    return {
      gateway: purchase.gateway,
      params: purchase.params,
    };
  }

  async applyEpayWebhook(input: PaymentWebhookInput) {
    const provider = 'epay';
    if (!config.epayPartnerId || !config.epayKey || !config.epayGateway) {
      throw new HttpError(500, 'INTERNAL_SERVER_ERROR', 'epay is not configured');
    }

    if (!verifySignature(input, config.epayKey)) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid signature');
    }

    const eventId = (input.event_id || '').trim();
    const orderId = (input.order_id || '').trim();
    const status = (input.status || '').trim().toLowerCase();
    if (!eventId || !orderId || !status) {
      throw new HttpError(400, 'BAD_REQUEST', 'event_id, order_id and status are required');
    }

    return this.store.applyPaymentWebhook(provider, {
      event_id: eventId,
      order_id: orderId,
      provider_order_id: (input.provider_order_id || '').trim(),
      status,
      paid_at: (input.paid_at || '').trim()
    });
  }
}
