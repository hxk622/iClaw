#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const resourcesSrcDir = path.join(rootDir, 'services', 'openclaw', 'resources');
const mcpPresetDir = path.join(rootDir, 'mcp');
const serversSrcDir = path.join(rootDir, 'servers');
const resourcesDstDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'resources');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function recreateDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyDirIfPresent(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    return;
  }
  await recreateDir(destinationPath);
  await fs.cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
}

async function copyFileIfPresent(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    return;
  }
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function loadJsonIfPresent(targetPath) {
  if (!(await pathExists(targetPath))) {
    return null;
  }
  return JSON.parse(await fs.readFile(targetPath, 'utf8'));
}

async function syncMcpConfig() {
  const sourcePath = path.join(resourcesSrcDir, 'mcp', 'mcp.json');
  const overlayPath = path.join(mcpPresetDir, 'mcp.json');
  const outputPath = path.join(resourcesDstDir, 'mcp', 'mcp.json');

  const source = await loadJsonIfPresent(sourcePath);
  const overlay = await loadJsonIfPresent(overlayPath);

  if (!source && !overlay) {
    return;
  }

  const merged = {
    ...(source ?? {}),
    ...(overlay ?? {}),
    mcpServers: {
      ...(source?.mcpServers ?? {}),
      ...(overlay?.mcpServers ?? {}),
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(resourcesDstDir, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(resourcesDstDir, 'skills'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'mcp'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'config'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'certs'), { recursive: true }),
    fs.mkdir(path.join(resourcesDstDir, 'servers'), { recursive: true }),
  ]);

  await copyDirIfPresent(path.join(resourcesSrcDir, 'skills'), path.join(resourcesDstDir, 'skills'));
  await copyDirIfPresent(serversSrcDir, path.join(resourcesDstDir, 'servers'));
  await copyDirIfPresent(path.join(resourcesSrcDir, 'certs'), path.join(resourcesDstDir, 'certs'));
  await copyFileIfPresent(
    path.join(resourcesSrcDir, 'config', 'runtime-config.json'),
    path.join(resourcesDstDir, 'config', 'runtime-config.json'),
  );
  await copyFileIfPresent(
    path.join(resourcesSrcDir, 'config', 'portal-app-runtime.json'),
    path.join(resourcesDstDir, 'config', 'portal-app-runtime.json'),
  );
  await syncMcpConfig();

  process.stdout.write(`Synced OpenClaw resources to ${resourcesDstDir}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
