const PAGE_WS = "ws://127.0.0.1:9223/devtools/page/4F8F24204AC129ACE9A0D591D45BC99D";
const APP_URL = "http://127.0.0.1:1520/";
const ACCESS_KEY = "iclaw:auth.access_token";
const REFRESH_KEY = "iclaw:auth.refresh_token";

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    });
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalJSON(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

const cdp = new CDP(PAGE_WS);
await cdp.open();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Page.navigate", { url: APP_URL });
await sleep(1500);

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(process.env.ICLAW_ACCESS_TOKEN || "")});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(process.env.ICLAW_REFRESH_TOKEN || "")});
    return {
      access: localStorage.getItem(${JSON.stringify(ACCESS_KEY)}),
      refresh: localStorage.getItem(${JSON.stringify(REFRESH_KEY)})
    };
  })()`,
);

await cdp.send("Page.reload", { ignoreCache: true });
await sleep(6000);

const state = await evalJSON(
  cdp,
  `(() => ({
    href: location.href,
    bodyText: document.body.innerText.slice(0, 1200),
    hasChatSurface: !!document.querySelector(".openclaw-chat-surface"),
    hasAuthPanel: document.body.innerText.includes("登录以继续使用账户与额度体系"),
    localAccess: localStorage.getItem(${JSON.stringify(ACCESS_KEY)}),
    localRefresh: localStorage.getItem(${JSON.stringify(REFRESH_KEY)}),
    rootHtml: document.getElementById("root")?.innerHTML.slice(0, 1200) || ""
  }))()`,
);

console.log(JSON.stringify(state, null, 2));
cdp.close();
