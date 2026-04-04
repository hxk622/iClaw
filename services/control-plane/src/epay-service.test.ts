import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {EpayService} from './epay-service.ts';
import {createSignature} from './epay.ts';

const CONFIG = {
  partnerId: '1242',
  key: 'test_secret_key',
  gateway: 'https://epay.example.com/submit.php',
};

describe('EpayService', () => {
  it('creates checkout url with real order amount instead of debug amount', () => {
    const service = new EpayService(CONFIG);
    const result = service.createCheckout({
      orderId: 'order_123',
      provider: 'wechat_qr',
      packageName: '3000 龙虾币',
      amountCnyFen: 4000,
      publicBaseUrl: 'http://127.0.0.1:2130',
      returnUrl: 'iclaw://payments/result',
    });

    const url = new URL(result.paymentUrl);
    assert.equal(url.origin, 'https://epay.example.com');
    assert.equal(url.pathname, '/submit.php');
    assert.equal(url.searchParams.get('out_trade_no'), 'order_123');
    assert.equal(url.searchParams.get('money'), '40.00');
    assert.equal(url.searchParams.get('notify_url'), 'http://127.0.0.1:2130/payments/webhooks/epay');
    assert.equal(url.searchParams.get('return_url'), 'iclaw://payments/result');
    assert.equal(url.searchParams.get('type'), 'wxpay');
    assert.equal(result.metadata.payment_processor, 'epay');
  });

  it('parses signed success webhook back into internal payment event', () => {
    const service = new EpayService(CONFIG);
    const payload = {
      out_trade_no: 'order_456',
      trade_no: 'epay_trade_789',
      trade_status: 'TRADE_SUCCESS',
      type: 'alipay',
      money: '80.00',
    };
    const webhook = service.parseWebhook({
      ...payload,
      sign: createSignature(payload, CONFIG.key),
      sign_type: 'MD5',
    });

    assert.equal(webhook.orderId, 'order_456');
    assert.equal(webhook.providerOrderId, 'epay_trade_789');
    assert.equal(webhook.status, 'paid');
    assert.equal(webhook.eventId, 'epay_trade_789:paid');
    assert.ok(webhook.paidAt);
  });
});
