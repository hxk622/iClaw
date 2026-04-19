import assert from 'node:assert/strict';

import { click, evalJSON, reloadPage, screenshot, waitFor } from '../shared/cdp/cdp-helpers.mjs';
import {
  closeInitialGuestLoginModalIfPresent,
  openDesktopPage,
  resetGuestBootstrapState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-workspace-tabs-switch-and-close.png';

async function readWorkspaceTabs(cdp) {
  return evalJSON(
    cdp,
    `(() => Array.from(document.querySelectorAll('[data-testid="workspace-tab-item"]')).map((node) => ({
      id: node.getAttribute('data-workspace-tab-id'),
      active: node.getAttribute('data-workspace-tab-active') === 'true',
      title: node.getAttribute('data-workspace-tab-title'),
    })))()`,
  );
}

async function waitForTabCount(cdp, expected) {
  return waitFor(
    `workspace tab count ${expected}`,
    async () => {
      const tabs = await readWorkspaceTabs(cdp);
      return Array.isArray(tabs) && tabs.length === expected ? tabs : null;
    },
    20_000,
    300,
  );
}

async function waitForActiveTab(cdp, tabId) {
  return waitFor(
    `workspace active tab ${tabId}`,
    async () => {
      const tabs = await readWorkspaceTabs(cdp);
      return tabs?.find((tab) => tab.id === tabId)?.active === true ? tabs : null;
    },
    20_000,
    300,
  );
}

async function seedWorkspaceTabsSnapshot(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const routeSnapshot = JSON.parse(
        localStorage.getItem('caiclaw:desktop.active-chat-route.v1:scope:guest')
        || localStorage.getItem('iclaw.desktop.active-chat-route.v1:scope:guest')
        || 'null',
      );
      const sessionKey = routeSnapshot?.sessionKey || 'agent:main';
      const now = new Date().toISOString();
      const snapshot = {
        version: 1,
        activeTabId: 'tab-c',
        tabs: [
          {
            id: 'tab-a',
            kind: 'chat',
            color: 'default',
            title: '新对话 1',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':tab-a',
              initialPrompt: null,
              initialPromptKey: null,
              focusedTurnId: null,
              focusedTurnKey: null,
              initialAgentSlug: null,
              initialSkillSlug: null,
              initialSkillOption: null,
              initialStockContext: null,
            },
          },
          {
            id: 'tab-b',
            kind: 'chat',
            color: 'default',
            title: '新对话 2',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':tab-b',
              initialPrompt: null,
              initialPromptKey: null,
              focusedTurnId: null,
              focusedTurnKey: null,
              initialAgentSlug: null,
              initialSkillSlug: null,
              initialSkillOption: null,
              initialStockContext: null,
            },
          },
          {
            id: 'tab-c',
            kind: 'chat',
            color: 'default',
            title: '新对话 3',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':tab-c',
              initialPrompt: null,
              initialPromptKey: null,
              focusedTurnId: null,
              focusedTurnKey: null,
              initialAgentSlug: null,
              initialSkillSlug: null,
              initialSkillOption: null,
              initialStockContext: null,
            },
          },
        ],
      };
      localStorage.setItem('caiclaw:desktop.workspace-tabs.v1:scope:guest', JSON.stringify(snapshot));
      localStorage.setItem('iclaw.desktop.active-workspace-scene.v1', JSON.stringify({primaryView: 'chat'}));
      return snapshot;
    })()`,
  );
}

async function main() {
  const page = await openDesktopPage();

  try {
    await resetGuestBootstrapState(page.cdp);
    await closeInitialGuestLoginModalIfPresent(page.cdp);
    await waitForChatComposer(page.cdp);

    const seededSnapshot = await seedWorkspaceTabsSnapshot(page.cdp);
    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    const tabsAfterThird = await waitForTabCount(page.cdp, 3);
    const [tabA, tabB, tabC] = tabsAfterThird;
    assert.equal(tabC?.active, true, 'seeded third tab should be active after reload');
    assert.equal(seededSnapshot.activeTabId, 'tab-c');

    await click(page.cdp, `[data-testid="workspace-tab-item"][data-workspace-tab-id="${tabA.id}"]`);
    await waitForActiveTab(page.cdp, tabA.id);

    await click(page.cdp, `[data-testid="workspace-tab-item"][data-workspace-tab-id="${tabB.id}"]`);
    await waitForActiveTab(page.cdp, tabB.id);

    await click(page.cdp, `[data-testid="workspace-tab-close"][data-workspace-tab-id="${tabB.id}"]`);

    const tabsAfterClose = await waitForTabCount(page.cdp, 2);
    assert.ok(
      tabsAfterClose.every((tab) => tab.id !== tabB.id),
      'closed tab should be removed from workspace tab list',
    );
    assert.ok(
      tabsAfterClose.find((tab) => tab.id === tabA.id)?.active,
      'closing the active tab should fall back to the most recently visited surviving tab',
    );

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          tabsAfterThird,
          tabsAfterClose,
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
