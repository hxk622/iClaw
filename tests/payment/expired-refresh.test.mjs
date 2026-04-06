import assert from 'node:assert/strict';

import {click, evalJSON, screenshot, waitFor, waitForSelector} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, openRechargeCenter} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH = process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-expired-refresh.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await openRechargeCenter(page.cdp);
    await waitForSelector(page.cdp, '[data-testid="recharge-package-view"]', 20_000);
    await click(page.cdp, '[data-testid="recharge-package-continue"]');
    await waitForSelector(page.cdp, '[data-testid="recharge-payment-view"]', 30_000);
    await waitForSelector(page.cdp, '[data-testid="recharge-qr-container"]', 30_000);

    const beforeExpire = await evalJSON(
      page.cdp,
      `(() => ({
        qrImage: document.querySelector('[data-testid="recharge-qr-image"]')?.getAttribute('src') || null,
        orderText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim(),
      }))()`,
    );

    await evalJSON(
      page.cdp,
      `(() => {
        const original = Date.now.bind(Date);
        const advanceMs = 16 * 60 * 1000;
        Date.now = () => original() + advanceMs;
        window.dispatchEvent(new Event('focus'));
        return true;
      })()`,
    );

    await waitForSelector(page.cdp, '[data-testid="recharge-qr-expired-mask"]', 10_000);
    await click(page.cdp, '[data-testid="recharge-qr-refresh"]');

    const afterRefresh = await waitFor(
      'refreshed qr after expired refresh',
      async () =>
        evalJSON(
          page.cdp,
          `(() => {
            const mask = document.querySelector('[data-testid="recharge-qr-expired-mask"]');
            const image = document.querySelector('[data-testid="recharge-qr-image"]');
            const src = image?.getAttribute('src') || null;
            return !mask && src ? {qrImage: src} : null;
          })()`,
        ),
      30_000,
      1_000,
    );

    assert.ok(beforeExpire.qrImage, 'payment flow should have an initial qr image');
    assert.ok(afterRefresh.qrImage, 'refresh should produce a qr image after expiry');
    assert.notEqual(afterRefresh.qrImage, beforeExpire.qrImage, 'refresh after expiry should generate a new qr');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, beforeExpire, afterRefresh, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
