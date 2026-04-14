import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const tauriConfigPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json');
const generatedConfigPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'tauri.generated.conf.json');
const generatedIconsDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'icons-generated');
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
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `command failed with exit code ${code}`));
    });
  });
}

async function readJson(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, 'utf8'));
}

test('apply-brand materializes desktop title and version from the selected brand', async () => {
  await runNodeScript(['scripts/brand-generated-state.mjs', 'snapshot', snapshotKey]);
  try {
    for (const brandId of ['iclaw', 'licaiclaw']) {
      await runNodeScript(['scripts/apply-brand.mjs', brandId], { APP_NAME: brandId });
      const tauriConfig = await readJson(tauriConfigPath);
      const generatedConfig = await readJson(generatedConfigPath);
      const expectedName = brandId === 'iclaw' ? 'iClaw' : generatedConfig.productName;
      assert.equal(tauriConfig.productName, expectedName);
      assert.equal(tauriConfig.app?.windows?.[0]?.title, expectedName);
      assert.equal(generatedConfig.productName, expectedName);
      assert.equal(generatedConfig.version, '1.0.6+202604141320');
      if (brandId === 'licaiclaw') {
        assert.notEqual(tauriConfig.productName, 'iClaw');
      }
    }
  } finally {
    await runNodeScript(['scripts/brand-generated-state.mjs', 'restore', snapshotKey]);
  }
});

test('apply-brand clears stale generated icon artifacts before rebuilding', async () => {
  await runNodeScript(['scripts/brand-generated-state.mjs', 'snapshot', snapshotKey]);
  try {
    await fs.mkdir(generatedIconsDir, { recursive: true });
    await fs.writeFile(path.join(generatedIconsDir, 'stale.txt'), 'stale\n', 'utf8');
    await runNodeScript(['scripts/apply-brand.mjs', 'licaiclaw'], { APP_NAME: 'licaiclaw' });
    await assert.rejects(() => fs.access(path.join(generatedIconsDir, 'stale.txt')));
    await fs.access(path.join(generatedIconsDir, 'icon.ico'));
  } finally {
    await runNodeScript(['scripts/brand-generated-state.mjs', 'restore', snapshotKey]);
  }
});
