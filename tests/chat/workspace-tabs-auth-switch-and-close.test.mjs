import assert from 'node:assert/strict';

import { click, evalJSON, reloadPage, screenshot, waitFor } from '../shared/cdp/cdp-helpers.mjs';
import {
  authenticateDesktopPage,
  openDesktopPage,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-workspace-tabs-auth-switch-and-close.png';

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
      const routeKeys = Array.from({length: localStorage.length}, (_, index) => localStorage.key(index))
        .filter((key) => typeof key === 'string' && key.includes('desktop.active-chat-route.v1:scope:'));
      const activeRouteKey =
        routeKeys.find((key) => !String(key).endsWith(':scope:guest'))
        || routeKeys[0]
        || null;
      if (!activeRouteKey) {
        return null;
      }
      const prefix = activeRouteKey.replace(/:desktop\\.active-chat-route\\.v1:scope:.+$/, '');
      const scope = activeRouteKey.match(/:scope:(.+)$/)?.[1] || 'guest';
      const routeSnapshot = JSON.parse(localStorage.getItem(activeRouteKey) || 'null');
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
            title: '认证对话 1',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':auth-tab-a',
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
            title: '认证对话 2',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':auth-tab-b',
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
            title: '认证对话 3',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: sessionKey + ':auth-tab-c',
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
      localStorage.setItem(prefix + ':desktop.workspace-tabs.v1:scope:' + scope, JSON.stringify(snapshot));
      return { prefix, scope, snapshot };
    })()`,
  );
}

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await waitForChatComposer(page.cdp);

    const seeded = await seedWorkspaceTabsSnapshot(page.cdp);
    assert.ok(seeded?.snapshot, 'expected to seed authenticated workspace tabs snapshot');

    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    const tabsAfterThird = await waitForTabCount(page.cdp, 3);
    const [tabA, tabB, tabC] = tabsAfterThird;
    assert.equal(tabC?.active, true, 'seeded third authenticated tab should be active after reload');

    await click(page.cdp, `[data-testid="workspace-tab-item"][data-workspace-tab-id="${tabA.id}"]`);
    await waitForActiveTab(page.cdp, tabA.id);

    await click(page.cdp, `[data-testid="workspace-tab-item"][data-workspace-tab-id="${tabB.id}"]`);
    await waitForActiveTab(page.cdp, tabB.id);

    await click(page.cdp, `[data-testid="workspace-tab-close"][data-workspace-tab-id="${tabB.id}"]`);

    const tabsAfterClose = await waitForTabCount(page.cdp, 2);
    assert.ok(
      tabsAfterClose.every((tab) => tab.id !== tabB.id),
      'closed authenticated tab should be removed from workspace tab list',
    );
    assert.ok(
      tabsAfterClose.find((tab) => tab.id === tabA.id)?.active,
      'closing the active authenticated tab should fall back to the most recently visited surviving tab',
    );

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          seeded,
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
