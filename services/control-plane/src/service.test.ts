import test from 'node:test';
import assert from 'node:assert/strict';

import {config} from './config.ts';
import {createSignature} from './epay.ts';
import {HttpError} from './errors.ts';
import {ControlPlaneService} from './service.ts';
import {InMemoryControlPlaneStore} from './store.ts';
import {hashOpaqueToken} from './tokens.ts';

const ACCESS_TTL_MS = config.accessTokenTtlSeconds * 1000;
const REFRESH_TTL_MS = config.refreshTokenTtlSeconds * 1000;
const ABSOLUTE_TTL_MS = config.sessionAbsoluteTtlSeconds * 1000;

function withFakeNow<T>(fakeNow: number, run: () => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => fakeNow;
  return run().finally(() => {
    Date.now = originalNow;
  });
}

async function withBootstrapRoles<T>(
  overrides: {adminEmails?: string[]; superAdminEmails?: string[]},
  run: () => Promise<T>,
): Promise<T> {
  const previousAdminEmails = [...config.adminEmails];
  const previousSuperAdminEmails = [...config.superAdminEmails];
  config.adminEmails = overrides.adminEmails ? [...overrides.adminEmails] : [];
  config.superAdminEmails = overrides.superAdminEmails ? [...overrides.superAdminEmails] : [];
  try {
    return await run();
  } finally {
    config.adminEmails = previousAdminEmails;
    config.superAdminEmails = previousSuperAdminEmails;
  }
}

async function withEpayConfig<T>(
  overrides: {partnerId?: string; key?: string; gateway?: string},
  run: () => Promise<T>,
): Promise<T> {
  const previous = {
    partnerId: config.epayPartnerId,
    key: config.epayKey,
    gateway: config.epayGateway,
  };
  config.epayPartnerId = overrides.partnerId ?? previous.partnerId;
  config.epayKey = overrides.key ?? previous.key;
  config.epayGateway = overrides.gateway ?? previous.gateway;
  try {
    return await run();
  } finally {
    config.epayPartnerId = previous.partnerId;
    config.epayKey = previous.key;
    config.epayGateway = previous.gateway;
  }
}

test('authenticated API calls slide both token expiries without resetting session creation time', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'sliding-user',
    email: 'sliding@example.com',
    password: 'password123',
    name: 'Sliding User',
  });

  const initialSession = await store.getSessionByAccessToken(hashOpaqueToken(registration.tokens.access_token));
  assert.ok(initialSession);

  const createdAtMs = new Date(initialSession.createdAt).getTime();
  const fakeNow = createdAtMs + 3 * 24 * 60 * 60 * 1000;

  await withFakeNow(fakeNow, async () => {
    await service.me(registration.tokens.access_token);
  });

  const renewedSession = await store.getSessionByAccessToken(hashOpaqueToken(registration.tokens.access_token));
  assert.ok(renewedSession);
  assert.equal(renewedSession.createdAt, initialSession.createdAt);
  assert.equal(renewedSession.accessTokenExpiresAt, fakeNow + ACCESS_TTL_MS);
  assert.equal(renewedSession.refreshTokenExpiresAt, fakeNow + REFRESH_TTL_MS);
});

test('sliding renewal is clamped by the absolute session lifetime', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'absolute-user',
    email: 'absolute@example.com',
    password: 'password123',
    name: 'Absolute User',
  });

  const initialSession = await store.getSessionByAccessToken(hashOpaqueToken(registration.tokens.access_token));
  assert.ok(initialSession);

  const createdAtMs = new Date(initialSession.createdAt).getTime();
  const absoluteExpiresAt = createdAtMs + ABSOLUTE_TTL_MS;

  for (const dayOffset of [6, 12, 18, 24]) {
    const fakeNow = createdAtMs + dayOffset * 24 * 60 * 60 * 1000;
    await withFakeNow(fakeNow, async () => {
      await service.me(registration.tokens.access_token);
    });
  }

  const clampedSession = await store.getSessionByAccessToken(hashOpaqueToken(registration.tokens.access_token));
  assert.ok(clampedSession);
  assert.equal(clampedSession.accessTokenExpiresAt, absoluteExpiresAt);
  assert.equal(clampedSession.refreshTokenExpiresAt, absoluteExpiresAt);

  await withFakeNow(absoluteExpiresAt + 1, async () => {
    await assert.rejects(service.me(registration.tokens.access_token), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      return true;
    });
  });
});

