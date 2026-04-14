import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadPackagedPlugins } from './lib/openclaw-plugin-manifest.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveCacheRoot(env = process.env) {
  const override = String(env.ICLAW_PACKAGED_PLUGIN_CACHE_DIR || '').trim();
  return override ? path.resolve(override) : path.join(os.tmpdir(), 'iclaw-packaged-plugins-cache');
}

async function copyDir(sourceDir, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

async function materializeGitPluginSource(plugin, tempRoot, cacheRoot) {
  const cacheDir = path.join(cacheRoot, 'git', plugin.id, plugin.source.ref);
  const manifestPath = path.join(cacheDir, 'openclaw.plugin.json');
  if (await pathExists(manifestPath)) {
    process.stdout.write(`[openclaw-runtime] reusing cached git plugin: ${plugin.id}@${plugin.source.ref}\n`);
    return cacheDir;
  }

  const stagingCheckoutDir = path.join(tempRoot, 'sources', plugin.id);
  await fs.mkdir(stagingCheckoutDir, { recursive: true });
  runCommand('git', ['init', '-q', stagingCheckoutDir]);
  runCommand('git', ['-C', stagingCheckoutDir, 'remote', 'add', 'origin', plugin.source.repository]);
  runCommand('git', ['-C', stagingCheckoutDir, 'fetch', '--depth', '1', 'origin', plugin.source.ref]);
  runCommand('git', ['-C', stagingCheckoutDir, 'checkout', '--detach', 'FETCH_HEAD']);
  await fs.mkdir(path.dirname(cacheDir), { recursive: true });
  await fs.rm(cacheDir, { recursive: true, force: true });
  await fs.cp(stagingCheckoutDir, cacheDir, { recursive: true });
  process.stdout.write(`[openclaw-runtime] cached git plugin: ${plugin.id}@${plugin.source.ref}\n`);
  return cacheDir;
}

async function materializePluginSource(plugin, tempRoot, cacheRoot) {
  if (plugin.source.type === 'path') {
    return plugin.source.path;
  }

  if (plugin.source.type === 'npm') {
    return plugin.source.spec;
  }

  if (plugin.source.type === 'git') {
    return materializeGitPluginSource(plugin, tempRoot, cacheRoot);
  }

  throw new Error(`Unsupported source type for ${plugin.id}: ${plugin.source.type}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtimeRoot = path.resolve(args['runtime-root']);
  const nodeBin = path.resolve(args['node-bin']);
  const targetExtensionsDir = path.resolve(args['target-extensions-dir']);
  const manifestPath = args.manifest ? path.resolve(args.manifest) : undefined;

  const packagedPlugins = loadPackagedPlugins({ manifestPath });
  if (packagedPlugins.length === 0) {
    process.stdout.write('[openclaw-runtime] no packaged plugins declared\n');
    return;
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'iclaw-packaged-plugins-'));
  const cacheRoot = resolveCacheRoot();
  const stateDir = path.join(tempRoot, 'state');
  try {
    await fs.mkdir(stateDir, { recursive: true });
    await fs.mkdir(cacheRoot, { recursive: true });
    await fs.mkdir(targetExtensionsDir, { recursive: true });

    for (const plugin of packagedPlugins) {
      const installSpec = await materializePluginSource(plugin, tempRoot, cacheRoot);
      const env = {
        ...process.env,
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json'),
        HOME: path.join(tempRoot, 'home'),
      };
      await fs.mkdir(env.HOME, { recursive: true });
      runCommand(nodeBin, [path.join(runtimeRoot, 'openclaw.mjs'), 'plugins', 'install', installSpec], {
        env,
        cwd: runtimeRoot,
      });
      const installedDir = path.join(stateDir, 'extensions', plugin.id);
      await fs.access(installedDir);
      await copyDir(installedDir, path.join(targetExtensionsDir, plugin.id));
      process.stdout.write(`[openclaw-runtime] staged packaged plugin: ${plugin.id}\n`);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
