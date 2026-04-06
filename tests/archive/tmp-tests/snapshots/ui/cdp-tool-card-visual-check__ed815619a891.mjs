import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const LIGHT_SCREENSHOT_PATH = '/tmp/iclaw-tool-card-light.png';
const DARK_SCREENSHOT_PATH = '/tmp/iclaw-tool-card-dark.png';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(message.error);
        return;
      }
      resolve(message.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.id++;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeColor(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/rgba\(([^,]+,[^,]+,[^,]+),1\)/g, 'rgb($1)');
}

function buildFixtureMarkup() {
  const icon = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  return `
    <div id="iclaw-tool-card-visual-fixture" style="position:fixed;inset:0;z-index:2147483647;overflow:auto;padding:32px;background:var(--background);">
      <div class="openclaw-chat-surface" style="max-width:760px;margin:0 auto;">
        <div class="chat-tools-collapse">
          <button type="button" class="chat-tools-summary">
            <span class="chat-tools-summary__icon">${icon}</span>
            <span class="chat-tools-summary__count">工具执行</span>
            <span class="chat-tools-summary__names">4 个状态样例</span>
          </button>
          <div class="chat-tools-collapse__body">
            <div class="chat-tool-card" data-iclaw-tool-variant="running">
              <div class="chat-tool-card__header">
                <span class="chat-tool-card__icon">${icon}</span>
                <span class="chat-tool-card__title">query_database</span>
                <span class="chat-tool-card__status">执行中</span>
              </div>
              <div class="chat-tool-card__detail">正在查询用户增长数据表，时间范围：2026-03-05 至 2026-04-04</div>
              <div class="chat-tool-card__status-text">2.3s</div>
            </div>

            <div class="chat-tool-card" data-iclaw-tool-variant="success">
              <div class="chat-tool-card__header">
                <span class="chat-tool-card__icon">${icon}</span>
                <span class="chat-tool-card__title">analyze_data</span>
                <span class="chat-tool-card__status">成功</span>
                <span class="chat-tool-card__action">复制结果</span>
              </div>
              <div class="chat-tool-card__detail">成功完成用户增长趋势分析，识别出 3 个关键增长节点和 2 个潜在问题区域</div>
              <div class="chat-tool-card__status-text">5.1s</div>
              <div class="chat-tool-card__output">分析完成。关键发现：新增用户增长率 +23.5%，推荐渠道转化率最高。</div>
            </div>

            <div class="chat-tool-card" data-iclaw-tool-variant="artifact">
              <div class="chat-tool-card__header">
                <span class="chat-tool-card__icon">${icon}</span>
                <span class="chat-tool-card__title">generate_report</span>
                <span class="chat-tool-card__status">已生成</span>
                <span class="chat-tool-card__action">打开产物</span>
              </div>
              <div class="chat-tool-card__detail">已生成用户增长分析报告，包含 8 个可视化图表和详细数据解读</div>
              <div class="chat-tool-card__status-text">8.7s</div>
              <div class="chat-tool-card__preview"># 用户增长分析报告 - 2026 Q1\n\n本报告详细分析了 2026 年 3 月 5 日至 4 月 4 日期间的用户增长情况。</div>
            </div>

            <div class="chat-tool-card" data-iclaw-tool-variant="error">
              <div class="chat-tool-card__header">
                <span class="chat-tool-card__icon">${icon}</span>
                <span class="chat-tool-card__title">send_email</span>
                <span class="chat-tool-card__status">失败</span>
                <span class="chat-tool-card__action">重试</span>
              </div>
              <div class="chat-tool-card__detail">邮件发送失败，无法连接到 SMTP 服务器</div>
              <div class="chat-tool-card__status-text">14:25</div>
              <div class="chat-tool-card__inline">SMTP 连接超时：无法连接到 smtp.company.com:587。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function readBrowserWebSocketUrl() {
  const response = await fetch(VERSION_URL);
  const payload = await response.json();
  if (!payload?.webSocketDebuggerUrl) {
    throw new Error(`Missing webSocketDebuggerUrl from ${VERSION_URL}`);
  }
  return payload.webSocketDebuggerUrl;
}

async function evaluateJson(cdp, sessionId, expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  return result.result?.value;
}

async function waitFor(cdp, sessionId, label, predicate, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function createIsolatedSession(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return { targetId, sessionId };
}

async function renderFixture(cdp, sessionId, isDark) {
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('DOM.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    {
      width: 1280,
      height: 1800,
      deviceScaleFactor: 1,
      mobile: false,
    },
    sessionId,
  );
  await cdp.send('Page.navigate', { url: APP_URL }, sessionId);

  await waitFor(
    cdp,
    sessionId,
    'desktop theme tokens',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const probe = getComputedStyle(document.documentElement).getPropertyValue('--tool-card-title').trim();
          return probe.length > 0;
        })()`,
      ),
  );

  await evaluateJson(
    cdp,
    sessionId,
    `(() => {
      document.documentElement.classList.toggle('dark', ${JSON.stringify(isDark)});
      document.body.style.background = ${JSON.stringify(isDark ? '#1a1a1a' : '#f5f5f7')};
      document.getElementById('iclaw-tool-card-visual-fixture')?.remove();
      document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(buildFixtureMarkup())});
      return true;
    })()`,
  );

  await sleep(250);

  const snapshot = await evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const cards = Array.from(document.querySelectorAll('#iclaw-tool-card-visual-fixture .chat-tool-card'));
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          border: style.borderColor,
          color: style.color,
          radius: style.borderRadius,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          boxShadow: style.boxShadow,
        };
      };
      return {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        count: cards.length,
        summary: read('#iclaw-tool-card-visual-fixture .chat-tools-collapse'),
        running: {
          card: read('.chat-tool-card[data-iclaw-tool-variant="running"]'),
          badge: read('.chat-tool-card[data-iclaw-tool-variant="running"] .chat-tool-card__status'),
          title: read('.chat-tool-card[data-iclaw-tool-variant="running"] .chat-tool-card__title'),
        },
        success: {
          card: read('.chat-tool-card[data-iclaw-tool-variant="success"]'),
          badge: read('.chat-tool-card[data-iclaw-tool-variant="success"] .chat-tool-card__status'),
        },
        artifact: {
          card: read('.chat-tool-card[data-iclaw-tool-variant="artifact"]'),
          badge: read('.chat-tool-card[data-iclaw-tool-variant="artifact"] .chat-tool-card__status'),
        },
        error: {
          card: read('.chat-tool-card[data-iclaw-tool-variant="error"]'),
          badge: read('.chat-tool-card[data-iclaw-tool-variant="error"] .chat-tool-card__status'),
        },
      };
    })()`,
  );

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  return { snapshot, screenshot: screenshot.data };
}

function assertSnapshot(snapshot) {
  assert.equal(snapshot.count, 4, `expected 4 cards in ${snapshot.theme}`);
  assert.equal(snapshot.running.title.fontSize, '14px');
  assert.equal(snapshot.running.title.lineHeight, '20px');
  assert.equal(snapshot.running.badge.fontSize, '12px');
  assert.equal(snapshot.running.badge.lineHeight, '16px');
  assert.equal(snapshot.running.card.radius, '10px');

  if (snapshot.theme === 'light') {
    assert.equal(normalizeColor(snapshot.running.card.background), 'rgb(248,251,255)');
    assert.equal(normalizeColor(snapshot.running.card.border), 'rgb(212,229,255)');
    assert.equal(normalizeColor(snapshot.running.badge.background), 'rgb(230,242,255)');
    assert.equal(normalizeColor(snapshot.running.badge.color), 'rgb(12,91,160)');
    assert.equal(normalizeColor(snapshot.success.card.background), 'rgb(247,253,248)');
    assert.equal(normalizeColor(snapshot.artifact.card.background), 'rgb(250,249,255)');
    assert.equal(normalizeColor(snapshot.error.card.background), 'rgb(255,251,251)');
  } else {
    assert.equal(normalizeColor(snapshot.running.card.background), 'rgba(42,111,212,0.08)');
    assert.equal(normalizeColor(snapshot.running.badge.background), 'rgba(42,111,212,0.15)');
    assert.equal(normalizeColor(snapshot.running.badge.color), 'rgb(112,184,255)');
    assert.equal(normalizeColor(snapshot.success.card.background), 'rgba(24,168,84,0.08)');
    assert.equal(normalizeColor(snapshot.artifact.card.background), 'rgba(124,92,224,0.08)');
    assert.equal(normalizeColor(snapshot.error.card.background), 'rgba(212,24,61,0.08)');
  }
}

const browserWsUrl = await readBrowserWebSocketUrl();
const cdp = new CDP(browserWsUrl);
await cdp.open();

const lightSession = await createIsolatedSession(cdp);
const lightResult = await renderFixture(cdp, lightSession.sessionId, false);
assertSnapshot(lightResult.snapshot);
await writeFile(LIGHT_SCREENSHOT_PATH, Buffer.from(lightResult.screenshot, 'base64'));
await cdp.send('Target.closeTarget', { targetId: lightSession.targetId });

const darkSession = await createIsolatedSession(cdp);
const darkResult = await renderFixture(cdp, darkSession.sessionId, true);
assertSnapshot(darkResult.snapshot);
await writeFile(DARK_SCREENSHOT_PATH, Buffer.from(darkResult.screenshot, 'base64'));
await cdp.send('Target.closeTarget', { targetId: darkSession.targetId });

console.log(
  JSON.stringify(
    {
      light: { snapshot: lightResult.snapshot, screenshot: LIGHT_SCREENSHOT_PATH },
      dark: { snapshot: darkResult.snapshot, screenshot: DARK_SCREENSHOT_PATH },
    },
    null,
    2,
  ),
);

cdp.close();
