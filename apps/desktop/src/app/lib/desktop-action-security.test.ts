import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesktopActionIntentFingerprint,
  clampDesktopActionGrantScope,
  normalizeDesktopActionNetworkDestination,
  normalizeDesktopActionPath,
  shouldReuseDesktopActionGrant,
  verifyDesktopActionPlanHash,
} from './desktop-action-security.ts';

test('normalizeDesktopActionPath canonicalizes windows and posix paths', () => {
  assert.equal(
    normalizeDesktopActionPath('c:/Users/Admin/../Admin/AppData/Local/iClaw/', 'win32'),
    'C:\\Users\\Admin\\AppData\\Local\\iClaw',
  );
  assert.equal(normalizeDesktopActionPath('/tmp/../var/logs/', 'linux'), '/var/logs');
});

test('normalizeDesktopActionNetworkDestination derives normalized security boundary fields', () => {
  assert.deepEqual(normalizeDesktopActionNetworkDestination('https://Logs.iClaw.local:443/upload/runtime/'), {
    scheme: 'https',
    host: 'logs.iclaw.local',
    port: null,
    pathPrefix: '/upload/runtime',
    redirectPolicy: 'none',
  });
});

test('clampDesktopActionGrantScope keeps high-risk and elevated actions once-only', () => {
  assert.equal(clampDesktopActionGrantScope('session', 'collect_diagnostics', 'medium'), 'session');
  assert.equal(clampDesktopActionGrantScope('session', 'execute_shell', 'high'), 'once');
  assert.equal(clampDesktopActionGrantScope('task', 'elevated_execute', 'critical'), 'once');
});

test('buildDesktopActionIntentFingerprint binds access mode and network destinations', () => {
  const base = {
    capability: 'upload_diagnostics',
    riskLevel: 'high' as const,
    executorType: 'template' as const,
    executorTemplateId: 'upload-diagnostics-template',
    requiresElevation: false,
    publisherId: 'iclaw-official',
    packageDigest: 'sha256:pkg-001',
    compiledPlanHash: 'plan-001',
  };

  const readFingerprint = buildDesktopActionIntentFingerprint({
    ...base,
    resources: [{ kind: 'path', value: '/var/log/runtime.log', access: 'read' }],
    networkDestinations: [{ scheme: 'https', host: 'logs.iclaw.local', port: 443, pathPrefix: '/upload', redirectPolicy: 'allowlisted' }],
  });
  const writeFingerprint = buildDesktopActionIntentFingerprint({
    ...base,
    resources: [{ kind: 'path', value: '/var/log/runtime.log', access: 'write' }],
    networkDestinations: [{ scheme: 'https', host: 'logs.iclaw.local', port: 443, pathPrefix: '/upload', redirectPolicy: 'allowlisted' }],
  });

  assert.notEqual(readFingerprint, writeFingerprint);
});

test('shouldReuseDesktopActionGrant requires both fingerprint and approved plan hash match', () => {
  const grant = {
    intentFingerprint: 'intent-001',
    approvedPlanHash: 'plan-001',
    capability: 'collect_diagnostics',
    riskLevel: 'medium' as const,
    scope: 'session' as const,
    taskId: null,
    sessionKey: 'agent:main:main',
    expiresAt: null,
    revokedAt: null,
  };

  assert.equal(
    shouldReuseDesktopActionGrant({
      grant,
      intentFingerprint: 'intent-001',
      approvedPlanHash: 'plan-001',
      sessionKey: 'agent:main:main',
    }),
    true,
  );

  assert.equal(
    shouldReuseDesktopActionGrant({
      grant,
      intentFingerprint: 'intent-001',
      approvedPlanHash: 'plan-002',
      sessionKey: 'agent:main:main',
    }),
    false,
  );
});

test('verifyDesktopActionPlanHash rejects mismatched execution plans', () => {
  assert.deepEqual(verifyDesktopActionPlanHash({ approvedPlanHash: 'plan-001', executedPlanHash: 'plan-001' }), {
    ok: true,
    reason: null,
  });
  assert.deepEqual(verifyDesktopActionPlanHash({ approvedPlanHash: 'plan-001', executedPlanHash: 'plan-002' }), {
    ok: false,
    reason: 'plan_hash_mismatch',
  });
});
