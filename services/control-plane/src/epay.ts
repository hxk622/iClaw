
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
