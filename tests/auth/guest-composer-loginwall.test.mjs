import assert from 'node:assert/strict';

import { evalJSON, readBodyText, screenshot, waitFor } from '../shared/cdp/cdp-helpers.mjs';
import {
  activeSurfaceExpression,
  closeInitialGuestLoginModalIfPresent,
  openDesktopPage,
  resetGuestBootstrapState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-auth-guest-composer-loginwall.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await resetGuestBootstrapState(page.cdp);

    const initialGuestState = await waitFor(
      'initial guest loginwall',
      async () => {
        const body = await readBodyText(page.cdp, 2000);
        return body.includes('登录以继续使用账户与额度体系') || body.includes('登录') ? body : null;
      },
      20_000,
      500,
    );

    assert.ok(initialGuestState.includes('登录'), 'guest mode should still trigger the loginwall');

    await closeInitialGuestLoginModalIfPresent(page.cdp);
    await waitForChatComposer(page.cdp);

    const guestComposerVisible = await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
        const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
        return editor instanceof HTMLElement && submit instanceof HTMLButtonElement
          ? {
              editorVisible: getComputedStyle(editor).display !== 'none',
              submitDisabled: submit.disabled,
            }
          : null;
      `),
    );

    assert.equal(guestComposerVisible?.editorVisible, true, 'guest mode should keep the composer visible after dismissing the loginwall');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          guestComposerVisible,
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
