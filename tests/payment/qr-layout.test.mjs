import assert from 'node:assert/strict';

import {click, evalJSON, screenshot, waitFor, waitForSelector} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, openRechargeCenter} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH = process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-qr-layout.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await openRechargeCenter(page.cdp);
    await waitForSelector(page.cdp, '[data-testid="recharge-package-view"]', 20_000);
    await click(page.cdp, '[data-testid="recharge-package-continue"]');

    await waitForSelector(page.cdp, '[data-testid="recharge-payment-view"]', 30_000);
    await waitForSelector(page.cdp, '[data-testid="recharge-qr-container"]', 30_000);

    const layout = await evalJSON(
      page.cdp,
      `(() => {
        const card = document.querySelector('[data-testid="recharge-qr-card"]');
        const qr = document.querySelector('[data-testid="recharge-qr-container"]');
        const view = document.querySelector('[data-testid="recharge-payment-view"]');
        if (!(card instanceof HTMLElement) || !(qr instanceof HTMLElement) || !(view instanceof HTMLElement)) {
          return null;
        }
        const cardStyle = getComputedStyle(card);
        const qrRect = qr.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        return {
          cardScrollHeight: card.scrollHeight,
          cardClientHeight: card.clientHeight,
          cardOverflowY: cardStyle.overflowY,
          qrVisible: qrRect.width > 0 && qrRect.height > 0,
          qrWithinView:
            qrRect.top >= viewRect.top &&
            qrRect.left >= viewRect.left &&
            qrRect.bottom <= viewRect.bottom &&
            qrRect.right <= viewRect.right,
        };
      })()`,
    );

    assert.ok(layout, 'qr layout metrics should be readable');
    assert.equal(layout.qrVisible, true, 'qr container should be visible');
    assert.equal(layout.qrWithinView, true, 'qr container should fit within payment view');
    assert.ok(
      layout.cardScrollHeight <= layout.cardClientHeight || layout.cardOverflowY === 'hidden',
      'qr card should not require inner scrolling',
    );

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, layout, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
