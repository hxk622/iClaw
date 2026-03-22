import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import type {PortalPresetManifest} from '../src/portal-domain.ts';
import {syncPortalPresetManifest} from '../src/portal-preset.ts';
import {PgPortalStore} from '../src/portal-store.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const manifestPath = readArg('--manifest') || resolve(scriptDir, '../presets/core-oem.json');
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as PortalPresetManifest;
  if (raw.schemaVersion !== 1) {
    throw new Error(`Unsupported preset schema version: ${raw.schemaVersion}`);
  }

  const store = new PgPortalStore(config.databaseUrl);
  try {
    await syncPortalPresetManifest(store, raw, {
      manifestDir: dirname(manifestPath),
    });
  } finally {
    await store.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifestPath,
        appCount: raw.apps.length,
        skillCount: raw.skills.length,
        mcpCount: raw.mcps.length,
      },
      null,
      2,
    ),
  );
}

await main();
