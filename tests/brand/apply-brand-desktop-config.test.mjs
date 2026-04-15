import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const tauriConfigPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json');
const generatedConfigPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'tauri.generated.conf.json');
const generatedBrandPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'brand.generated.json');
const generatedIconsDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'icons-generated');
const stagingRoot = path.join(rootDir, '.build', 'desktop');
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
      const generatedBrand = await readJson(generatedBrandPath);
      const stageMarker = await readJson(path.join(stagingRoot, brandId, 'current.json'));
      const stagingDir = stageMarker.stageRoot;
      const stagedBrand = await readJson(path.join(stagingDir, 'desktop', 'src-tauri', 'brand.generated.json'));
      const expectedName = brandId === 'iclaw' ? 'iClaw' : generatedConfig.productName;
      assert.equal(tauriConfig.productName, expectedName);
      assert.equal(tauriConfig.app?.windows?.[0]?.title, expectedName);
      assert.equal(tauriConfig.bundle?.windows?.nsis?.installMode, 'perMachine');
      assert.equal(generatedConfig.productName, expectedName);
      assert.equal(generatedConfig.bundle?.windows?.nsis?.installMode, 'perMachine');
      assert.equal(generatedConfig.version, '1.0.6+202604141320');
      assert.equal(generatedBrand.build?.version, '1.0.6+202604141320');
      assert.equal(generatedBrand.build?.stamp?.brandId, brandId);
      assert.equal(generatedBrand.build?.stamp?.productName, expectedName);
      assert.equal(generatedBrand.build?.stamp?.bundleIdentifier, generatedBrand.bundleIdentifier);
      assert.equal(stageMarker.brandId, brandId);
      assert.equal(stageMarker.buildId, '202604141320');
      assert.equal(stagedBrand.build?.stamp?.brandId, brandId);
      await fs.access(path.join(stagingDir, 'brand-stamp.json'));
      await fs.access(path.join(stagingDir, 'manifest.json'));
      await fs.access(path.join(stagingDir, 'desktop', 'src-tauri', 'tauri.conf.json'));
      await fs.access(path.join(stagingDir, 'desktop', 'src-tauri', 'icons-generated', 'icon.ico'));
      await fs.access(path.join(stagingDir, 'desktop', 'src-tauri', 'installer-generated', 'nsis-installer.ico'));
      await fs.access(path.join(stagingDir, 'desktop', 'public', 'brand', 'favicon.ico'));
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

test('apply-brand creates a fresh disposable staging directory per run and updates current marker', async () => {
  await runNodeScript(['scripts/brand-generated-state.mjs', 'snapshot', snapshotKey]);
  try {
    await runNodeScript(['scripts/apply-brand.mjs', 'licaiclaw'], {
      APP_NAME: 'licaiclaw',
      ICLAW_DESKTOP_STAGE_RUN_ID: 'run-a',
    });
    const firstMarker = await readJson(path.join(stagingRoot, 'licaiclaw', 'current.json'));
    await fs.access(path.join(firstMarker.stageRoot, 'desktop', 'src-tauri', 'brand.generated.json'));

    await runNodeScript(['scripts/apply-brand.mjs', 'licaiclaw'], {
      APP_NAME: 'licaiclaw',
      ICLAW_DESKTOP_STAGE_RUN_ID: 'run-b',
    });
    const secondMarker = await readJson(path.join(stagingRoot, 'licaiclaw', 'current.json'));

    assert.equal(firstMarker.runId, 'run-a');
    assert.equal(secondMarker.runId, 'run-b');
    assert.notEqual(firstMarker.stageRoot, secondMarker.stageRoot);
    await fs.access(path.join(firstMarker.stageRoot, 'desktop', 'src-tauri', 'brand.generated.json'));
    await fs.access(path.join(secondMarker.stageRoot, 'desktop', 'src-tauri', 'brand.generated.json'));
  } finally {
    await runNodeScript(['scripts/brand-generated-state.mjs', 'restore', snapshotKey]);
  }
});