test('refresh keeps the original session anchor and stops working after the absolute cap', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'refresh-user',
    email: 'refresh@example.com',
    password: 'password123',
    name: 'Refresh User',
  });

  const initialSession = await store.getSessionByRefreshToken(hashOpaqueToken(registration.tokens.refresh_token));
  assert.ok(initialSession);

  const createdAtMs = new Date(initialSession.createdAt).getTime();
  const firstRefreshAt = createdAtMs + 6 * 24 * 60 * 60 * 1000;
  const refreshedTokens = await withFakeNow(firstRefreshAt, async () =>
    service.refresh(registration.tokens.refresh_token),
  );

  const refreshedSession = await store.getSessionByRefreshToken(hashOpaqueToken(refreshedTokens.refresh_token));
  assert.ok(refreshedSession);
  assert.equal(refreshedSession.createdAt, initialSession.createdAt);
  assert.equal(refreshedSession.accessTokenExpiresAt, firstRefreshAt + ACCESS_TTL_MS);
  assert.equal(refreshedSession.refreshTokenExpiresAt, firstRefreshAt + REFRESH_TTL_MS);

  let currentRefreshToken = refreshedTokens.refresh_token;
  for (const dayOffset of [12, 18, 24]) {
    const rotatedTokens = await withFakeNow(createdAtMs + dayOffset * 24 * 60 * 60 * 1000, async () =>
      service.refresh(currentRefreshToken),
    );
    currentRefreshToken = rotatedTokens.refresh_token;
  }

  const secondRefreshAt = createdAtMs + 28 * 24 * 60 * 60 * 1000;
  const finalTokens = await withFakeNow(secondRefreshAt, async () => service.refresh(currentRefreshToken));
  const finalSession = await store.getSessionByRefreshToken(hashOpaqueToken(finalTokens.refresh_token));
  assert.ok(finalSession);
  assert.equal(finalSession.createdAt, initialSession.createdAt);
  assert.equal(finalSession.accessTokenExpiresAt, createdAtMs + ABSOLUTE_TTL_MS);
  assert.equal(finalSession.refreshTokenExpiresAt, createdAtMs + ABSOLUTE_TTL_MS);

  await withFakeNow(createdAtMs + ABSOLUTE_TTL_MS + 1, async () => {
    await assert.rejects(service.refresh(finalTokens.refresh_token), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      return true;
    });
  });
});

test('configured super admin email is promoted during auth flows', async () => {
  await withBootstrapRoles({ superAdminEmails: ['515177265@qq.com'] }, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);

    const registration = await service.register({
      username: 'founder',
      email: '515177265@qq.com',
      password: 'password123',
      name: 'Founder',
    });

    assert.equal(registration.user.role, 'super_admin');

    const persisted = await store.getUserByEmail('515177265@qq.com');
    assert.equal(persisted?.role, 'super_admin');

    const login = await service.login({
      identifier: '515177265@qq.com',
      password: 'password123',
    });
    assert.equal(login.user.role, 'super_admin');

    const current = await service.me(login.tokens.access_token);
    assert.equal(current.role, 'super_admin');
  });
});

test('login accepts legacy credential field alias', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  await service.register({
    username: 'legacy-login',
    email: 'legacy@example.com',
    password: 'password123',
    name: 'Legacy Login',
  });

  const login = await service.login({
    identifier: 'legacy@example.com',
    credential: 'password123',
  });

  assert.ok(login.tokens.access_token);
  assert.equal(login.user.email, 'legacy@example.com');
});

test('auth responses normalize legacy localhost avatar urls to the public api base', async () => {
  const previousApiUrl = config.apiUrl;
  config.apiUrl = 'https://iclaw.aiyuanxi.com';
  try {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'avatar-localhost-user',
      email: 'avatar-localhost@example.com',
      password: 'password123',
      name: 'Avatar Localhost',
    });

    const persisted = await store.getUserByEmail('avatar-localhost@example.com');
    assert.ok(persisted);
    await store.updateUserProfile(persisted.id, {
      avatarUrl:
        'http://127.0.0.1:2130/auth/avatar?key=avatars%2Favatar-localhost-user%2Favatar-demo.png',
    });

    const login = await service.login({
      identifier: 'avatar-localhost@example.com',
      password: 'password123',
    });
    assert.equal(
      login.user.avatar_url,
      'https://iclaw.aiyuanxi.com/auth/avatar?key=avatars%2Favatar-localhost-user%2Favatar-demo.png',
    );

    const current = await service.me(registration.tokens.access_token);
    assert.equal(
      current.avatar_url,
      'https://iclaw.aiyuanxi.com/auth/avatar?key=avatars%2Favatar-localhost-user%2Favatar-demo.png',
    );
  } finally {
    config.apiUrl = previousApiUrl;
  }
});

