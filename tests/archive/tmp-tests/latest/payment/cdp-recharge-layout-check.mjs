import fs from 'node:fs/promises';

const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const OUTPUT_PATH = '/tmp/iclaw-recharge-layout-check.png';

class CDP {
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
        reject(new Error(msg.error.message || 'CDP request failed'));
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

  send(method, params = {}, sessionId = undefined) {
    const id = this.id++;
    const payload = {id, method, params};
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
    });
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

async function evaluateJson(cdp, sessionId, expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
  );
  return result.result?.value;
}

async function waitFor(label, predicate, timeoutMs = 20000, intervalMs = 250) {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function clickByText(cdp, sessionId, labels) {
  return evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const wanted = ${JSON.stringify(labels)};
      const nodes = Array.from(document.querySelectorAll('button, [role="button"], a')).map((node) => ({
        node,
        tagName: node.tagName,
        text: (node.innerText || node.textContent || node.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim(),
      })).filter((entry) => entry.text);
      const exactButton = nodes.find((entry) => entry.tagName === 'BUTTON' && wanted.some((label) => entry.text === label));
      const exactNode = exactButton || nodes.find((entry) => wanted.some((label) => entry.text === label));
      const fuzzyButton = nodes.find((entry) => entry.tagName === 'BUTTON' && wanted.some((label) => entry.text.includes(label)));
      const fuzzyNode = fuzzyButton || nodes.find((entry) => wanted.some((label) => entry.text.includes(label)));
      const target = exactNode?.node || fuzzyNode?.node || null;
      if (!target) {
        return {clicked: false, labels: nodes.map((entry) => entry.text).slice(0, 80)};
      }
      target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
      return {clicked: true, text: (target.innerText || target.textContent || target.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()};
    })()`,
  );
}

let cdp = null;
let exitCode = 0;

try {
  const browserVersion = await (await fetch(VERSION_URL)).json();
  if (!browserVersion?.webSocketDebuggerUrl) {
    throw new Error(`Missing browser websocket debugger url from ${VERSION_URL}`);
  }

  cdp = new CDP(browserVersion.webSocketDebuggerUrl);
  await cdp.open();
  console.error('[recharge-check] connected');
  const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('DOM.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);
  await cdp.send('Page.navigate', {url: APP_URL}, sessionId);
  console.error('[recharge-check] navigated');

  await waitFor(
    'app bootstrap',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => ({
          ready: document.body.innerText.includes('充值中心') || document.body.innerText.includes('龙虾币'),
          accessToken: Boolean(localStorage.getItem('iclaw:auth.access_token')),
          text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300),
        }))()`,
      ).then((value) => (value?.ready ? value : null)),
    30000,
  );
  console.error('[recharge-check] app ready');

  const authState = await evaluateJson(
    cdp,
    sessionId,
    `(() => ({
      accessToken: Boolean(localStorage.getItem('iclaw:auth.access_token')),
      body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 600),
    }))()`,
  );

  if (!authState?.accessToken) {
    throw new Error(`No local auth token found. Snapshot: ${authState?.body || 'empty page'}`);
  }
  console.error('[recharge-check] auth ok');

  const openRecharge = await clickByText(cdp, sessionId, ['182龙虾币', '龙虾币', 'Kevin Han']);
  if (!openRecharge?.clicked) {
    throw new Error(`Recharge entry not found. Available labels: ${(openRecharge?.labels || []).join(' | ')}`);
  }
  console.error('[recharge-check] recharge entry opened');
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const postOpenSnapshot = await evaluateJson(
    cdp,
    sessionId,
    `(() => ({
      body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      labels: Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map((node) => (node.innerText || node.textContent || node.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 80),
    }))()`,
  );
  console.error(`[recharge-check] post-open snapshot: ${JSON.stringify(postOpenSnapshot)}`);
  const openRechargeCenter = await clickByText(cdp, sessionId, ['充值中心']);
  if (!openRechargeCenter?.clicked) {
    throw new Error(`Recharge center menu item not found. Available labels: ${(postOpenSnapshot?.labels || []).join(' | ')}`);
  }
  console.error('[recharge-check] recharge center clicked');

  const surfaceState = await waitFor(
    'recharge surface',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const text = document.body.innerText || '';
          return {
            packageDialog: text.includes('充值龙虾币') && text.includes('立即充值'),
            paymentView: text.includes('扫码支付') && text.includes('请选择方式完成支付'),
          };
        })()`,
      ).then((value) => (value?.packageDialog || value?.paymentView ? value : null)),
    20000,
  );
  console.error('[recharge-check] recharge surface visible');

  if (surfaceState?.packageDialog) {
    const continueToPay = await clickByText(cdp, sessionId, ['立即充值']);
    if (!continueToPay?.clicked) {
      throw new Error(`Immediate recharge button not found. Available labels: ${(continueToPay?.labels || []).join(' | ')}`);
    }
    console.error(`[recharge-check] immediate recharge clicked: ${JSON.stringify(continueToPay)}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const afterContinueSnapshot = await evaluateJson(
      cdp,
      sessionId,
      `(() => ({
        body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
        hasPackageTitle: document.body.innerText.includes('充值龙虾币'),
        hasPaymentBack: document.body.innerText.includes('返回充值包'),
        hasScanPay: document.body.innerText.includes('扫码支付'),
        overlayKeys: window.__ICLAW_APP_DIAGNOSTICS__?.mountedOverlaySurfaceKeys || null,
      }))()`,
    );
    console.error(`[recharge-check] after-continue snapshot: ${JSON.stringify(afterContinueSnapshot)}`);
    await waitFor(
      'payment view',
      async () =>
        evaluateJson(
          cdp,
          sessionId,
          `(() => ({
            visible: document.body.innerText.includes('扫码支付') && document.body.innerText.includes('返回充值包'),
            text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800),
          }))()`,
        ).then((value) => (value?.visible ? value : null)),
      20000,
    );
  }
  console.error('[recharge-check] payment view visible');

  await waitFor(
    'payment surface settle',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => ({
          hasQrLabel: document.body.innerText.includes('微信官方收款码样式') || document.body.innerText.includes('支付宝官方收款码样式'),
          hasCountdown: document.body.innerText.includes('剩余支付时间'),
          body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }))()`,
      ).then((value) => (value?.hasQrLabel ? value : null)),
    20000,
  );
  console.error('[recharge-check] payment surface settled');

  const screenshot = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  await fs.writeFile(OUTPUT_PATH, Buffer.from(screenshot.data, 'base64'));

  const summary = await evaluateJson(
    cdp,
    sessionId,
    `(() => ({
      body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      hasCountdown: document.body.innerText.includes('剩余支付时间'),
      hasExpiryWarning: document.body.innerText.includes('收款码即将过期'),
      viewport: {width: window.innerWidth, height: window.innerHeight},
    }))()`,
  );

  console.log(
    JSON.stringify(
      {
        screenshotPath: OUTPUT_PATH,
        summary,
      },
      null,
      2,
    ),
  );

  await cdp.send('Target.closeTarget', {targetId});
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  cdp?.close();
  setTimeout(() => process.exit(exitCode), 0);
}
