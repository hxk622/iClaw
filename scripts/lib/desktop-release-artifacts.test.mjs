import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyDesktopReleaseUpdaterState,
  nativeUpdaterExpected,
  resolveDesktopReleaseTargetArtifacts,
  supportedDesktopReleaseTargets,
} from './desktop-release-artifacts.mjs';

const windowsX64Target = supportedDesktopReleaseTargets.find((target) => target.platform === 'windows' && target.arch === 'x64');

test('nativeUpdaterExpected defaults to enabled and only disables on explicit falsy values', () => {
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: '1' }), true);
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: 'true' }), true);
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: 'yes' }), true);
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: '0' }), false);
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: 'false' }), false);
  assert.equal(nativeUpdaterExpected({ ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER: 'no' }), false);
  assert.equal(nativeUpdaterExpected({}), true);
});

test('resolveDesktopReleaseTargetArtifacts returns complete signed updater paths when both files exist', () => {
  const artifacts = resolveDesktopReleaseTargetArtifacts({
    releaseDir: '/tmp/releases',
    artifactBaseName: 'iClaw',
    channel: 'prod',
    appVersion: '1.0.9+202604171540',
    target: windowsX64Target,
    files: [
      'iClaw_1.0.9_x64_prod.exe',
      'iClaw_1.0.9_x64_prod.nsis.zip',
      'iClaw_1.0.9_x64_prod.nsis.zip.sig',
    ],
  });

  assert.ok(artifacts);
  assert.equal(artifacts.hasUpdater, true);
  assert.equal(artifacts.hasSignature, true);
  assert.match(artifacts.updaterPath || '', /iClaw_1\.0\.9_x64_prod\.nsis\.zip$/);
  assert.match(artifacts.signaturePath || '', /iClaw_1\.0\.9_x64_prod\.nsis\.zip\.sig$/);
});

test('classifyDesktopReleaseUpdaterState reports missing signature for partial updater artifacts', () => {
  const artifacts = resolveDesktopReleaseTargetArtifacts({
    releaseDir: '/tmp/releases',
    artifactBaseName: 'iClaw',
    channel: 'prod',
    appVersion: '1.0.9+202604171540',
    target: windowsX64Target,
    files: [
      'iClaw_1.0.9_x64_prod.exe',
      'iClaw_1.0.9_x64_prod.nsis.zip',
    ],
  });

  const classification = classifyDesktopReleaseUpdaterState(artifacts, { updaterExpected: true });
  assert.equal(classification.status, 'missing-signature');
});

test('classifyDesktopReleaseUpdaterState requires updater artifacts for updater-expected releases on all platforms', () => {
  const artifacts = resolveDesktopReleaseTargetArtifacts({
    releaseDir: '/tmp/releases',
    artifactBaseName: 'iClaw',
    channel: 'prod',
    appVersion: '1.0.9+202604171540',
    target: windowsX64Target,
    files: [
      'iClaw_1.0.9_x64_prod.exe',
    ],
  });

  const classification = classifyDesktopReleaseUpdaterState(artifacts, { updaterExpected: true });
  assert.equal(classification.status, 'missing-updater-and-signature');
});

test('classifyDesktopReleaseUpdaterState allows installer-only targets when updater is not requested', () => {
  const artifacts = resolveDesktopReleaseTargetArtifacts({
    releaseDir: '/tmp/releases',
    artifactBaseName: 'iClaw',
    channel: 'prod',
    appVersion: '1.0.9+202604171540',
    target: windowsX64Target,
    files: [
      'iClaw_1.0.9_x64_prod.exe',
    ],
  });

  const classification = classifyDesktopReleaseUpdaterState(artifacts, { updaterExpected: false });
  assert.equal(classification.status, 'not-requested');
});
