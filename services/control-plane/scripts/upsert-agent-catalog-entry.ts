import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

import {config} from '../src/config.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

function normalizePath(value: string | null, field: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return resolve(normalized);
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const inputPath = normalizePath(readArg('--input'), '--input');
  const payload = JSON.parse(await readFile(inputPath, 'utf8')) as Record<string, unknown>;
  const store = new PgControlPlaneStore(config.databaseUrl);

  try {
    const slug = String(payload.slug || '').trim();
    const name = String(payload.name || '').trim();
    const description = String(payload.description || '').trim();
    const category = String(payload.category || '').trim() as 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
    const publisher = String(payload.publisher || '').trim();
    if (!slug || !name || !description || !category || !publisher) {
      throw new Error('slug, name, description, category, publisher are required');
    }

    const record = await store.upsertAgentCatalogEntry({
      slug,
      name,
      description,
      category,
      publisher,
      featured: payload.featured === true,
      official: payload.official !== false,
      tags: Array.isArray(payload.tags) ? payload.tags.map((item) => String(item).trim()).filter(Boolean) : [],
      capabilities: Array.isArray(payload.capabilities)
        ? payload.capabilities.map((item) => String(item).trim()).filter(Boolean)
        : [],
      use_cases: Array.isArray(payload.use_cases) ? payload.use_cases.map((item) => String(item).trim()).filter(Boolean) : [],
      metadata:
        payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
          ? (payload.metadata as Record<string, unknown>)
          : {},
      sort_order: Number.isFinite(Number(payload.sort_order)) ? Math.trunc(Number(payload.sort_order)) : 9999,
      active: payload.active !== false,
    });

    console.log(JSON.stringify({ok: true, slug: record.slug, sortOrder: record.sortOrder, active: record.active}, null, 2));
  } finally {
    await store.close();
  }
}

await main();
