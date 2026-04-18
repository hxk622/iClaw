const TOGGLE_MESSAGE_TYPE = 'ICLAW_EXTENSION_TOGGLE_PANEL';
const REQUEST_DESKTOP_SESSION_MESSAGE_TYPE = 'ICLAW_EXTENSION_REQUEST_DESKTOP_SESSION';
const BRIDGE_BASE = 'http://127.0.0.1:1537';
const SESSION_TIMEOUT_MS = 1800;

async function sendToggleMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: TOGGLE_MESSAGE_TYPE }, (response) => {
      resolve({ hasError: Boolean(chrome.runtime.lastError), response: response || null });
    });
  });
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-script.js'],
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const firstTry = await sendToggleMessage(tab.id);
  if (!firstTry.hasError) {
    return;
  }

  try {
    await ensureContentScript(tab.id);
    await sendToggleMessage(tab.id);
  } catch {
    // Ignore unsupported pages such as chrome:// URLs.
  }
});

async function requestDesktopSession(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRIDGE_BASE}/v1/extension/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return { ok: false, error: 'INVALID_BRIDGE_RESPONSE' };
    }
    return data;
  } catch {
    return { ok: false, error: 'DESKTOP_APP_NOT_READY' };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === REQUEST_DESKTOP_SESSION_MESSAGE_TYPE) {
    requestDesktopSession(message.payload)
      .then((result) => sendResponse(result || { ok: false, error: 'UNKNOWN_ERROR' }))
      .catch(() => sendResponse({ ok: false, error: 'UNKNOWN_ERROR' }));
    return true;
  }
  return false;
});
