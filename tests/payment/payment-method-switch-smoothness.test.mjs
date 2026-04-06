import assert from 'node:assert/strict';

import {click, evalJSON, screenshot, waitFor, waitForSelector} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, openRechargeCenter} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-method-switch-smoothness.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await openRechargeCenter(page.cdp);
    await waitForSelector(page.cdp, '[data-testid="recharge-package-view"]', 20_000);
    await click(page.cdp, '[data-testid="recharge-package-continue"]');
    await waitForSelector(page.cdp, '[data-testid="recharge-payment-view"]', 30_000);
    await waitForSelector(page.cdp, '[data-testid="recharge-qr-image"]', 30_000);

    const beforeSwitch = await evalJSON(
      page.cdp,
      `(() => ({
        qrImage: document.querySelector('[data-testid="recharge-qr-image"]')?.getAttribute('src') || null,
        selectedMethod: document.querySelector('[data-testid="recharge-payment-method"][data-payment-method="wechat_qr"]')?.className.includes('border-green-600')
          ? 'wechat_qr'
          : 'alipay_qr',
      }))()`,
    );

    assert.ok(beforeSwitch?.qrImage, 'switch test requires an initial QR image');

    await evalJSON(
      page.cdp,
      `(() => {
        if (window.__iclawDelayedPaymentOrderFetchInstalled) {
          return true;
        }
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl =
            typeof input === 'string'
              ? input
              : input instanceof Request
                ? input.url
                : String(input?.url || '');
          const requestMethod = String(
            init?.method || (input instanceof Request ? input.method : '') || 'GET',
          ).toUpperCase();
          if (requestMethod === 'POST' && /\\/payments\\/orders(?:\\?|$)/.test(requestUrl)) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
          }
          return originalFetch(input, init);
        };
        window.__iclawDelayedPaymentOrderFetchInstalled = true;
        return true;
      })()`,
    );

    const nextMethod = beforeSwitch.selectedMethod === 'wechat_qr' ? 'alipay_qr' : 'wechat_qr';
    await click(page.cdp, `[data-testid="recharge-payment-method"][data-payment-method="${nextMethod}"]`);
    await waitForSelector(page.cdp, '[data-testid="recharge-qr-transition-mask"]', 10_000);

    const duringSwitch = await evalJSON(
      page.cdp,
      `(() => ({
        maskVisible: Boolean(document.querySelector('[data-testid="recharge-qr-transition-mask"]')),
        transitionKind:
          document.querySelector('[data-testid="recharge-qr-transition-mask"]')?.getAttribute('data-transition-kind') || null,
        transitionTitle:
          document.querySelector('[data-testid="recharge-qr-transition-title"]')?.textContent?.trim() || null,
        qrImage: document.querySelector('[data-testid="recharge-qr-image"]')?.getAttribute('src') || null,
        placeholderVisible: (document.body.innerText || '').includes('正在准备收款码'),
      }))()`,
    );

    assert.equal(duringSwitch.maskVisible, true, 'switching payment method should keep a transition overlay visible');
    assert.equal(duringSwitch.transitionKind, 'switch', 'switching payment method should use switch transition state');
    assert.ok(duringSwitch.transitionTitle?.includes('收款码'), 'transition overlay should explain current switch state');
    assert.equal(duringSwitch.placeholderVisible, false, 'switching payment method should not flash placeholder copy');
    assert.equal(
      duringSwitch.qrImage,
      beforeSwitch.qrImage,
      'switching payment method should preserve previous QR visually until the new order is ready',
    );

    const afterSwitch = await waitFor(
      'new qr after payment method switch',
      async () =>
        evalJSON(
          page.cdp,
          `(() => {
            const mask = document.querySelector('[data-testid="recharge-qr-transition-mask"]');
            const qrImage = document.querySelector('[data-testid="recharge-qr-image"]')?.getAttribute('src') || null;
            return !mask && qrImage && qrImage !== ${JSON.stringify(beforeSwitch.qrImage)}
              ? {qrImage}
              : null;
          })()`,
        ),
      30_000,
      250,
    );

    assert.ok(afterSwitch?.qrImage, 'payment method switch should eventually render a new QR');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, beforeSwitch, duringSwitch, afterSwitch, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
