import test from 'node:test';
import assert from 'node:assert/strict';

import {config} from './config.ts';
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