test('non-admin users cannot access admin skill catalog APIs', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'plain-user',
    email: 'plain@example.com',
    password: 'password123',
    name: 'Plain User',
  });

  await assert.rejects(service.listAdminSkillCatalog(registration.tokens.access_token), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('desktop action security flow persists policies, grants, audit events, and diagnostic uploads', async () => {
  await withBootstrapRoles({adminEmails: ['security-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);

    const admin = await service.register({
      username: 'security-admin',
      email: 'security-admin@example.com',
      password: 'password123',
      name: 'Security Admin',
    });
    const user = await service.register({
      username: 'security-user',
      email: 'security-user@example.com',
      password: 'password123',
      name: 'Security User',
    });

    const policy = await service.upsertAdminDesktopActionPolicy(admin.tokens.access_token, {
      id: 'policy-diagnostics',
      scope: 'platform',
      name: 'Diagnostic Upload Policy',
      effect: 'allow_with_approval',
      capability: 'collect_diagnostics',
      risk_level: 'medium',
      grant_scope: 'session',
      max_grant_scope: 'session',
      enabled: true,
      priority: 20,
      official_only: true,
      publisher_ids: ['iclaw-official'],
      allow_network_egress: true,
      skill_slugs: ['official-diagnostics'],
      executor_template_ids: ['collect-diagnostics-template'],
      executor_types: ['template'],
      access_modes: ['read', 'connect'],
      network_destinations: [{scheme: 'https', host: 'logs.iclaw.local', port: 443, pathPrefix: '/upload', redirectPolicy: 'allowlisted'}],
    });
    assert.equal(policy.capability, 'collect_diagnostics');
    assert.deepEqual(policy.publisher_ids, ['iclaw-official']);

    const adminPolicies = await service.listAdminDesktopActionPolicies(admin.tokens.access_token, {
      capability: 'collect_diagnostics',
    });
    assert.equal(adminPolicies.items.length, 1);

    const snapshot = await service.getRuntimeDesktopActionPolicySnapshot(user.tokens.access_token, 'iclaw');
    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.items[0]?.effect, 'allow_with_approval');

    const grant = await service.createDesktopActionApprovalGrant(user.tokens.access_token, {
      device_id: 'device-001',
      app_name: 'iclaw',
      intent_fingerprint: 'intent-fp-001',
      approved_plan_hash: 'plan-hash-001',
      capability: 'collect_diagnostics',
      risk_level: 'medium',
      scope: 'session',
      session_key: 'agent:main:main',
      access_modes: ['read', 'connect'],
      normalized_resources: [{kind: 'path', value: '/logs/runtime.log', access: 'read'}],
      network_destinations: [{scheme: 'https', host: 'logs.iclaw.local', port: 443, pathPrefix: '/upload', redirectPolicy: 'allowlisted'}],
      executor_type: 'template',
      executor_template_id: 'collect-diagnostics-template',
      publisher_id: 'iclaw-official',
      package_digest: 'sha256:bundle-001',
    });
    assert.equal(grant.device_id, 'device-001');
    assert.equal(grant.approved_plan_hash, 'plan-hash-001');

    const audits = await service.recordDesktopActionAuditEvents(user.tokens.access_token, [
      {
        intent_id: 'intent-001',
        trace_id: 'trace-001',
        device_id: 'device-001',
        app_name: 'iclaw',
        capability: 'collect_diagnostics',
        risk_level: 'medium',
        decision: 'pending',
        stage: 'approval_requested',
        summary: 'Need to upload local logs',
        resources: [{kind: 'log', path: 'logs/runtime.log'}],
        matched_policy_rule_id: 'policy-diagnostics',
        approved_plan_hash: 'plan-hash-001',
        command_snapshot_redacted: 'tar logs && upload [REDACTED]',
      },
      {
        intent_id: 'intent-001',
        trace_id: 'trace-001',
        device_id: 'device-001',
        app_name: 'iclaw',
        capability: 'collect_diagnostics',
        risk_level: 'medium',
        decision: 'allow',
        stage: 'approval_granted',
        summary: 'User approved diagnostic upload',
        matched_policy_rule_id: 'policy-diagnostics',
        approved_plan_hash: 'plan-hash-001',
        executed_plan_hash: 'plan-hash-001',
        command_snapshot_redacted: 'tar logs && upload [REDACTED]',
      },
    ]);
    assert.equal(audits.items.length, 2);
    assert.equal(audits.items[0]?.matched_policy_rule_id, 'policy-diagnostics');

    const upload = await service.recordDesktopDiagnosticUpload(user.tokens.access_token, {
      device_id: 'device-001',
      app_name: 'iclaw',
      upload_bucket: 'desktop-logs',
      upload_key: 'users/security-user/trace-001/runtime.log',
      file_name: 'runtime.log',
      file_size_bytes: 2048,
      source_type: 'approval_flow',
      contains_customer_logs: true,
      sensitivity_level: 'customer',
      linked_intent_id: 'intent-001',
    });
    assert.equal(upload.source_type, 'approval_flow');
    assert.equal(upload.contains_customer_logs, true);

    const adminAudits = await service.listAdminDesktopActionAuditEvents(admin.tokens.access_token, {
      intent_id: 'intent-001',
    });
    assert.equal(adminAudits.items.length, 2);

    const adminGrants = await service.listAdminDesktopActionApprovalGrants(admin.tokens.access_token, {
      user_id: user.user.id,
      active_only: true,
    });
    assert.equal(adminGrants.items.length, 1);

    const revoked = await service.revokeAdminDesktopActionApprovalGrant(admin.tokens.access_token, grant.id);
    assert.ok(revoked.revoked_at);

    const diagnosticUploads = await service.listAdminDesktopDiagnosticUploads(admin.tokens.access_token, {
      user_id: user.user.id,
    });
    assert.equal(diagnosticUploads.items.length, 1);
    assert.equal(diagnosticUploads.items[0]?.upload_key, 'users/security-user/trace-001/runtime.log');
  });
});

test('desktop fault reports support anonymous upload records and admin detail/download metadata', async () => {
  await withBootstrapRoles({adminEmails: ['fault-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);

    const admin = await service.register({
      username: 'fault-admin',
      email: 'fault-admin@example.com',
      password: 'password123',
      name: 'Fault Admin',
    });

    await store.createDesktopFaultReport({
      id: 'fault-record-001',
      report_id: 'FR-TEST-001',
      entry: 'installer',
      account_state: 'anonymous',
      user_id: null,
      device_id: 'device-fault-001',
      install_session_id: 'install-session-001',
      app_name: 'iclaw',
      brand_id: 'iclaw',
      app_version: '1.2.3',
      release_channel: 'prod',
      platform: 'windows',
      platform_version: 'Windows 11',
      arch: 'x64',
      failure_stage: 'runtime_install',
      error_title: 'Runtime Installation Failed',
      error_message: 'permission denied',
      error_code: 'EACCES',
      runtime_found: false,
      runtime_installable: true,
      runtime_version: '1.0.0',
      runtime_path: 'C:\\runtime',
      work_dir: 'C:\\work',
      log_dir: 'C:\\logs',
      runtime_download_url: 'https://downloads.example.com/runtime.zip',
      install_progress_phase: 'extract',
      install_progress_percent: 42,
      upload_bucket: 'iclaw-user-assets',
      upload_key: 'tenants/iclaw/desktop-fault-reports/FR-TEST-001/fault-report-FR-TEST-001.zip',
      file_name: 'fault-report-FR-TEST-001.zip',
      file_size_bytes: 2048,
      file_sha256: 'sha256-001',
      created_at: '2026-04-12T00:00:00.000Z',
    });

    const list = await service.listAdminDesktopFaultReports(admin.tokens.access_token, {
      device_id: 'device-fault-001',
    });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.report_id, 'FR-TEST-001');
    assert.equal(list.items[0]?.account_state, 'anonymous');

    const detail = await service.getAdminDesktopFaultReport(
      admin.tokens.access_token,
      'fault-record-001',
      'https://control.example.com',
    );
    assert.equal(detail.runtime_found, false);
    assert.match(detail.download_url, /\/admin\/desktop\/fault-reports\/fault-record-001\/download$/);
    assert.equal(detail.upload_key, 'tenants/iclaw/desktop-fault-reports/FR-TEST-001/fault-report-FR-TEST-001.zip');
  });
});

test('client metrics events and crash ingestion support anonymous and authenticated contexts', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const user = await service.register({
    username: 'metrics-user',
    email: 'metrics-user@example.com',
    password: 'password123',
    name: 'Metrics User',
  });

  const anonymousEvents = await service.recordClientMetricEvents(null, [
    {
      event_name: 'install_start',
      event_time: '2026-04-12T08:00:00.000Z',
      device_id: 'device-metrics-001',
      install_id: 'install-001',
      app_name: 'iclaw',
      brand_id: 'iclaw',
      app_version: '1.0.5',
      platform: 'windows',
      arch: 'x64',
      payload_json: { step: 'begin' },
    },
    {
      event_name: 'install_failed',
      event_time: '2026-04-12T08:00:08.000Z',
      device_id: 'device-metrics-001',
      install_id: 'install-001',
      app_name: 'iclaw',
      brand_id: 'iclaw',
      app_version: '1.0.5',
      platform: 'windows',
      arch: 'x64',
      result: 'failed',
      error_code: 'EACCES',
      duration_ms: 8000,
      payload_json: { failure_stage: 'runtime_install' },
    },
  ]);
  assert.equal(anonymousEvents.items.length, 2);
  assert.equal(anonymousEvents.items[0]?.userId, null);

  const authedEvents = await service.recordClientMetricEvents(user.tokens.access_token, {
    event_name: 'login_success',
    event_time: '2026-04-12T08:01:00.000Z',
    device_id: 'device-metrics-001',
    session_id: 'session-001',
    app_name: 'iclaw',
    brand_id: 'iclaw',
    app_version: '1.0.5',
    platform: 'windows',
    arch: 'x64',
    result: 'success',
    payload_json: { auth_provider: 'password' },
  });
  assert.equal(authedEvents.items.length, 1);
  assert.equal(authedEvents.items[0]?.userId, user.user.id);

  const crash = await service.recordClientCrashEvent(null, {
    crash_type: 'renderer',
    event_time: '2026-04-12T08:02:00.000Z',
    device_id: 'device-metrics-001',
    app_name: 'iclaw',
    brand_id: 'iclaw',
    app_version: '1.0.5',
    platform: 'windows',
    arch: 'x64',
    error_title: 'Unhandled Exception',
    error_message: 'Cannot read property x of undefined',
    stack_summary: 'stack...',
  });
  assert.equal(crash.userId, null);
  assert.equal(crash.crashType, 'renderer');

  const storedEvents = await store.listClientMetricEvents({ deviceId: 'device-metrics-001' });
  assert.equal(storedEvents.length, 3);
  const storedCrashes = await store.listClientCrashEvents({ deviceId: 'device-metrics-001' });
  assert.equal(storedCrashes.length, 1);
});

