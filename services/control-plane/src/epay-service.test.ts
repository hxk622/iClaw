
import {describe, it, mock} from 'node:test';
import assert from 'node:assert';

import {EpayService} from './epay-service.js';
import {ControlPlaneStore} from './store.js';
import {CreatePaymentOrderInput} from './domain.js';

// Mock the ControlPlaneStore
const mockStore: any = {
  createPaymentOrder: mock.fn(),
  getPaymentProviderProfileByScope: mock.fn(),
};

import {TOPUP_PACKAGES} from './service.js';

describe('EpayService', () => {
  it('should create an epay payment order and return purchase details', async () => {
    // 1. Setup Mocks
    const mockOrder = {
      id: 'test_order_123',
      userId: 'user_abc',
      packageName: '1000 龙虾币',
      amountCnyFen: 1000,
      returnUrl: 'http://localhost/payment-return',
    };

    const mockProfile = {
        id: 'profile_1',
        provider: 'epay',
        scopeType: 'app',
        scopeKey: 'default',
        config: {
            epayPartnerId: '12345',
            epayGateway: 'https://epay.example.com/submit.php',
        },
        secretPayloadEncrypted: 'encrypted_secrets',
    };

    (mockStore.createPaymentOrder as any).mock.mockImplementation(() => Promise.resolve(mockOrder));
    (mockStore.getPaymentProviderProfileByScope as any).mock.mockImplementation(() => Promise.resolve(mockProfile));

    TOPUP_PACKAGES.set('custom_1_yuan', {
        packageName: '1元测试订单',
        credits: 0,
        bonusCredits: 0,
        amountCnyFen: 100,
    });

    const mockDecryptSecret = mock.fn(() => ({ epayKey: 'test_secret_key' }));

    // 2. Instantiate the service with mocks
    const epayService = new EpayService(mockStore as ControlPlaneStore, mockDecryptSecret, 'http://localhost:2130');

    // 3. Call the method
    const input: CreatePaymentOrderInput = {
      package_id: 'topup_1000',
      provider: 'epay',
      app_name: 'default',
    };

    const result = await epayService.createEpayPaymentOrder('user_abc', input);

    // 4. Assertions
    assert(result, 'Result should be defined');
    assert.strictEqual(result.gateway, 'https://epay.example.com/submit.php');
    assert.strictEqual(result.params.pid, '12345');
    assert.strictEqual(result.params.out_trade_no, 'test_order_123');
    assert.strictEqual(result.params.money, '10.00');
    assert.strictEqual(result.params.name, '1000 龙虾币');
    assert.strictEqual(result.params.notify_url, 'http://localhost:2130/api/epay/webhooks');
    assert(result.params.sign, 'Sign should be defined');
    assert.strictEqual(result.params.sign_type, 'MD5');

    // Verify that the store method was called correctly
    assert.strictEqual((mockStore.createPaymentOrder as any).mock.calls.length, 1);
  });

  it.skip('should generate a real payment URL with actual credentials', async () => {
    // 1. Setup Mocks with real data
    const realConfig = {
      gateway: 'https://vip1.zhunfu.cn/submit.php',
      partnerId: '1242',
      key: '5yr5JZxRXxDR5yuxV7z5p7yxbybU5Bxj',
    };

    const mockOrder = {
      id: `test_order_${Date.now()}`,
      userId: 'user_real_deal',
      packageName: '1元测试订单',
      amountCnyFen: 100, // 1元
      returnUrl: 'http://localhost/payment-return',
    };

    const mockProfile = {
      id: 'profile_real',
      provider: 'epay',
      scopeType: 'app',
      scopeKey: 'default',
      config: {
        epayPartnerId: realConfig.partnerId,
        epayGateway: realConfig.gateway,
      },
      secretPayloadEncrypted: 'encrypted_secrets',
    };

    (mockStore.createPaymentOrder as any).mock.mockImplementation(() => Promise.resolve(mockOrder));
    (mockStore.getPaymentProviderProfileByScope as any).mock.mockImplementation(() => Promise.resolve(mockProfile));

    const mockDecryptSecret = mock.fn(() => ({ epayKey: realConfig.key }));

    // 2. Instantiate the service
    const epayService = new EpayService(mockStore as ControlPlaneStore, mockDecryptSecret, 'http://localhost:2130');

    // 3. Call the method
    const input: CreatePaymentOrderInput = {
      package_id: 'custom_1_yuan', // Using a custom package id for clarity
      provider: 'epay',
      app_name: 'default',
    };

    const result = await epayService.createEpayPaymentOrder('user_real_deal', input);

    // 4. Construct and log the URL
    const url = new URL(result.gateway);
    Object.keys(result.params).forEach(key => url.searchParams.append(key, result.params[key]));

    console.log('\n\n✅ Epay Payment URL Generated:');
    console.log(url.toString());
    console.log('\n');

    // 5. Assertions (optional for this test, but good practice)
    assert(result.params.sign, 'A real sign should be generated');
    assert.strictEqual(result.params.money, '1.00');
  });
});

