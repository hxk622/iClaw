#!/usr/bin/env node
import process from 'node:process';

const BRIDGE_BASE = process.env.ICLAW_EXTENSION_BRIDGE_BASE_URL || 'http://127.0.0.1:1537';

function parseArgs(argv) {
  const options = {
    kind: 'source',
    title: 'Bridge Smoke Test',
    excerpt: '这是通过桌面桥注入知识库 Raw 的 smoke test 样本。',
    text: '这是通过桌面桥注入知识库 Raw 的 smoke test 样本。用于验证插件 -> 桌面桥 -> Raw 的链路是否打通。',
    url: 'https://example.com/bridge-smoke',
    sourceName: 'bridge-smoke',
    sourceType: 'text',
    sourceIcon: 'web',
    tags: ['smoke', 'bridge', 'raw'],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    if (key === 'kind') options.kind = value;
    if (key === 'title') options.title = value;
    if (key === 'excerpt') options.excerpt = value;
    if (key === 'text') options.text = value;
    if (key === 'url') options.url = value;
    if (key === 'source-name') options.sourceName = value;
    if (key === 'source-type') options.sourceType = value;
    if (key === 'source-icon') options.sourceIcon = value;
    if (key === 'tags') options.tags = value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return options;
}

const payload = parseArgs(process.argv.slice(2));

const response = await fetch(`${BRIDGE_BASE}/v1/knowledge/raw/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const body = await response.text();
if (!response.ok) {
  console.error('[bridge-smoke] request failed');
  console.error(body);
  process.exit(1);
}

console.log('[bridge-smoke] request ok');
console.log(body);
