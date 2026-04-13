#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const snapshotRoot = path.join(rootDir, '.tmp-brand-state');

const TRACKED_PATHS = [
  'apps/desktop/src-tauri/tauri.generated.conf.json',
  'apps/desktop/src-tauri/resources/config',
  'apps/desktop/src-tauri/resources/mcp',
  'apps/desktop/src-tauri/resources/certs',
  'apps/desktop/src-tauri/resources/servers',
  'apps/desktop/src-tauri/resources/baseline',
  'apps/desktop/src-tauri/resources/bundled-skills',
  'apps/desktop/public/brand',
  'apps/desktop/public/favicon.ico',
  'apps/desktop/public/favicon.png',
  'apps/desktop/public/apple-touch-icon.png',
  'apps/desktop/src/app/assets/installer-lobster.png',
  'apps/desktop/src-tauri/icons-generated',
  'apps/desktop/src-tauri/installer-generated',
  'home-web/brand.generated.js',
  'home-web/public/brand',
];

function usage() {
  console.error('Usage: node scripts/brand-generated-state.mjs <snapshot|restore> <key>');
  process.exit(1);
}

async function pathInfo(targetPath) {
  try {
    const stat = await fs.lstat(targetPath);
    return {
      exists: true,
      type: stat.isDirectory() ? 'dir' : 'file',
    };
  } catch {
    return {
      exists: false,
      type: null,
    };
  }
}

async function copyToSnapshot(srcPath, destPath, type) {
  try {
    await fs.access(srcPath);
  } catch {
    return;
  }
  await fs.mkdir(path.dirname(destPath), {recursive: true});
  await fs.rm(destPath, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  if (type === 'dir') {
    await fs.cp(srcPath, destPath, {recursive: true});
    return;
  }
  await fs.copyFile(srcPath, destPath);
}

async function removeTarget(targetPath) {
  await fs.rm(targetPath, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
}

async function snapshot(key) {
  const keyDir = path.join(snapshotRoot, key);
  const filesDir = path.join(keyDir, 'files');
  await fs.rm(keyDir, {recursive: true, force: true});
  await fs.mkdir(filesDir, {recursive: true});

  const manifest = [];
  for (const relativePath of TRACKED_PATHS) {
    const absolutePath = path.join(rootDir, relativePath);
    const info = await pathInfo(absolutePath);
    manifest.push({
      relativePath,
      exists: info.exists,
      type: info.type,
    });
    if (!info.exists) {
      continue;
    }
    await copyToSnapshot(absolutePath, path.join(filesDir, relativePath), info.type);
  }

  await fs.writeFile(path.join(keyDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`[brand-state] snapshot saved: ${key}\n`);
}

async function restore(key) {
  const keyDir = path.join(snapshotRoot, key);
  const manifestPath = path.join(keyDir, 'manifest.json');
  let manifest = [];
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    process.stdout.write(`[brand-state] no snapshot found for ${key}, skip restore\n`);
    return;
  }

  for (const entry of manifest) {
    const relativePath = String(entry.relativePath || '').trim();
    if (!relativePath) continue;
    const absolutePath = path.join(rootDir, relativePath);
    await removeTarget(absolutePath);
    if (!entry.exists) {
      continue;
    }
    const snapshotPath = path.join(keyDir, 'files', relativePath);
    const snapshotInfo = await pathInfo(snapshotPath);
    if (!snapshotInfo.exists) {
      continue;
    }
    await copyToSnapshot(snapshotPath, absolutePath, entry.type === 'dir' ? 'dir' : 'file');
  }

  await fs.rm(keyDir, {recursive: true, force: true});
  process.stdout.write(`[brand-state] snapshot restored: ${key}\n`);
}

async function main() {
  const command = String(process.argv[2] || '').trim();
  const key = String(process.argv[3] || '').trim();
  if (!command || !key) {
    usage();
  }
  if (command === 'snapshot') {
    await snapshot(key);
    return;
  }
  if (command === 'restore') {
    await restore(key);
    return;
  }
  usage();
}

main().catch((error) => {
  console.error(`[brand-state] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
