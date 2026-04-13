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
const runtimeBundleMode = trimString(process.env.ICLAW_RUNTIME_BUNDLE_MODE).toLowerCase();

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function syncMcpConfig() {
  const sourcePath = path.join(resourcesSrcDir, 'mcp', 'mcp.json');
  const outputPath = path.join(resourcesDstDir, 'mcp', 'mcp.json');
  await syncFileOrRemove(sourcePath, outputPath);
}

async function syncRuntimeArchives() {
  const sourcePath = path.join(resourcesSrcDir, 'runtime-archives');
  const outputPath = path.join(resourcesDstDir, 'runtime-archives');
  await syncDirOrRemove(sourcePath, outputPath);
}

async function removeBrokenPythonSitePackagesSymlink() {
  const sitePackagesPath = path.join(
    resourcesDstDir,
    'openclaw-runtime',
    'python',
    'Python.framework',
    'Versions',
    '3.11',
    'lib',
    'python3.11',
    'site-packages',
  );
  try {
    const stat = await fs.lstat(sitePackagesPath);
    if (!stat.isSymbolicLink()) {
      return;
    }
    const realPath = await fs.realpath(sitePackagesPath).catch(() => null);
    if (realPath) {
      return;
    }
    await fs.rm(sitePackagesPath, {force: true});
    process.stdout.write(`[sync-openclaw-resources] removed broken site-packages symlink: ${sitePackagesPath}\n`);
  } catch {
    // ignore when path is absent
  }
}

async function main() {
  await fs.mkdir(resourcesDstDir, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(resourcesDstDir, 'mcp'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'config'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'certs'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'servers'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'runtime-archives'), { recursive: true }),
  ]);

  await fs.rm(path.join(resourcesDstDir, 'skills'), { recursive: true, force: true });
  if (runtimeBundleMode === 'archive') {
    await fs.rm(path.join(resourcesDstDir, 'openclaw-runtime'), { recursive: true, force: true });
  }
  await Promise.all([
    syncDirOrRemove(serversSrcDir, path.join(resourcesDstDir, 'servers')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'certs'), path.join(resourcesDstDir, 'certs')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'baseline'), path.join(resourcesDstDir, 'baseline')),
    syncDirOrRemove(path.join(resourcesSrcDir, 'bundled-skills'), path.join(resourcesDstDir, 'bundled-skills')),
    runtimeBundleMode === 'archive'
      ? syncRuntimeArchives()
      : syncDirOrRemove(path.join(resourcesSrcDir, 'openclaw-runtime'), path.join(resourcesDstDir, 'openclaw-runtime')),
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
  if (runtimeBundleMode !== 'archive') {
    await removeBrokenPythonSitePackagesSymlink();
  }

  process.stdout.write(`Synced OpenClaw resources from ${resourcesSrcDir} to ${resourcesDstDir}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