test('desktop action policy invariants reject unsafe shell whitelist and elevated reusable grants', async () => {
  await withBootstrapRoles({adminEmails: ['security-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);

    const admin = await service.register({
      username: 'security-admin-2',
      email: 'security-admin@example.com',
      password: 'password123',
      name: 'Security Admin 2',
    });
    const user = await service.register({
      username: 'security-user-2',
      email: 'security-user-2@example.com',
      password: 'password123',
      name: 'Security User 2',
    });

    await assert.rejects(
      service.upsertAdminDesktopActionPolicy(admin.tokens.access_token, {
        id: 'policy-shell-unsafe',
        scope: 'platform',
        name: 'Unsafe Shell Auto Allow',
        effect: 'allow',
        capability: 'execute_shell',
        risk_level: 'high',
        executor_template_ids: ['shell-template'],
      }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.match(error.message, /cannot use effect=allow/);
        return true;
      },
    );

    const elevatedPolicy = await service.upsertAdminDesktopActionPolicy(admin.tokens.access_token, {
      id: 'policy-elevated-once',
      scope: 'platform',
      name: 'Elevated Repair',
      effect: 'allow_with_approval',
      capability: 'elevated_execute',
      risk_level: 'critical',
      official_only: true,
      publisher_ids: ['iclaw-official'],
      grant_scope: 'session',
      max_grant_scope: 'session',
      executor_template_ids: ['elevated-repair-template'],
      executor_types: ['template'],
    });
    assert.equal(elevatedPolicy.grant_scope, 'once');
    assert.equal(elevatedPolicy.max_grant_scope, 'once');

    const elevatedGrant = await service.createDesktopActionApprovalGrant(user.tokens.access_token, {
      device_id: 'device-002',
      app_name: 'iclaw',
      intent_fingerprint: 'intent-fp-elevated',
      approved_plan_hash: 'plan-hash-elevated',
      capability: 'elevated_execute',
      risk_level: 'critical',
      scope: 'session',
      session_key: 'agent:main:main',
      executor_type: 'template',
    });
    assert.equal(elevatedGrant.scope, 'once');
  });
});

test('payment orders without checkout urls stay empty instead of falling back to placeholder qr payloads', async () => {
  const store = new InMemoryControlPlaneStore();
  const order = await store.createPaymentOrder('user_123', {
    provider: 'wechat_qr',
    package_id: 'topup_3000',
    return_url: '',
    app_name: 'iclaw',
    app_version: '1.0.0',
    release_channel: 'dev',
    platform: 'darwin',
    arch: 'arm64',
    user_agent: 'desktop-test',
    payment_url: null,
    packageName: '3000 龙虾币',
    credits: 3000,
    bonusCredits: 0,
    amountCnyFen: 2990,
    metadata: {},
  });

  assert.equal(order.paymentUrl, null);
});

test('createPaymentOrder rejects OEM-disabled recharge payment methods', async () => {
  const store = new InMemoryControlPlaneStore();
  store.setRechargePaymentMethodsConfig('iclaw-oem', {
    surfaces: {
      recharge: {
        config: {
          payment_methods: [
            {
              provider: 'alipay_qr',
              enabled: true,
              is_default: true,
              sort_order: 10,
            },
            {
              provider: 'wechat_qr',
              enabled: false,
              sort_order: 20,
            },
          ],
        },
      },
    },
  });
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'payment-user',
    email: 'payment-user@example.com',
    password: 'password123',
    name: 'Payment User',
  });

  await assert.rejects(
    service.createPaymentOrder(registration.tokens.access_token, {
      provider: 'wechat_qr',
      package_id: 'topup_3000',
      app_name: 'iclaw-oem',
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /未启用/);
      return true;
    },
  );
});

