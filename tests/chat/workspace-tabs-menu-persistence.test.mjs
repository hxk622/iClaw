import assert from 'node:assert/strict';

import { click, evalJSON, reloadPage, screenshot, waitFor } from '../shared/cdp/cdp-helpers.mjs';
import {
  closeInitialGuestLoginModalIfPresent,
  openDesktopPage,
  resetGuestBootstrapState,
  waitForChatComposer,
} from '../shared/iclaw-app-helpers.mjs';

const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-workspace-tabs-menu-persistence.png';

async function ensureCdpReady() {
  try {
    const response = await fetch('http://127.0.0.1:9223/json/version');
    if (!response.ok) {
      throw new Error(`cdp status ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `workspace-tabs-menu-persistence test requires Chrome CDP on 127.0.0.1:9223. Start the desktop browser debug target first. Root cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function readWorkspaceTabs(cdp) {
  return evalJSON(
    cdp,
    `(() => Array.from(document.querySelectorAll('[data-testid="workspace-tab-item"]')).map((node) => ({
      id: node.getAttribute('data-workspace-tab-id'),
      active: node.getAttribute('data-workspace-tab-active') === 'true',
      title: node.getAttribute('data-workspace-tab-title'),
      color: node.getAttribute('data-workspace-tab-color'),
    })))()`,
  );
}

async function waitForTabOrder(cdp, expectedIds) {
  return waitFor(
    `workspace tab order ${expectedIds.join(',')}`,
    async () => {
      const tabs = await readWorkspaceTabs(cdp);
      const ids = Array.isArray(tabs) ? tabs.map((tab) => tab.id) : [];
      return JSON.stringify(ids) === JSON.stringify(expectedIds) ? tabs : null;
    },
    20_000,
    300,
  );
}

async function openWorkspaceTabContextMenu(cdp, tabId) {
  const opened = await evalJSON(
    cdp,
    `(() => {
      const el = document.querySelector('[data-testid="workspace-tab-item"][data-workspace-tab-id="${tabId}"]');
      if (!(el instanceof HTMLElement)) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: rect.left + 20,
        clientY: rect.bottom - 8,
        view: window,
      }));
      return true;
    })()`,
  );
  assert.equal(opened, true, `failed to open tab context menu for ${tabId}`);
}

async function setReactInputValue(cdp, selector, value) {
  const updated = await evalJSON(
    cdp,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement)) {
        return false;
      }
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (!descriptor?.set) {
        return false;
      }
      input.focus();
      descriptor.set.call(input, ${JSON.stringify(String(value))});
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      return input.value;
    })()`,
  );
  assert.equal(updated, value);
}

async function seedWorkspaceTabsSnapshot(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const now = new Date().toISOString();
      const snapshot = {
        version: 1,
        activeTabId: 'tab-a',
        tabs: [
          {
            id: 'tab-a',
            kind: 'chat',
            color: 'default',
            title: '对话 A',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: 'agent:main:guest-tab-a',
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
            title: '对话 B',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: 'agent:main:guest-tab-b',
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
            title: '对话 C',
            titleSource: 'user',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            lastVisitedAt: now,
            route: {
              conversationId: null,
              sessionKey: 'agent:main:guest-tab-c',
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
  await ensureCdpReady();
  const page = await openDesktopPage();
  const renamedTitle = `固定后的标签 ${String(Date.now()).slice(-4)}`;

  try {
    await resetGuestBootstrapState(page.cdp);
    await closeInitialGuestLoginModalIfPresent(page.cdp);
    await waitForChatComposer(page.cdp);

    await seedWorkspaceTabsSnapshot(page.cdp);
    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    await waitForTabOrder(page.cdp, ['tab-a', 'tab-b', 'tab-c']);

    await openWorkspaceTabContextMenu(page.cdp, 'tab-b');
    await click(page.cdp, '[data-testid="workspace-tab-menu-pin"][data-workspace-tab-id="tab-b"]');
    await waitForTabOrder(page.cdp, ['tab-b', 'tab-a', 'tab-c']);

    await openWorkspaceTabContextMenu(page.cdp, 'tab-b');
    await click(page.cdp, '[data-testid="workspace-tab-menu-color"][data-workspace-tab-id="tab-b"][data-workspace-tab-color-option="rose"]');
    await waitFor(
      'workspace tab rose color',
      async () => {
        const tabs = await readWorkspaceTabs(page.cdp);
        return tabs?.find((tab) => tab.id === 'tab-b')?.color === 'rose' ? tabs : null;
      },
      20_000,
      300,
    );

    await openWorkspaceTabContextMenu(page.cdp, 'tab-b');
    await click(page.cdp, '[data-testid="workspace-tab-menu-rename"][data-workspace-tab-id="tab-b"]');
    await setReactInputValue(
      page.cdp,
      '[data-testid="workspace-tab-rename-input"][data-workspace-tab-id="tab-b"]',
      renamedTitle,
    );
    await evalJSON(
      page.cdp,
      `(() => {
        const input = document.querySelector('[data-testid="workspace-tab-rename-input"][data-workspace-tab-id="tab-b"]');
        if (!(input instanceof HTMLInputElement)) {
          return false;
        }
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        return true;
      })()`,
    );

    await waitFor(
      'workspace tab title renamed',
      async () => {
        const tabs = await readWorkspaceTabs(page.cdp);
        return tabs?.find((tab) => tab.id === 'tab-b')?.title === renamedTitle ? tabs : null;
      },
      20_000,
      300,
    );

    await reloadPage(page.cdp);
    await waitForChatComposer(page.cdp);

    const tabsAfterReload = await waitForTabOrder(page.cdp, ['tab-b', 'tab-a', 'tab-c']);
    assert.equal(
      tabsAfterReload.find((tab) => tab.id === 'tab-b')?.title,
      renamedTitle,
      'renamed tab title should persist after reload',
    );
    assert.equal(
      tabsAfterReload.find((tab) => tab.id === 'tab-b')?.color,
      'rose',
      'selected tab color should persist after reload',
    );

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          tabsAfterReload,
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
