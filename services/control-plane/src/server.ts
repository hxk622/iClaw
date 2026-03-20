import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import { downloadAvatar } from './avatar-storage.ts';
import {downloadPrivateSkillArtifact} from './skill-storage.ts';
import {ensureBootstrapAdmin, ensureSeedOemBrands} from './bootstrap.ts';
import {CachedControlPlaneStore} from './cached-store.ts';
import {config} from './config.ts';
import type {
  ChangePasswordInput,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
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
import {PgOemStore} from './oem-store.ts';
import {OemService} from './oem-service.ts';
import {ensureControlPlaneSchema, PgControlPlaneStore} from './pg-store.ts';
import {createRedisKeyValueCache} from './redis-cache.ts';
import {ControlPlaneService} from './service.ts';
import {
  desktopUpdateAllowedRequestHeaders,
  desktopUpdateExposedHeaders,
  resolveDesktopUpdateHintPayload,
  resolveDesktopUpdateResponseHeaders,
  resolveDesktopUpdaterRoutePayload,
} from './desktop-update-resolver.ts';
import type {ControlPlaneStore} from './store.ts';

if (!config.databaseUrl) {
  throw new Error('[control-plane] DATABASE_URL is required; in-memory storage has been removed');
}

await ensureControlPlaneSchema(config.databaseUrl);

let store: ControlPlaneStore = new PgControlPlaneStore(config.databaseUrl);
let cacheLabel = 'none';
const oemStore = new PgOemStore(config.databaseUrl);

if (config.redisUrl) {
  try {
    const cache = await createRedisKeyValueCache(config.redisUrl, config.redisKeyPrefix);
    store = new CachedControlPlaneStore(store, cache);
    cacheLabel = cache.label;
  } catch (error) {
    console.warn('[control-plane] redis unavailable, continuing without cache', error);
  }
}

await ensureBootstrapAdmin(store);
await ensureSeedOemBrands(oemStore);

const service = new ControlPlaneService(store);
const oemService = new OemService(oemStore, async (accessToken) => service.me(accessToken), {
  controlStore: store,
});
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

function resolveDesktopUpdateRequest(url: URL) {
  return {
    appVersion: (url.searchParams.get('current_version') || '').trim() || null,
    platform: (url.searchParams.get('target') || '').trim() || null,
    arch: (url.searchParams.get('arch') || '').trim() || null,
    channel: (url.searchParams.get('channel') || '').trim() || null,
  };
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
    path: '/desktop/update-hint',
    handler: async ({url}: HandlerContext) => {
      const request = resolveDesktopUpdateRequest(url);
      if (!request.appVersion) {
        throw new HttpError(400, 'BAD_REQUEST', 'current_version is required');
      }
      const hint = await resolveDesktopUpdateHintPayload(request);
      return hint || {
        latestVersion: request.appVersion,
        updateAvailable: false,
        mandatory: false,
        manifestUrl: null,
        artifactUrl: null,
      };
    },
  },
  {
    method: 'GET',
    path: '/desktop/update',
    handler: async ({url}: HandlerContext) => {
      const request = resolveDesktopUpdateRequest(url);
      if (!request.appVersion) {
        throw new HttpError(400, 'BAD_REQUEST', 'current_version is required');
      }
      const payload = await resolveDesktopUpdaterRoutePayload(request);
      if (!payload) {
        return createRawResponse('', {
          statusCode: 204,
          headers: {
            'Cache-Control': 'no-store',
          },
        });
      }
      return createRawResponse(
        JSON.stringify({
          version: payload.version,
          url: payload.url,
          signature: payload.signature,
          notes: payload.notes,
          pub_date: payload.pubDate,
          mandatory: payload.mandatory,
          external_download_url: payload.externalDownloadUrl,
        }),
        {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        },
      );
    },
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
    method: 'POST',
    path: '/credits/quote',
    handler: ({headers, body}: HandlerContext) =>
      service.creditsQuote(requireBearerToken(headers), (body || {}) as {
        message?: string;
        model?: string;
        history_messages?: number;
        has_search?: boolean;
        has_tools?: boolean;
        attachments?: Array<{type?: string; chars?: number}>;
      }),
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
    path: '/agents/catalog',
    handler: () => service.listAgentCatalog(),
  },
  {
    method: 'GET',
    path: '/agents/library',
    handler: ({headers}: HandlerContext) => service.listUserAgentLibrary(requireBearerToken(headers)),
  },
  {
    method: 'POST',
    path: '/agents/library/install',
    handler: ({headers, body}: HandlerContext) =>
      service.installAgent(requireBearerToken(headers), (body || {}) as InstallAgentInput),
  },
  {
    method: 'POST',
    path: '/agents/library/uninstall',
    handler: ({headers, body}: HandlerContext) =>
      service.removeAgentFromLibrary(requireBearerToken(headers), ((body || {}) as {slug?: string}).slug || ''),
  },
  {
    method: 'GET',
    path: '/skills/catalog',
    handler: ({headers}: HandlerContext) => service.listSkillCatalog(resolvePublicBaseUrl(headers)),
  },
  {
    method: 'GET',
    path: '/skills/catalog/personal',
    handler: ({headers}: HandlerContext) =>
      service.listPersonalSkillCatalog(requireBearerToken(headers), resolvePublicBaseUrl(headers)),
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
    method: 'POST',
    path: '/skills/library/import',
    handler: ({headers, body}: HandlerContext) =>
      service.importPrivateSkill(
        requireBearerToken(headers),
        (body || {}) as ImportUserPrivateSkillInput,
        resolvePublicBaseUrl(headers),
      ),
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
    method: 'GET',
    path: '/skills/private-artifact',
    handler: async ({headers, url}: HandlerContext) => {
      const slug = (url.searchParams.get('slug') || '').trim();
      const version = (url.searchParams.get('version') || '').trim() || undefined;
      const skill = await service.getPrivateSkillArtifactRecord(requireBearerToken(headers), slug, version);
      const artifact = await downloadPrivateSkillArtifact(skill.artifactKey);
      const ext = skill.artifactFormat === 'zip' ? 'zip' : 'tar.gz';
      return createRawResponse(artifact.buffer, {
        headers: {
          'Content-Type': artifact.contentType,
          'Content-Length': String(artifact.buffer.length),
          'Cache-Control': 'private, max-age=300',
          'Content-Disposition': `attachment; filename="${skill.slug}-${skill.version}.${ext}"`,
        },
      });
    },
  },
  {
    method: 'GET',
    path: '/admin/oem/dashboard',
    handler: ({headers}: HandlerContext) => oemService.getDashboard(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/admin/oem/brands',
    handler: ({headers}: HandlerContext) => oemService.listBrands(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/admin/oem/brand',
    handler: ({headers, url}: HandlerContext) =>
      oemService.getBrand(requireBearerToken(headers), (url.searchParams.get('brand_id') || '').trim()),
  },
  {
    method: 'PUT',
    path: '/admin/oem/brand',
    handler: ({headers, body}: HandlerContext) =>
      oemService.saveBrandDraft(
        requireBearerToken(headers),
        (body || {}) as {
          brand_id?: string;
          tenant_key?: string;
          display_name?: string;
          product_name?: string;
          status?: 'draft' | 'published' | 'archived';
          draft_config?: Record<string, unknown>;
        },
      ),
  },
  {
    method: 'POST',
    path: '/admin/oem/brand/publish',
    handler: ({headers, body}: HandlerContext) =>
      oemService.publishBrand(requireBearerToken(headers), (body || {}) as {brand_id?: string}),
  },
  {
    method: 'POST',
    path: '/admin/oem/brand/rollback',
    handler: ({headers, body}: HandlerContext) =>
      oemService.restoreBrandVersion(
        requireBearerToken(headers),
        (body || {}) as {brand_id?: string; version?: number},
      ),
  },
  {
    method: 'GET',
    path: '/admin/oem/releases',
    handler: ({headers, url}: HandlerContext) =>
      oemService.listReleases(requireBearerToken(headers), {
        brand_id: (url.searchParams.get('brand_id') || '').trim() || null,
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null,
      }),
  },
  {
    method: 'GET',
    path: '/admin/oem/assets',
    handler: ({headers, url}: HandlerContext) =>
      oemService.listAssets(requireBearerToken(headers), {
        brand_id: (url.searchParams.get('brand_id') || '').trim() || null,
        kind: (url.searchParams.get('kind') || '').trim() || null,
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null,
      }),
  },
  {
    method: 'PUT',
    path: '/admin/oem/asset',
    handler: ({headers, body}: HandlerContext) =>
      oemService.upsertAsset(
        requireBearerToken(headers),
        (body || {}) as {
          brand_id?: string;
          asset_key?: string;
          kind?: string;
          storage_provider?: string;
          object_key?: string;
          public_url?: string | null;
          metadata?: Record<string, unknown>;
        },
      ),
  },
  {
    method: 'GET',
    path: '/admin/oem/audit',
    handler: ({headers, url}: HandlerContext) =>
      oemService.listAudit(requireBearerToken(headers), {
        brand_id: (url.searchParams.get('brand_id') || '').trim() || null,
        action: (url.searchParams.get('action') || '').trim() || null,
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null,
      }),
  },
  {
    method: 'GET',
    path: '/admin/oem/capabilities',
    handler: ({headers}: HandlerContext) => oemService.getCapabilities(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/oem/public-config',
    handler: ({url}: HandlerContext) =>
      oemService.getPublicBrandConfig(
        (url.searchParams.get('brand_id') || '').trim(),
        (url.searchParams.get('surface_key') || '').trim(),
      ),
  },
  {
    method: 'POST',
    path: '/agent/run/authorize',
    handler: ({headers, body}: HandlerContext) =>
      service.authorizeRun(requireBearerToken(headers), (body || {}) as RunAuthorizeInput),
  },
  {
    method: 'GET',
    path: '/agent/run/billing',
    handler: ({headers, url}: HandlerContext) =>
      service.getRunBillingSummary(requireBearerToken(headers), (url.searchParams.get('grant_id') || '').trim()),
  },
  {
    method: 'POST',
    path: '/usage/events',
    handler: ({headers, body}: HandlerContext) =>
      service.recordUsageEvent(requireBearerToken(headers), (body || {}) as UsageEventInput),
  },
], {
  allowedOrigins: config.allowedOrigins,
  allowedHeaders: desktopUpdateAllowedRequestHeaders(),
  exposedHeaders: ['x-request-id', ...desktopUpdateExposedHeaders()],
  resolveResponseHeaders: ({request}) => resolveDesktopUpdateResponseHeaders(request.headers),
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`[control-plane] listening on http://127.0.0.1:${config.port}`);
});
