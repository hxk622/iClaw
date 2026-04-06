import assert from 'node:assert/strict';

import {
  click,
  openIsolatedPage,
  readValue,
  screenshot,
  setInputValue,
  waitFor,
  waitForSelector,
} from '../shared/cdp/cdp-helpers.mjs';

const ADMIN_URL = process.env.ICLAW_ADMIN_URL || 'http://127.0.0.1:1479';
const ADMIN_USERNAME = process.env.ICLAW_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ICLAW_ADMIN_PASSWORD || 'admin';
const EXPECTED_PARTNER_ID = process.env.ICLAW_TEST_PAYMENT_PARTNER_ID || '';
const EXPECTED_GATEWAY = process.env.ICLAW_TEST_PAYMENT_GATEWAY || '';
const EXPECTED_KEY = process.env.ICLAW_TEST_PAYMENT_KEY || '';
const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-admin-gateway-read.png';

async function main() {
  const page = await openIsolatedPage(ADMIN_URL);
  try {
    await waitForSelector(page.cdp, '[data-testid="admin-login-form"]');
    await setInputValue(page.cdp, '[data-testid="admin-login-identifier"]', ADMIN_USERNAME);
    await setInputValue(page.cdp, '[data-testid="admin-login-password"]', ADMIN_PASSWORD);
    await click(page.cdp, '[data-testid="admin-login-submit"]');

    await waitForSelector(page.cdp, '[data-page="payments-config"]', 30_000);
    await click(page.cdp, '[data-page="payments-config"]');
    await waitForSelector(page.cdp, '[data-testid="payment-provider-tab-platform"]');
    await click(page.cdp, '[data-testid="payment-provider-tab-platform"]');
    await waitForSelector(page.cdp, '[data-testid="payment-gateway-form"]');

    await waitFor(
      'payment gateway values',
      async () => {
        const partnerId = String(await readValue(page.cdp, '[data-testid="payment-gateway-partner-id"]') || '').trim();
        const gateway = String(await readValue(page.cdp, '[data-testid="payment-gateway-endpoint"]') || '').trim();
        const key = String(await readValue(page.cdp, '[data-testid="payment-gateway-key"]') || '').trim();
        return partnerId && gateway && key ? {partnerId, gateway, key} : null;
      },
      30_000,
      250,
    );

    const partnerId = String(await readValue(page.cdp, '[data-testid="payment-gateway-partner-id"]') || '').trim();
    const gateway = String(await readValue(page.cdp, '[data-testid="payment-gateway-endpoint"]') || '').trim();
    const key = String(await readValue(page.cdp, '[data-testid="payment-gateway-key"]') || '').trim();

    assert.ok(partnerId, 'partner_id should not be empty');
    assert.ok(gateway, 'gateway should not be empty');
    assert.ok(key, 'key should not be empty');
    if (EXPECTED_PARTNER_ID) {
      assert.equal(partnerId, EXPECTED_PARTNER_ID, 'partner_id mismatch');
    }
    if (EXPECTED_GATEWAY) {
      assert.equal(gateway, EXPECTED_GATEWAY, 'gateway mismatch');
    }
    if (EXPECTED_KEY) {
      assert.equal(key, EXPECTED_KEY, 'key mismatch');
    }

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          partner_id: partnerId,
          gateway,
          key,
          screenshot: savedPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
