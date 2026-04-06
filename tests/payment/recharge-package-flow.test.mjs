import assert from 'node:assert/strict';

import {click, evalJSON, screenshot, waitFor, waitForSelector} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, openRechargeCenter} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-recharge-package-flow.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await openRechargeCenter(page.cdp);
    await waitForSelector(page.cdp, '[data-testid="recharge-package-view"]', 20_000);

    const packageState = await evalJSON(
      page.cdp,
      `(() => ({
        packageView: Boolean(document.querySelector('[data-testid="recharge-package-view"]')),
        packageCount: document.querySelectorAll('[data-testid="recharge-package-card"]').length,
        packageTexts: Array.from(document.querySelectorAll('[data-testid="recharge-package-card"]'))
          .map((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim())
          .slice(0, 8),
      }))()`,
    );

    assert.equal(packageState.packageView, true, 'package selection view should be visible first');
    assert.ok(packageState.packageCount > 0, 'at least one recharge package should render');

    await click(page.cdp, '[data-testid="recharge-package-continue"]');

    const paymentState = await waitFor(
      'payment view after package continue',
      async () =>
        evalJSON(
          page.cdp,
          `(() => ({
            paymentView: Boolean(document.querySelector('[data-testid="recharge-payment-view"]')),
            backToPackages: Boolean(document.querySelector('[data-testid="recharge-back-to-packages"]')),
            body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
          }))()`,
        ).then((state) => (state?.paymentView ? state : null)),
      30_000,
      500,
    );

    assert.equal(paymentState.backToPackages, true, 'payment view should keep package back-navigation');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, packageState, paymentState, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
