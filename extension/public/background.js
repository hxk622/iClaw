const TOGGLE_MESSAGE_TYPE = 'ICLAW_EXTENSION_TOGGLE_PANEL';

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
