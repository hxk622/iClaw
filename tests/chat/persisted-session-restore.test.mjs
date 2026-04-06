import assert from 'node:assert/strict';

import {evalJSON, insertText, reloadPage, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';
import {
  activeSurfaceExpression,
  authenticateDesktopPage,
  openDesktopPage,
  readActiveChatState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-chat-persisted-session-restore.png';

async function main() {
  const page = await openDesktopPage();
  const prompt = `persisted restore smoke ${Date.now()}`;

  try {
    await authenticateDesktopPage(page);
    await waitForChatComposer(page.cdp);

    await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
        if (!(editor instanceof HTMLElement)) {
          return false;
        }
        editor.focus();
        return true;
      `),
    );
    await insertText(page.cdp, prompt);
    await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
        if (!(submit instanceof HTMLButtonElement)) {
          return false;
        }
        submit.click();
        return true;
      `),
    );

    const beforeReload = await waitFor(
      'sent conversation before reload',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
      },
      60_000,
      1_000,
    );

    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    const afterReload = await waitFor(
      'restored conversation after reload',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
      },
      30_000,
      1_000,
    );

    assert.equal(afterReload.activeSurfaceKey, beforeReload.activeSurfaceKey, 'active session should restore after reload');
    assert.ok(afterReload.userTexts.some((text) => text.includes(prompt)), 'restored session should retain sent prompt');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, prompt, beforeReload, afterReload, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