test('admin payment gateway config persists and returns exact values from control-plane store', async () => {
  await withBootstrapRoles({adminEmails: ['payments-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'payments-admin',
      email: 'payments-admin@example.com',
      password: 'password123',
      name: 'Payments Admin',
    });

    const saved = await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-001',
        gateway: 'https://epay.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-xyz',
      },
    });

    assert.equal(saved.provider, 'epay');
    assert.equal(saved.source, 'admin');
    assert.equal(saved.config.partner_id, 'platform-partner-001');
    assert.equal(saved.config.gateway, 'https://epay.example.com/submit.php');
    assert.deepEqual(saved.secret_values, {
      key: 'platform-key-xyz',
    });
    assert.deepEqual(saved.configured_secret_keys, ['key']);
    assert.equal(saved.completeness_status, 'configured');
    assert.deepEqual(saved.missing_fields, []);

    const fetched = await service.getAdminPaymentGatewayConfig(registration.tokens.access_token);
    assert.equal(fetched.source, 'admin');
    assert.deepEqual(fetched.config, {
      partner_id: 'platform-partner-001',
      gateway: 'https://epay.example.com/submit.php',
    });
    assert.deepEqual(fetched.secret_values, {
      key: 'platform-key-xyz',
    });
    assert.deepEqual(fetched.configured_secret_keys, ['key']);
    assert.equal(fetched.completeness_status, 'configured');
  });
});

