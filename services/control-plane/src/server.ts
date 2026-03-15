import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import { downloadAvatar } from './avatar-storage.ts';
import {CachedControlPlaneStore} from './cached-store.ts';
import {config} from './config.ts';
import type {
  ChangePasswordInput,
  InstallSkillInput,
  LoginInput,
  RegisterInput,
  RunAuthorizeInput,
  UpsertSkillCatalogEntryInput,
  UpdateSkillLibraryItemInput,
  UpdateProfileInput,
  UsageEventInput,
  WorkspaceBackupInput,
} from './domain.ts';
import {HttpError} from './errors.ts';
import {createJsonServer, createRawResponse, type HandlerContext} from './http.ts';
import {PgControlPlaneStore} from './pg-store.ts';
import {createRedisKeyValueCache} from './redis-cache.ts';
import {ControlPlaneService} from './service.ts';
import type {ControlPlaneStore} from './store.ts';

if (!config.databaseUrl) {
  throw new Error('[control-plane] DATABASE_URL is required; in-memory storage has been removed');
}

let store: ControlPlaneStore = new PgControlPlaneStore(config.databaseUrl);
let cacheLabel = 'none';

if (config.redisUrl) {
  try {
    const cache = await createRedisKeyValueCache(config.redisUrl, config.redisKeyPrefix);
    store = new CachedControlPlaneStore(store, cache);
    cacheLabel = cache.label;
  } catch (error) {
    console.warn('[control-plane] redis unavailable, continuing without cache', error);
  }
}

const service = new ControlPlaneService(store);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const skillsSourceRoot = resolve(process.env.ICLAW_SKILLS_SOURCE_DIR || resolve(repoRoot, 'skills'));

function requireBearerToken(headers: Record<string, string | string[] | undefined>): string {
  const authHeader = headers.authorization;
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!value || !value.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'missing bearer token');
  }
  return value.slice('Bearer '.length).trim();
}

function resolvePublicBaseUrl(headers: Record<string, string | string[] | undefined>): string {
  if (config.apiUrl.trim()) {
    return config.apiUrl.trim().replace(/\/$/, '');
  }

  const hostHeader = headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = headers['x-forwarded-proto'];
  const protoValue = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const protocol = (protoValue || 'http').trim() || 'http';
  return `${protocol}://${host || `127.0.0.1:${config.port}`}`;
}

function resolveSkillSourceDir(relativePath: string): string {
  const normalized = relativePath.trim();
  if (!normalized || normalized.includes('..')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid skill artifact path');
  }

  const target = resolve(skillsSourceRoot, normalized);
  if (target !== skillsSourceRoot && !target.startsWith(`${skillsSourceRoot}${sep}`)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid skill artifact path');
  }
  if (!existsSync(target)) {
    throw new HttpError(404, 'NOT_FOUND', 'skill artifact source not found');
  }
  if (!existsSync(resolve(target, 'SKILL.md'))) {
    throw new HttpError(404, 'NOT_FOUND', 'skill artifact source is incomplete');
  }
  return target;
}

function packageSkillArtifact(sourcePath: string): Buffer {
  const relative = sourcePath.trim();
  try {
    return execFileSync('tar', ['-czf', '-', '-C', skillsSourceRoot, relative], {
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    }) as Buffer;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'failed to package skill artifact';
    throw new HttpError(500, 'INTERNAL_ERROR', detail);
  }
}

