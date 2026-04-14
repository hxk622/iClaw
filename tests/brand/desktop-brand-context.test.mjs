import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadDesktopBrandContext } from '../../scripts/lib/desktop-brand-context.mjs';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

async function readRootPackageVersion() {
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  return String(packageJson.version || '').trim();
}

test('desktop brand context resolves shared stamp fields from one source of truth', async () => {
  const context = await loadDesktopBrandContext({ rootDir, brandId: 'licaiclaw' });
  const rootVersion = await readRootPackageVersion();
  const expectedBuildId = rootVersion.split('+')[1] || 'dev';

  assert.equal(context.brandId, 'licaiclaw');
  assert.equal(context.productName, '理财客');
  assert.equal(context.bundleIdentifier, 'ai.licaiclaw.desktop');
  assert.equal(context.artifactBaseName, 'LiCaiClaw');
  assert.equal(context.appVersion, rootVersion);
  assert.equal(context.buildId, expectedBuildId);
  assert.equal(context.stamp.brandId, context.brandId);
  assert.equal(context.stamp.productName, context.productName);
  assert.equal(context.stamp.bundleIdentifier, context.bundleIdentifier);
  assert.equal(context.stamp.artifactBaseName, context.artifactBaseName);
  assert.equal(context.stamp.buildId, context.buildId);
  assert.match(context.stamp.sourceProfileHash, /^[0-9a-f]{64}$/);
  assert.equal(
    context.staging.root,
    path.join(rootDir, '.build', 'desktop', 'licaiclaw', expectedBuildId),
  );
  assert.equal(
    context.staging.brandGeneratedJsonPath,
    path.join(rootDir, '.build', 'desktop', 'licaiclaw', expectedBuildId, 'desktop', 'src-tauri', 'brand.generated.json'),
  );
});

test('desktop brand context keeps different OEM identities isolated', async () => {
  const iclaw = await loadDesktopBrandContext({ rootDir, brandId: 'iclaw' });
  const licaiclaw = await loadDesktopBrandContext({ rootDir, brandId: 'licaiclaw' });

  assert.notEqual(iclaw.brandId, licaiclaw.brandId);
  assert.notEqual(iclaw.productName, licaiclaw.productName);
  assert.notEqual(iclaw.bundleIdentifier, licaiclaw.bundleIdentifier);
  assert.notEqual(iclaw.artifactBaseName, licaiclaw.artifactBaseName);
  assert.notEqual(iclaw.sourceProfileHash, licaiclaw.sourceProfileHash);
});