test('OEM payment gateway inherits platform by default and can override independently', async () => {
  await withBootstrapRoles({adminEmails: ['payments-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'payments-admin',
      email: 'payments-admin@example.com',
      password: 'password123',
      name: 'Payments Admin',
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-001',
        gateway: 'https://platform-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-xyz',
      },
    });

    const inherited = await service.getAdminPaymentGatewayConfig(registration.tokens.access_token, {
      scope_type: 'app',
      scope_key: 'licaiclaw',
    });
    assert.equal(inherited.source, 'platform_inherited');
    assert.equal(inherited.scope_type, 'app');
    assert.equal(inherited.scope_key, 'licaiclaw');
    assert.deepEqual(inherited.config, {
      partner_id: 'platform-partner-001',
      gateway: 'https://platform-epay.example.com/submit.php',
    });

    const saved = await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      scope_type: 'app',
      scope_key: 'licaiclaw',
      config_values: {
        partner_id: 'oem-partner-002',
        gateway: 'https://oem-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'oem-key-xyz',
      },
    });
    assert.equal(saved.source, 'admin');
    assert.equal(saved.scope_type, 'app');
    assert.equal(saved.scope_key, 'licaiclaw');
    assert.deepEqual(saved.config, {
      partner_id: 'oem-partner-002',
      gateway: 'https://oem-epay.example.com/submit.php',
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      scope_type: 'app',
      scope_key: 'iclaw',
      config_values: {
        partner_id: 'oem-partner-003',
        gateway: 'https://iclaw-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'iclaw-key-xyz',
      },
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-004',
        gateway: 'https://platform-epay-v2.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-v2',
      },
    });

    const iclawConfig = await service.getAdminPaymentGatewayConfig(registration.tokens.access_token, {
      scope_type: 'app',
      scope_key: 'iclaw',
    });
    const licaiclawConfig = await service.getAdminPaymentGatewayConfig(registration.tokens.access_token, {
      scope_type: 'app',
      scope_key: 'licaiclaw',
    });
    assert.equal(iclawConfig.source, 'admin');
    assert.equal(licaiclawConfig.source, 'admin');
    assert.deepEqual(iclawConfig.config, {
      partner_id: 'oem-partner-003',
      gateway: 'https://iclaw-epay.example.com/submit.php',
    });
    assert.deepEqual(licaiclawConfig.config, {
      partner_id: 'oem-partner-002',
      gateway: 'https://oem-epay.example.com/submit.php',
    });

    const created = await service.createPaymentOrder(registration.tokens.access_token, {
      provider: 'wechat_qr',
      package_id: 'topup_3000',
      app_name: 'licaiclaw',
    });
    assert.ok(created.payment_url);
    const paymentUrl = new URL(created.payment_url);
    assert.equal(paymentUrl.origin, 'https://oem-epay.example.com');
    assert.equal(paymentUrl.pathname, '/submit.php');
    assert.equal(paymentUrl.searchParams.get('pid'), 'oem-partner-002');
  });
});

test('OEM payment gateway can explicitly restore platform inheritance', async () => {
  await withBootstrapRoles({adminEmails: ['payments-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'payments-admin',
      email: 'payments-admin@example.com',
      password: 'password123',
      name: 'Payments Admin',
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-001',
        gateway: 'https://platform-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-xyz',
      },
    });
    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      scope_type: 'app',
      scope_key: 'iclaw',
      config_values: {
        partner_id: 'iclaw-partner-001',
        gateway: 'https://iclaw-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'iclaw-key-xyz',
      },
    });

    const restored = await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      scope_type: 'app',
      scope_key: 'iclaw',
      mode: 'inherit_platform',
    });
    assert.equal(restored.source, 'platform_inherited');
    assert.equal(restored.scope_type, 'app');
    assert.equal(restored.scope_key, 'iclaw');
    assert.deepEqual(restored.config, {
      partner_id: 'platform-partner-001',
      gateway: 'https://platform-epay.example.com/submit.php',
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-002',
        gateway: 'https://platform-epay-v2.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-v2',
      },
    });

    const inherited = await service.getAdminPaymentGatewayConfig(registration.tokens.access_token, {
      scope_type: 'app',
      scope_key: 'iclaw',
    });
    assert.equal(inherited.source, 'platform_inherited');
    assert.deepEqual(inherited.config, {
      partner_id: 'platform-partner-002',
      gateway: 'https://platform-epay-v2.example.com/submit.php',
    });
  });
});

