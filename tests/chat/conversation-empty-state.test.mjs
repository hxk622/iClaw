import assert from 'node:assert/strict';

import {evalJSON, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';
import {authenticateDesktopPage, openDesktopPage, waitForChatComposer} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-chat-conversation-empty-state.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await waitForChatComposer(page.cdp);

    await evalJSON(
      page.cdp,
      `(() => {
        const keys = Object.keys(localStorage).filter((key) =>
          key.includes('chat.') ||
          key.includes('conversation') ||
          key.includes('active-general-chat-session') ||
          key.includes('active-chat-route'),
        );
        for (const key of keys) {
          localStorage.removeItem(key);
        }
        return keys;
      })()`,
    );

    await page.cdp.send('Page.reload', {ignoreCache: true});
    await waitForChatComposer(page.cdp);

    const state = await waitFor(
      'empty or welcome state',
      async () =>
        evalJSON(
          page.cdp,
          `(() => {
            const body = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
            return {
              body,
              hasWelcome: body.includes('我能为你做什么'),
              hasNewChat: body.includes('新建对话'),
              chatGroups: document.querySelectorAll('.chat-group').length,
            };
          })()`,
        ).then((value) => (value && (value.hasWelcome || value.hasNewChat || value.chatGroups === 0) ? value : null)),
      20_000,
      500,
    );

    assert.ok(state.hasWelcome || state.hasNewChat || state.chatGroups === 0, 'empty-history state should remain usable');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(JSON.stringify({ok: true, state, screenshot: savedPath}, null, 2));
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
