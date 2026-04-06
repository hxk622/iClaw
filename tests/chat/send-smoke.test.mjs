import assert from 'node:assert/strict';

import {evalJSON, insertText, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';
import {
  activeSurfaceExpression,
  authenticateDesktopPage,
  openDesktopPage,
  readActiveChatState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH = process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-chat-send-smoke.png';

async function main() {
  const page = await openDesktopPage();
  const prompt = `chat send smoke ${Date.now()}`;

  try {
    await authenticateDesktopPage(page);
    await waitForChatComposer(page.cdp);

    const before = await readActiveChatState(page.cdp);
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

    const typed = await waitFor(
      'typed prompt appears in composer',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.bodyText.includes(prompt) || state.submitDisabled === false ? state : null;
      },
      10_000,
    );

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

    const afterSend = await waitFor(
      'new user message rendered',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
      },
      60_000,
      1_000,
    );

    assert.ok(typed.submitDisabled === false || typed.bodyText.includes(prompt), 'prompt should enable send flow');
    assert.ok(afterSend.userTexts.some((text) => text.includes(prompt)), 'user message should render after send');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, prompt, before, typed, afterSend, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
