import assert from 'node:assert/strict';

import { clickByText, readBodyText, screenshot, waitFor } from '../shared/cdp/cdp-helpers.mjs';
import { authenticateDesktopPage, openDesktopPage } from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-investment-experts-menu-open.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);

    await clickByText(page.cdp, ['智能投资专家'], { exact: true });

    const expertsState = await waitFor(
      'investment experts menu surface',
      async () => {
        const body = await readBodyText(page.cdp, 5000);
        return body.includes('全部专家') && body.includes('我的专家') && body.includes('AI智能体')
          ? { body }
          : null;
      },
      20_000,
      500,
    );

    assert.ok(expertsState.body.includes('智能投资专家') || expertsState.body.includes('AI智能体'), 'investment experts surface should render after clicking sidebar menu');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          expertsState,
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