test('blank admin payment gateway config overrides env fallback for payment order creation', async () => {
  await withEpayConfig(
    {
      partnerId: 'env-partner-001',
      key: 'env-key-xyz',
      gateway: 'https://epay-env.example.com/submit.php',
    },
    async () => {
      const store = new InMemoryControlPlaneStore();
      await store.setSystemState('payment_gateway:epay', {
        provider: 'epay',
        config_values: {
          partner_id: '',
          gateway: '',
        },
        configured_secret_keys: [],
        secret_payload_encrypted: null,
        updated_at: new Date().toISOString(),
      });
      const service = new ControlPlaneService(store);
      const registration = await service.register({
        username: 'payment-gateway-user',
        email: 'payment-gateway-user@example.com',
        password: 'password123',
        name: 'Payment Gateway User',
      });

      await assert.rejects(
        service.createPaymentOrder(registration.tokens.access_token, {
          provider: 'wechat_qr',
          package_id: 'topup_3000',
          app_name: 'iclaw',
        }),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.equal(error.statusCode, 503);
          assert.match(error.message, /支付中心为当前 OEM 或平台/);
          return true;
        },
      );
    },
  );
});

test('epay webhook for OEM order verifies with OEM-specific key', async () => {
  await withBootstrapRoles({adminEmails: ['payments-admin@example.com']}, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'payments-admin',
      email: 'payments-admin@example.com',
      password: 'password123',
      name: 'Payments Admin',
    });

    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      config_values: {
        partner_id: 'platform-partner-001',
        gateway: 'https://platform-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'platform-key-xyz',
      },
    });
    await service.upsertAdminPaymentGatewayConfig(registration.tokens.access_token, {
      provider: 'epay',
      scope_type: 'app',
      scope_key: 'licaiclaw',
      config_values: {
        partner_id: 'oem-partner-002',
        gateway: 'https://oem-epay.example.com/submit.php',
      },
      secret_values: {
        key: 'oem-key-xyz',
      },
    });

    const created = await service.createPaymentOrder(registration.tokens.access_token, {
      provider: 'wechat_qr',
      package_id: 'topup_3000',
      app_name: 'licaiclaw',
    });
    const payload = {
      out_trade_no: created.order_id,
      trade_no: 'epay-oem-paid-001',
      trade_status: 'TRADE_SUCCESS',
      type: 'wxpay',
      money: '30.00',
    };

    const resolved = await service.applyEpayWebhook({
      ...payload,
      sign: createSignature(payload, 'oem-key-xyz'),
      sign_type: 'MD5',
    });
    assert.equal(resolved.status, 'paid');

    const credits = await service.creditsMe(registration.tokens.access_token);
    assert.equal(credits.topup_balance, 3000);
  });
});

test('getPaymentOrder reconciles pending epay orders via provider query when webhook is missing', async () => {
  await withEpayConfig(
    {
      partnerId: 'query-partner-001',
      key: 'query-key-xyz',
      gateway: 'https://vip1.zhunfu.cn/submit.php',
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const mockedFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            code: 1,
            trade_no: 'epay-query-paid-001',
            out_trade_no: 'ignored',
            status: 1,
            endtime: '2026-04-06 18:20:00',
          }),
          {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          },
        );
      globalThis.fetch = mockedFetch;

      try {
        const store = new InMemoryControlPlaneStore();
        const service = new ControlPlaneService(store);
        const registration = await service.register({
          username: 'epay-query-user',
          email: 'epay-query-user@example.com',
          password: 'password123',
          name: 'Epay Query User',
        });

        const created = await service.createPaymentOrder(registration.tokens.access_token, {
          provider: 'wechat_qr',
          package_id: 'topup_3000',
          app_name: 'iclaw',
        });
        assert.equal(created.status, 'pending');

        const resolved = await service.getPaymentOrder(registration.tokens.access_token, created.order_id);
        assert.equal(resolved.status, 'paid');

        const credits = await service.creditsMe(registration.tokens.access_token);
        assert.equal(credits.topup_balance, 3000);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});

