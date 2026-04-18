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
  const context = await loadDesktopBrandContext({ rootDir, brandId: 'caiclaw' });
  const rootVersion = await readRootPackageVersion();
  const expectedBuildId = rootVersion.split('+')[1] || 'dev';

  assert.equal(context.brandId, 'caiclaw');
  assert.equal(context.productName, '理财客');
  assert.equal(context.bundleIdentifier, 'ai.caiclaw.desktop');
  assert.equal(context.artifactBaseName, 'caiclaw');
  assert.equal(context.appVersion, rootVersion);
  assert.equal(context.buildId, expectedBuildId);
  assert.equal(context.stamp.brandId, context.brandId);
  assert.equal(context.stamp.productName, context.productName);
  assert.equal(context.stamp.bundleIdentifier, context.bundleIdentifier);
  assert.equal(context.stamp.artifactBaseName, context.artifactBaseName);
  assert.equal(context.stamp.buildId, context.buildId);
  assert.match(context.stamp.sourceProfileHash, /^[0-9a-f]{64}$/);
  assert.ok(context.staging.root.startsWith(path.join(rootDir, '.build', 'desktop', 'caiclaw', expectedBuildId)));
  assert.equal(
    context.staging.brandGeneratedJsonPath,
    path.join(context.staging.root, 'desktop', 'src-tauri', 'brand.generated.json'),
  );
  assert.equal(context.staging.currentPath, path.join(rootDir, '.build', 'desktop', 'caiclaw', 'current.json'));
});

test('desktop brand context keeps different OEM identities isolated', async () => {
  const iclaw = await loadDesktopBrandContext({ rootDir, brandId: 'iclaw' });
  const caiclaw = await loadDesktopBrandContext({ rootDir, brandId: 'caiclaw' });

  assert.notEqual(iclaw.brandId, caiclaw.brandId);
  assert.notEqual(iclaw.productName, caiclaw.productName);
  assert.notEqual(iclaw.bundleIdentifier, caiclaw.bundleIdentifier);
  assert.notEqual(iclaw.artifactBaseName, caiclaw.artifactBaseName);
  assert.notEqual(iclaw.sourceProfileHash, caiclaw.sourceProfileHash);
});