const server = createJsonServer([
  {
    method: 'GET',
    path: '/health',
    handler: () => ({
      status: 'ok',
      service: config.serviceName,
      version: '0.1.0',
      storage: store.storageLabel,
      cache: cacheLabel,
    }),
  },
  {
    method: 'GET',
    path: '/auth/avatar',
    handler: async ({url}: HandlerContext) => {
      const key = (url.searchParams.get('key') || '').trim();
      if (!key) {
        throw new HttpError(400, 'BAD_REQUEST', 'avatar key is required');
      }
      const avatar = await downloadAvatar(key);
      return createRawResponse(avatar.buffer, {
        headers: {
          'Content-Type': avatar.contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    },
  },
  {
    method: 'POST',
    path: '/auth/register',
    handler: ({body}: HandlerContext) => service.register((body || {}) as RegisterInput),
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: ({body}: HandlerContext) => service.login((body || {}) as LoginInput),
  },
  {
    method: 'POST',
    path: '/auth/wechat',
    handler: ({body}: HandlerContext) => {
      const data = (body || {}) as {code?: string};
      return service.oauthLogin('wechat', data.code || '');
    },
  },
  {
    method: 'POST',
    path: '/auth/google',
    handler: ({body}: HandlerContext) => {
      const data = (body || {}) as {code?: string};
      return service.oauthLogin('google', data.code || '');
    },
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    handler: ({body}: HandlerContext) => {
      const data = (body || {}) as {refresh_token?: string};
      return service.refresh(data.refresh_token || '');
    },
  },
  {
    method: 'GET',
    path: '/auth/me',
    handler: ({headers}: HandlerContext) => service.me(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/auth/profile',
    handler: ({headers, body}: HandlerContext) =>
      service.updateProfile(requireBearerToken(headers), (body || {}) as UpdateProfileInput),
  },
  {
    method: 'POST',
    path: '/auth/change-password',
    handler: ({headers, body}: HandlerContext) =>
      service.changePassword(requireBearerToken(headers), (body || {}) as ChangePasswordInput),
  },
  {
    method: 'GET',
    path: '/auth/linked-accounts',
    handler: ({headers}: HandlerContext) => service.linkedAccounts(requireBearerToken(headers)),
  },
  {
    method: 'DELETE',
    path: '/auth/link/wechat',
    handler: ({headers}: HandlerContext) => service.unlinkOAuthAccount(requireBearerToken(headers), 'wechat'),
  },
  {
    method: 'DELETE',
    path: '/auth/link/google',
    handler: ({headers}: HandlerContext) => service.unlinkOAuthAccount(requireBearerToken(headers), 'google'),
  },
  {
    method: 'GET',
    path: '/credits/me',
    handler: ({headers}: HandlerContext) => service.creditsMe(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/credits/ledger',
    handler: ({headers}: HandlerContext) => service.creditsLedger(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/workspace/backup',
    handler: ({headers}: HandlerContext) => service.getWorkspaceBackup(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/workspace/backup',
    handler: ({headers, body}: HandlerContext) =>
      service.saveWorkspaceBackup(requireBearerToken(headers), (body || {}) as WorkspaceBackupInput),
  },
  {
    method: 'GET',
    path: '/skills/catalog',
    handler: ({headers}: HandlerContext) => service.listSkillCatalog(resolvePublicBaseUrl(headers)),
  },
  {
    method: 'GET',
    path: '/admin/skills/catalog',
    handler: ({headers}: HandlerContext) =>
      service.listAdminSkillCatalog(requireBearerToken(headers), resolvePublicBaseUrl(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/skills/catalog',
    handler: ({headers, body}: HandlerContext) =>
      service.upsertAdminSkillCatalogEntry(
        requireBearerToken(headers),
        (body || {}) as UpsertSkillCatalogEntryInput,
        resolvePublicBaseUrl(headers),
      ),
  },
  {
    method: 'DELETE',
    path: '/admin/skills/catalog',
    handler: ({headers, url}: HandlerContext) =>
      service.deleteAdminSkillCatalogEntry(
        requireBearerToken(headers),
        (url.searchParams.get('slug') || '').trim(),
      ),
  },
  {
    method: 'GET',
    path: '/skills/library',
    handler: ({headers}: HandlerContext) => service.listUserSkillLibrary(requireBearerToken(headers)),
  },
  {
    method: 'POST',
    path: '/skills/library/install',
    handler: ({headers, body}: HandlerContext) =>
      service.installSkill(requireBearerToken(headers), (body || {}) as InstallSkillInput),
  },
  {
    method: 'PUT',
    path: '/skills/library/state',
    handler: ({headers, body}: HandlerContext) =>
      service.updateSkillLibraryItem(requireBearerToken(headers), (body || {}) as UpdateSkillLibraryItemInput),
  },
  {
    method: 'POST',
    path: '/skills/library/uninstall',
    handler: ({headers, body}: HandlerContext) => {
      const data = (body || {}) as {slug?: string};
      return service.removeSkill(requireBearerToken(headers), data.slug || '');
    },
  },
  {
    method: 'GET',
    path: '/skills/artifact',
    handler: async ({url}: HandlerContext) => {
      const slug = (url.searchParams.get('slug') || '').trim();
      const version = (url.searchParams.get('version') || '').trim() || undefined;
      const release = await service.getSkillArtifactRelease(slug, version);
      const sourcePath = release.artifactSourcePath;
      if (!sourcePath) {
        throw new HttpError(404, 'NOT_FOUND', 'skill artifact source not configured');
      }

      resolveSkillSourceDir(sourcePath);
      const archive = packageSkillArtifact(sourcePath);
      return createRawResponse(archive, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': String(archive.length),
          'Cache-Control': 'public, max-age=300',
          'Content-Disposition': `attachment; filename="${release.slug}-${release.version}.tar.gz"`,
        },
      });
    },
  },
  {
    method: 'POST',
    path: '/agent/run/authorize',
    handler: ({headers, body}: HandlerContext) =>
      service.authorizeRun(requireBearerToken(headers), (body || {}) as RunAuthorizeInput),
  },
  {
    method: 'POST',
    path: '/usage/events',
    handler: ({headers, body}: HandlerContext) =>
      service.recordUsageEvent(requireBearerToken(headers), (body || {}) as UsageEventInput),
  },
], {
  allowedOrigins: config.allowedOrigins,
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`[control-plane] listening on http://127.0.0.1:${config.port}`);
});
