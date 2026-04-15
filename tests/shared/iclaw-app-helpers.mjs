import assert from 'node:assert/strict';

import {
  click,
  clickByText,
  evalJSON,
  openIsolatedPage,
  readBodyText,
  reloadPage,
  setLocalStorageItems,
  waitFor,
  waitForSelector,
} from './cdp/cdp-helpers.mjs';

export const DESKTOP_CHAT_URL = process.env.ICLAW_DESKTOP_URL || 'http://127.0.0.1:1520/chat?session=main';
export const CONTROL_PLANE_URL = process.env.ICLAW_CONTROL_PLANE_URL || 'http://127.0.0.1:2130';
export const ACCESS_KEY = 'iclaw:auth.access_token';
export const REFRESH_KEY = 'iclaw:auth.refresh_token';
export const ACTIVE_WORKSPACE_SCENE_STORAGE_KEY = 'iclaw.desktop.active-workspace-scene.v1';

export async function openDesktopPage(url = DESKTOP_CHAT_URL) {
  const page = await openIsolatedPage(url);
  await waitFor(
    'desktop bootstrap',
    async () => {
      const body = await readBodyText(page.cdp, 1200);
      return body ? body : null;
    },
    30_000,
  );
  return page;
}

export async function loginWithPassword() {
  const identifier = process.env.ICLAW_IDENTIFIER || process.env.ICLAW_ADMIN_USERNAME;
  const password = process.env.ICLAW_PASSWORD || process.env.ICLAW_ADMIN_PASSWORD;
  assert.ok(identifier, 'missing ICLAW_IDENTIFIER for authenticated user tests');
  assert.ok(password, 'missing ICLAW_PASSWORD for authenticated user tests');

  const response = await fetch(`${CONTROL_PLANE_URL}/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      identifier,
      email: identifier,
      password,
    }),
  });
  const payload = await response.json();
  const tokens = payload?.data?.tokens;
  assert.ok(response.ok, `login failed: ${JSON.stringify(payload)}`);
  assert.ok(tokens?.access_token, 'login response missing access_token');
  assert.ok(tokens?.refresh_token, 'login response missing refresh_token');
  return tokens;
}

export async function seedAuthTokens(cdp, tokens) {
  return setLocalStorageItems(cdp, {
    [ACCESS_KEY]: tokens?.access_token ?? null,
    [REFRESH_KEY]: tokens?.refresh_token ?? null,
  });
}

export async function clearAuthTokens(cdp) {
  return setLocalStorageItems(cdp, {
    [ACCESS_KEY]: null,
    [REFRESH_KEY]: null,
  });
}

export async function readStoredAuthTokens(cdp) {
  const tokens = await evalJSON(
    cdp,
    `(() => ({
      access_token: localStorage.getItem(${JSON.stringify(ACCESS_KEY)}),
      refresh_token: localStorage.getItem(${JSON.stringify(REFRESH_KEY)}),
    }))()`,
  );
  return {
    access_token: tokens?.access_token || null,
    refresh_token: tokens?.refresh_token || null,
  };
}

export async function authenticateDesktopPage(page) {
  const existingTokens = await readStoredAuthTokens(page.cdp);
  if (existingTokens.access_token && existingTokens.refresh_token) {
    await reloadPage(page.cdp);
    try {
      await waitForInteractiveChatComposer(page.cdp);
      return existingTokens;
    } catch (error) {
      console.warn('[tests] stored auth tokens were present but did not yield an authenticated desktop session', error);
    }
  }

  const tokens = await loginWithPassword();
  await seedAuthTokens(page.cdp, tokens);
  await reloadPage(page.cdp);
  await waitForInteractiveChatComposer(page.cdp);
  return tokens;
}

export function activeSurfaceExpression(body) {
  return `(() => {
    const shells = Array.from(document.querySelectorAll('.openclaw-chat-surface-shell'));
    const entries = shells.map((shell, index) => {
      const wrapper = shell.closest('[data-chat-surface-key]') || shell.parentElement || shell;
      const style = getComputedStyle(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const className = String(wrapper.className || '');
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.pointerEvents !== 'none' &&
        !className.includes('invisible');
      return {shell, wrapper, visible, index};
    });
    const activeEntry = entries.find((entry) => entry.visible) || null;
    const activeShell = activeEntry?.shell || null;
    const activeWrapper = activeEntry?.wrapper || null;
    ${body}
  })()`;
}

export async function waitForChatComposer(cdp) {
  await waitForSelector(cdp, '.openclaw-chat-surface-shell', 30_000);
  return waitFor(
    'chat composer ready',
    async () =>
      evalJSON(
        cdp,
        activeSurfaceExpression(`
          const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
          const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
          return editor && submit ? true : null;
        `),
      ),
    30_000,
  );
}

export async function waitForInteractiveChatComposer(cdp) {
  await waitForChatComposer(cdp);
  return waitFor(
    'interactive chat composer ready',
    async () =>
      evalJSON(
        cdp,
        activeSurfaceExpression(`
          const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
          const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
          const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null;
          return editor instanceof HTMLElement &&
            submit instanceof HTMLButtonElement &&
            editor.isContentEditable &&
            diagnostics?.connected === true &&
            diagnostics?.modelsLoading === false
            ? true
            : null;
        `),
      ),
    30_000,
    300,
  );
}

export async function readActiveChatState(cdp) {
  return evalJSON(
    cdp,
    activeSurfaceExpression(`
      const bodyText = (activeWrapper?.innerText || document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      const userTexts = Array.from(activeWrapper?.querySelectorAll('.chat-group.user .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const assistantTexts = Array.from(activeWrapper?.querySelectorAll('.chat-group.assistant .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      return {
        activeSurfaceKey: activeWrapper?.getAttribute('data-chat-surface-key') || null,
        activeShellIndex: activeEntry?.index ?? null,
        chatGroups: activeWrapper?.querySelectorAll('.chat-group').length || 0,
        submitDisabled:
          activeWrapper?.querySelector('.iclaw-composer__submit') instanceof HTMLButtonElement
            ? activeWrapper.querySelector('.iclaw-composer__submit').disabled
            : null,
        bodyText: bodyText.slice(0, 1200),
        userTexts,
        assistantTexts,
      };
    `),
  );
}

export async function openRechargeCenter(cdp) {
  try {
    await click(cdp, '[data-testid="open-recharge-center"]');
  } catch {
    await clickByText(cdp, ['龙虾币', '182龙虾币', 'Kevin Han']);
  }
  await waitFor(
    'avatar or credits menu open',
    async () => {
      const body = await readBodyText(cdp, 1200);
      return body.includes('充值中心') ? body : null;
    },
    10_000,
  );
  await clickByText(cdp, ['充值中心'], {exact: true});
  return waitFor(
    'recharge center surface',
    async () => {
      const body = await readBodyText(cdp, 2000);
      return body.includes('充值龙虾币') || body.includes('扫码支付') ? body : null;
    },
    20_000,
  );
}

export async function closeInitialGuestLoginModalIfPresent(cdp) {
  const body = await readBodyText(cdp, 1200);
  if (!body.includes('登录')) {
    return false;
  }
  try {
    await evalJSON(
      cdp,
      `(() => {
        const close = document.querySelector('[aria-label="关闭登录弹窗"]');
        if (!(close instanceof HTMLElement)) {
          return false;
        }
        close.click();
        return true;
      })()`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function resetGuestBootstrapState(cdp) {
  await evalJSON(
    cdp,
    `(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(
        ${JSON.stringify(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY)},
        JSON.stringify({primaryView: 'chat'}),
      );
      return true;
    })()`,
  );
  await reloadPage(cdp);
}
