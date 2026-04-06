import assert from 'node:assert/strict';

import {clickByText, evalJSON, insertText, screenshot, waitFor} from '../shared/cdp/cdp-helpers.mjs';
import {
  activeSurfaceExpression,
  authenticateDesktopPage,
  openDesktopPage,
  readActiveChatState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-chat-new-chat-create-and-switch.png';

async function main() {
  const page = await openDesktopPage();
  const prompt = `new chat switch smoke ${Date.now()}`;

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

    const originalConversation = await waitFor(
      'seed conversation appears',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
      },
      60_000,
      1_000,
    );

    await clickByText(page.cdp, ['新建对话'], {exact: true});

    const newConversation = await waitFor(
      'new chat opens',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.activeSurfaceKey !== originalConversation.activeSurfaceKey && !state.bodyText.includes(prompt)
          ? state
          : null;
      },
      20_000,
      500,
    );

    const promptSnippet = prompt.slice(0, 24);
    await clickByText(page.cdp, [promptSnippet, prompt], {exact: false});

    const restoredConversation = await waitFor(
      'switch back to seeded conversation',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
      },
      30_000,
      500,
    );

    assert.notEqual(newConversation.activeSurfaceKey, originalConversation.activeSurfaceKey, 'new chat should open a new surface');
    assert.ok(restoredConversation.userTexts.some((text) => text.includes(prompt)), 'should switch back to original conversation');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          prompt,
          originalConversation,
          newConversation,
          restoredConversation,
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
