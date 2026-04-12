import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { config } from '../src/config.ts';
import { PgControlPlaneStore } from '../src/pg-store.ts';

type DraftEntry = {
  slug: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  use_cases: string[];
  metadata: Record<string, unknown>;
};

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizeEntry(raw: unknown, sortOrder: number): Required<DraftEntry> & { sort_order: number; active: boolean } {
  const entry = asObject(raw);
  const slug = String(entry.slug || '').trim();
  if (!slug) throw new Error('draft entry missing slug');
  return {
    slug,
    name: String(entry.name || '').trim(),
    description: String(entry.description || '').trim(),
    category: String(entry.category || 'finance').trim() || 'finance',
    publisher: String(entry.publisher || 'iClaw').trim() || 'iClaw',
    featured: entry.featured !== false,
    official: entry.official !== false,
    tags: asStringArray(entry.tags),
    capabilities: asStringArray(entry.capabilities),
    use_cases: asStringArray(entry.use_cases),
    metadata: asObject(entry.metadata),
    sort_order: sortOrder,
    active: true,
  };
}

async function main() {
  const inputPath = resolve(readArg('--input') || '.tmp/nuwa-distill/dev-install-input/agent-catalog-entries.draft.json');
  const onlyRaw = String(readArg('--only') || '').trim();
  const only = new Set(onlyRaw.split(',').map((item) => item.trim()).filter(Boolean));

  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');

  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  const items = Array.isArray(payload) ? payload : [];

  const store = new PgControlPlaneStore(config.databaseUrl);
  try {
    const results: Array<{ slug: string; sort_order: number }> = [];
    let sortOrder = 1000;
    for (const raw of items) {
      const normalized = normalizeEntry(raw, sortOrder);
      sortOrder += 10;
      if (only.size > 0 && !only.has(normalized.slug)) continue;
      await store.upsertAgentCatalogEntry(normalized);
      results.push({ slug: normalized.slug, sort_order: normalized.sort_order });
    }
    process.stdout.write(`${JSON.stringify({ ok: true, inputPath, count: results.length, results }, null, 2)}\n`);
  } finally {
    await store.close();
  }
}

await main();
