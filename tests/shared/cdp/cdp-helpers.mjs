import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const DEFAULT_CDP_PORT = Number(process.env.ICLAW_CDP_PORT || 9223);

export class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (!msg.id || !this.pending.has(msg.id)) {
        return;
      }
      const {resolve, reject} = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) {
        reject(msg.error);
        return;
      }
      resolve(msg.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, {once: true});
      this.ws.addEventListener('error', reject, {once: true});
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
  }

  close() {
    this.ws.close();
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(label, predicate, timeoutMs = 30_000, intervalMs = 200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

export function selectorExpression(selector, body) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    ${body}
  })()`;
}

export async function waitForSelector(cdp, selector, timeoutMs = 30_000) {
  return waitFor(
    `selector ${selector}`,
    async () =>
      evalJSON(
        cdp,
        selectorExpression(
          selector,
          `
            if (!(element instanceof HTMLElement)) {
              return null;
            }
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
              ? true
              : null;
          `,
        ),
      ),
    timeoutMs,
  );
}

export async function click(cdp, selector) {
  await waitForSelector(cdp, selector);
  const clicked = await evalJSON(
    cdp,
    selectorExpression(
      selector,
      `
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        element.click();
        return true;
      `,
    ),
  );
  assert.equal(clicked, true, `failed to click ${selector}`);
}

export async function clickByText(cdp, labels, options = {}) {
  const wanted = Array.isArray(labels) ? labels.filter(Boolean) : [labels].filter(Boolean);
  assert.ok(wanted.length > 0, 'clickByText requires at least one label');
  const {
    selector = 'button, [role="button"], a',
    exact = false,
  } = options;

  const result = await evalJSON(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(wanted)};
      const exact = ${JSON.stringify(Boolean(exact))};
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
        .map((node) => ({
          node,
          text: (node.innerText || node.textContent || node.getAttribute('aria-label') || '')
            .replace(/\\s+/g, ' ')
            .trim(),
        }))
        .filter((entry) => entry.text);
      const target = nodes.find((entry) =>
        wanted.some((label) => (exact ? entry.text === label : entry.text.includes(label))),
      );
      if (!target?.node) {
        return {
          clicked: false,
          labels: nodes.map((entry) => entry.text).slice(0, 80),
        };
      }
      target.node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
      return {
        clicked: true,
        text: target.text,
      };
    })()`,
  );

  assert.equal(result?.clicked, true, `failed to click text: ${wanted.join(' | ')}`);
  return result;
}

export async function setInputValue(cdp, selector, value) {
  await waitForSelector(cdp, selector);
  const updated = await evalJSON(
    cdp,
    selectorExpression(
      selector,
      `
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
          return false;
        }
        element.focus();
        element.value = ${JSON.stringify(String(value))};
        element.dispatchEvent(new Event('input', {bubbles: true}));
        element.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
      `,
    ),
  );
  assert.equal(updated, true, `failed to set input value for ${selector}`);
}

export async function insertText(cdp, text) {
  await cdp.send('Input.insertText', {text: String(text)});
}

export async function readValue(cdp, selector) {
  await waitForSelector(cdp, selector);
  return evalJSON(
    cdp,
    selectorExpression(
      selector,
      `
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
          return element.value;
        }
        return element instanceof HTMLElement ? (element.textContent || '').trim() : null;
      `,
    ),
  );
}

export async function readBodyText(cdp, limit = 1200) {
  return evalJSON(
    cdp,
    `(() => (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, ${Math.max(50, Number(limit) || 1200)}))()`,
  );
}

export async function waitForText(cdp, text, timeoutMs = 30_000) {
  const wanted = Array.isArray(text) ? text : [text];
  return waitFor(
    `text ${wanted.join(' | ')}`,
    async () => {
      const body = await readBodyText(cdp, 5000);
      return wanted.every((item) => body.includes(String(item))) ? body : null;
    },
    timeoutMs,
  );
}

export async function setLocalStorageItems(cdp, entries) {
  const pairs = Object.entries(entries ?? {});
  return evalJSON(
    cdp,
    `(() => {
      const entries = ${JSON.stringify(pairs)};
      for (const [key, value] of entries) {
        if (value === null || value === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, String(value));
        }
      }
      return Object.fromEntries(entries.map(([key]) => [key, localStorage.getItem(key)]));
    })()`,
  );
}

export async function reloadPage(cdp, options = {}) {
  await cdp.send('Page.reload', {ignoreCache: options.ignoreCache ?? true});
}

export async function screenshot(cdp, filePath) {
  const result = await cdp.send('Page.captureScreenshot', {format: 'png'});
  const outputPath = resolve(filePath);
  await mkdir(dirname(outputPath), {recursive: true});
  await writeFile(outputPath, Buffer.from(result.data, 'base64'));
  return outputPath;
}

export async function getBrowserWebSocketUrl(cdpPort = DEFAULT_CDP_PORT) {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
  const version = await res.json();
  if (!version?.webSocketDebuggerUrl) {
    throw new Error('browser websocket url not found');
  }
  return version.webSocketDebuggerUrl;
}

export async function getPages(cdpPort = DEFAULT_CDP_PORT) {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const pages = await res.json();
  return Array.isArray(pages) ? pages : [];
}

export async function openIsolatedPage(url, options = {}) {
  const cdpPort = Number(options.cdpPort || DEFAULT_CDP_PORT);
  const browserCdp = new CDP(await getBrowserWebSocketUrl(cdpPort));
  await browserCdp.open();
  const created = await browserCdp.send('Target.createTarget', {url});
  const targetId = created?.targetId;
  if (!targetId) {
    browserCdp.close();
    throw new Error(`failed to create target for ${url}`);
  }

  const page = await waitFor(
    `isolated page for ${url}`,
    async () => {
      const pages = await getPages(cdpPort);
      return pages.find((candidate) => candidate.id === targetId && candidate.webSocketDebuggerUrl) || null;
    },
    15_000,
    200,
  );

  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
  ]);

  return {
    browserCdp,
    cdp,
    targetId,
    async close() {
      cdp.close();
      await browserCdp.send('Target.closeTarget', {targetId}).catch(() => {});
      browserCdp.close();
    },
  };
}
