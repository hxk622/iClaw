#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CRITICAL_PATHS = [
  'package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/desktop/src-tauri/tauri.template.conf.json',
];

async function main() {
  for (const relativePath of CRITICAL_PATHS) {
    const filePath = path.join(rootDir, relativePath);
    const raw = await fs.readFile(filePath, 'utf8');
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(raw)) {
      throw new Error(`desktop brand guardrail failed: unresolved merge conflict markers in ${relativePath}`);
    }
  }

  process.stdout.write('[desktop-brand-guardrails] ok\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
