import assert from 'node:assert/strict';

import {
  click,
  openIsolatedPage,
  readBodyText,
  readValue,
  screenshot,
  setInputValue,
  waitFor,
  waitForSelector,
} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, openRechargeCenter} from '../shared/iclaw-app-helpers.mjs';

const ADMIN_URL = process.env.ICLAW_ADMIN_URL || 'http://127.0.0.1:1479';
const ADMIN_USERNAME = process.env.ICLAW_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ICLAW_ADMIN_PASSWORD || 'admin';
const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-misconfigured-gateway-error.png';
const MUTATION_FLAG = process.env.ICLAW_ALLOW_PAYMENT_GATEWAY_MUTATION;

async function openAdminPaymentGatewayPage() {
  const page = await openIsolatedPage(ADMIN_URL);
  await waitForSelector(page.cdp, '[data-testid="admin-login-form"]');
  await setInputValue(page.cdp, '[data-testid="admin-login-identifier"]', ADMIN_USERNAME);
  await setInputValue(page.cdp, '[data-testid="admin-login-password"]', ADMIN_PASSWORD);
  await click(page.cdp, '[data-testid="admin-login-submit"]');
  await waitForSelector(page.cdp, '[data-page="payments-config"]', 30_000);
  await click(page.cdp, '[data-page="payments-config"]');
  await waitForSelector(page.cdp, '[data-testid="payment-provider-tab-platform"]');
  await click(page.cdp, '[data-testid="payment-provider-tab-platform"]');
  await waitForSelector(page.cdp, '[data-testid="payment-gateway-form"]');
  return page;
}

async function saveGatewayForm(page, values) {
  await setInputValue(page.cdp, '[data-testid="payment-gateway-partner-id"]', values.partnerId ?? '');
  await setInputValue(page.cdp, '[data-testid="payment-gateway-endpoint"]', values.gateway ?? '');
  await setInputValue(page.cdp, '[data-testid="payment-gateway-key"]', values.key ?? '');
  await click(page.cdp, '[data-testid="payment-gateway-save"]');
  await waitFor(
    'gateway save notice',
    async () => {
      const body = await readBodyText(page.cdp, 1000);
      return body.includes('已保存') || body.includes('保存失败') ? body : null;
    },
    20_000,
    500,
  );
}

async function main() {
  assert.equal(
    MUTATION_FLAG,
    '1',
    'set ICLAW_ALLOW_PAYMENT_GATEWAY_MUTATION=1 before running this destructive admin-payment test',
  );

  const adminPage = await openAdminPaymentGatewayPage();
  const desktopPage = await openDesktopPage();

  let originalValues = null;
  try {
    originalValues = {
      partnerId: String(await readValue(adminPage.cdp, '[data-testid="payment-gateway-partner-id"]') || ''),
      gateway: String(await readValue(adminPage.cdp, '[data-testid="payment-gateway-endpoint"]') || ''),
      key: String(await readValue(adminPage.cdp, '[data-testid="payment-gateway-key"]') || ''),
    };

    await saveGatewayForm(adminPage, {partnerId: '', gateway: '', key: ''});

    await authenticateDesktopPage(desktopPage);
    await openRechargeCenter(desktopPage.cdp);
    await waitForSelector(desktopPage.cdp, '[data-testid="recharge-package-view"]', 20_000);
    await click(desktopPage.cdp, '[data-testid="recharge-package-continue"]');

    const errorState = await waitFor(
      'user-visible payment failure',
      async () => {
        const body = await readBodyText(desktopPage.cdp, 2000);
        return body.includes('支付失败') || body.includes('重试创建订单') || body.includes('配置') ? {body} : null;
      },
      30_000,
      1_000,
    );

    assert.ok(
      errorState.body.includes('支付失败') || errorState.body.includes('重试创建订单') || errorState.body.includes('配置'),
      'misconfigured gateway should surface a user-visible failure',
    );

    const savedPath = await screenshot(desktopPage.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, errorState, screenshot: savedPath}, null, 2));
  } finally {
    if (originalValues) {
      await saveGatewayForm(adminPage, originalValues).catch(() => {});
    }
    await adminPage.close();
    await desktopPage.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
