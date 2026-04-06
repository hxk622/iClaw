import test from 'node:test';
import assert from 'node:assert/strict';

import {InMemoryControlPlaneStore} from './store.ts';

test('in-memory control plane store exposes built-in collaboration MCP catalog entries', async () => {
  const store = new InMemoryControlPlaneStore();
  const items = await store.listMcpCatalogAdmin();
  const byKey = new Map(items.map((item) => [item.mcpKey, item]));

  assert.equal(byKey.get('lark')?.name, '飞书 CLI');
  assert.equal(byKey.get('dingtalk')?.name, '钉钉 CLI');
  assert.equal(byKey.get('wecom')?.name, '企微 CLI');
});
