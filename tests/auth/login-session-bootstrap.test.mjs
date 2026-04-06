import assert from 'node:assert/strict';

import {readBodyText, reloadPage, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';
import {
  authenticateDesktopPage,
  closeInitialGuestLoginModalIfPresent,
  openDesktopPage,
  resetGuestBootstrapState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-auth-login-session-bootstrap.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await resetGuestBootstrapState(page.cdp);

    const guestState = await waitFor(
      'guest bootstrap state',
      async () => {
        const body = await readBodyText(page.cdp, 2000);
        return body.includes('我能为你做什么') || body.includes('登录') ? {body} : null;
      },
      20_000,
      500,
    );

    await closeInitialGuestLoginModalIfPresent(page.cdp);
    await authenticateDesktopPage(page);
    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    const authedState = await waitFor(
      'authenticated bootstrap state',
      async () => {
        const body = await readBodyText(page.cdp, 2000);
        return body.includes('我能为你做什么') || body.includes('最近对话') ? {body} : null;
      },
      20_000,
      500,
    );

    assert.ok(guestState.body.includes('登录') || guestState.body.includes('我能为你做什么'), 'guest bootstrap should show guest-facing entry');
    assert.ok(!authedState.body.includes('登录以继续使用账户与额度体系'), 'authenticated bootstrap should not stay blocked on login prompt');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, guestState, authedState, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
