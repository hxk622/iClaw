#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { syncDirOrRemove, syncFileOrRemove } from './lib/incremental-fs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultResourcesSrcDir = path.join(rootDir, 'services', 'openclaw', 'resources');
const resourcesSrcDir = path.resolve(trimString(process.env.ICLAW_OPENCLAW_RESOURCES_SOURCE_DIR) || defaultResourcesSrcDir);
const serversSrcDir = path.join(rootDir, 'servers');
const resourcesDstDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'resources');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function syncMcpConfig() {
  const sourcePath = path.join(resourcesSrcDir, 'mcp', 'mcp.json');
  const outputPath = path.join(resourcesDstDir, 'mcp', 'mcp.json');
  await syncFileOrRemove(sourcePath, outputPath);
}

async function main() {
  await fs.mkdir(resourcesDstDir, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(resourcesDstDir, 'mcp'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'config'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'certs'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'servers'), { recursive: true }),
  ]);

  await fs.rm(path.join(resourcesDstDir, 'skills'), { recursive: true, force: true });
  await Promise.all([
    syncDirOrRemove(serversSrcDir, path.join(resourcesDstDir, 'servers')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'certs'), path.join(resourcesDstDir, 'certs')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'baseline'), path.join(resourcesDstDir, 'baseline')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'bundled-skills'), path.join(resourcesDstDir, 'bundled-skills')),
    syncFileOrRemove(
      path.join(resourcesSrcDir, 'config', 'runtime-config.json'),
      path.join(resourcesDstDir, 'config', 'runtime-config.json'),
    ),
    syncFileOrRemove(
      path.join(resourcesSrcDir, 'config', 'portal-app-runtime.json'),
      path.join(resourcesDstDir, 'config', 'portal-app-runtime.json'),
    ),
    syncMcpConfig(),
  ]);

  process.stdout.write(`Synced OpenClaw resources from ${resourcesSrcDir} to ${resourcesDstDir}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
