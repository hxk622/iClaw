import assert from 'node:assert/strict';

import {openIsolatedPage, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';

const CALLBACK_URL =
  process.env.ICLAW_OAUTH_CALLBACK_TEST_URL ||
  'http://127.0.0.1:1520/oauth-callback.html?code=test-code&state=login';
const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-auth-oauth-callback-complete.png';

async function main() {
  const page = await openIsolatedPage(CALLBACK_URL);

  try {
    const finalState = await waitFor(
      'oauth callback lands on app root',
      async () => {
        const result = await page.cdp.send('Runtime.evaluate', {
          expression: `(() => ({
            href: location.href,
            body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500),
          }))()`,
          returnByValue: true,
          awaitPromise: true,
        });
        const value = result.result?.value;
        return value?.href === 'http://127.0.0.1:1520/' ? value : null;
      },
      10_000,
      300,
    );

    assert.equal(finalState.href, 'http://127.0.0.1:1520/', 'callback page without opener should redirect to root');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, callbackUrl: CALLBACK_URL, finalState, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
