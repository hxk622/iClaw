import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const tauriConfigPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json');
const snapshotKey = 'apply-brand-desktop-config-test';

function runNodeScript(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `command failed with exit code ${code}`));
    });
  });
}

async function readTauriConfig() {
  return JSON.parse(await fs.readFile(tauriConfigPath, 'utf8'));
}

test('apply-brand materializes desktop title from productName without hybrid branding', async () => {
  await runNodeScript(['scripts/brand-generated-state.mjs', 'snapshot', snapshotKey]);
  try {
    for (const [brandId, expectedName] of [
      ['iclaw', 'iClaw'],
      ['licaiclaw', '理财客'],
    ]) {
      await runNodeScript(['scripts/apply-brand.mjs', brandId], {APP_NAME: brandId});
      const tauriConfig = await readTauriConfig();
      assert.equal(tauriConfig.productName, expectedName);
      assert.equal(tauriConfig.app?.windows?.[0]?.title, expectedName);
      assert.notEqual(tauriConfig.productName, 'iClaw-理财客');
      assert.notEqual(tauriConfig.app?.windows?.[0]?.title, 'iClaw-理财客');
    }
  } finally {
    await runNodeScript(['scripts/brand-generated-state.mjs', 'restore', snapshotKey]);
  }
});