test('credits ledger orders usage debits by assistant timestamp instead of settlement time', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);
  const registration = await service.register({
    username: 'credit-ledger-user',
    email: 'credit-ledger@example.com',
    password: 'password123',
    name: 'Credit Ledger User',
  });
  const initialSession = await store.getSessionByAccessToken(hashOpaqueToken(registration.tokens.access_token));
  assert.ok(initialSession);
  const baseNow = new Date(initialSession.createdAt).getTime() + 1_000;

  const sessionKey = 'agent:main:main';
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const laterAssistantGrant = await store.createRunGrant({
    userId: registration.user.id,
    sessionKey,
    client: 'desktop',
    nonce: 'nonce-later-assistant',
    maxInputTokens: 2_000,
    maxOutputTokens: 2_000,
    creditLimit: 100,
    expiresAt,
    signature: 'sig-later-assistant',
  });
  const earlierAssistantGrant = await store.createRunGrant({
    userId: registration.user.id,
    sessionKey,
    client: 'desktop',
    nonce: 'nonce-earlier-assistant',
    maxInputTokens: 2_000,
    maxOutputTokens: 2_000,
    creditLimit: 100,
    expiresAt,
    signature: 'sig-earlier-assistant',
  });

  await withFakeNow(baseNow + 1_000, async () => {
    await service.recordUsageEvent(registration.tokens.access_token, {
      event_id: 'evt-later-assistant',
      grant_id: laterAssistantGrant.id,
      input_tokens: 40,
      output_tokens: 120,
      provider: 'openai',
      model: 'gpt-5.4',
      app_name: 'iClaw',
      assistant_timestamp: baseNow + 3_000,
    });
  });

  await withFakeNow(baseNow + 2_000, async () => {
    await service.recordUsageEvent(registration.tokens.access_token, {
      event_id: 'evt-earlier-assistant',
      grant_id: earlierAssistantGrant.id,
      input_tokens: 35,
      output_tokens: 110,
      provider: 'openai',
      model: 'gpt-5.4',
      app_name: 'iClaw',
      assistant_timestamp: baseNow + 2_000,
    });
  });

  await withFakeNow(baseNow + 3_000, async () => {
    const ledger = await store.getCreditLedger(registration.user.id);
    const usageItems = ledger.filter((item) => item.eventType === 'usage_debit');
    assert.ok(usageItems.length >= 2);
    assert.equal(usageItems[0]?.referenceId, 'evt-later-assistant');
    assert.equal(usageItems[1]?.referenceId, 'evt-earlier-assistant');
  });
});

test('super admin can update and remove cloud skill catalog entries', async () => {
  await withBootstrapRoles({ superAdminEmails: ['515177265@qq.com'] }, async () => {
    const store = new InMemoryControlPlaneStore();
    const service = new ControlPlaneService(store);
    const registration = await service.register({
      username: 'skill-admin',
      email: '515177265@qq.com',
      password: 'password123',
      name: 'Skill Admin',
    });

    const updated = await service.upsertAdminSkillCatalogEntry(registration.tokens.access_token, {
      slug: 'custom-cloud-skill',
      name: 'Custom Cloud Skill',
      description: 'cloud catalog test entry',
      category: 'screening',
      publisher: 'Test Publisher',
      tags: ['A股', 'ESG', '精选'],
      active: false,
      distribution: 'cloud',
    });
    assert.equal(updated.category, 'screening');
    assert.deepEqual(updated.tags, ['A股', 'ESG', '精选']);
    assert.equal(updated.active, false);

    const publicCatalog = await service.listSkillCatalog();
    assert.equal(publicCatalog.items.some((item) => item.slug === 'custom-cloud-skill'), false);

    const adminCatalog = await service.listAdminSkillCatalog(registration.tokens.access_token);
    const adminEntry = adminCatalog.items.find((item) => item.slug === 'custom-cloud-skill');
    assert.ok(adminEntry);
    assert.equal(adminEntry?.active, false);

    const removed = await service.deleteAdminSkillCatalogEntry(registration.tokens.access_token, 'custom-cloud-skill');
    assert.equal(removed.removed, true);
    const afterDelete = await service.listAdminSkillCatalog(registration.tokens.access_token);
    assert.equal(afterDelete.items.some((item) => item.slug === 'custom-cloud-skill'), false);
  });
});

test('skill catalog supports server-side tag keyword filtering', async () => {
  const store = new InMemoryControlPlaneStore();
  const service = new ControlPlaneService(store);

  const financePage = await service.listSkillCatalog(undefined, 200, 0, null, {
    tagKeywords: ['文档'],
    extraSkillSlugs: ['docx'],
  });
  assert.ok(financePage.total > 0);
  assert.ok(
    financePage.items.every((item) =>
      item.tags.some((tag) => {
        const normalized = tag.trim().toLowerCase();
        return normalized.includes('文档');
      }),
    ),
  );
  assert.ok(financePage.items.some((item) => item.slug === 'docx'));

  const slugFilteredPage = await service.listSkillCatalog(undefined, 200, 0, ['docx', 'xlsx', 'a-share-esg'], {
    tagKeywords: ['A股'],
  });
  assert.deepEqual(
    slugFilteredPage.items.map((item) => item.slug),
    ['a-share-esg'],
  );
});
