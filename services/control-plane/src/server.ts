import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import { downloadAvatar } from './avatar-storage.ts';
import {downloadPrivateSkillArtifact} from './skill-storage.ts';
import {ensureBootstrapAdmin, ensureDefaultCatalogs, ensureDefaultSkillSyncSources, ensurePortalPreset} from './bootstrap.ts';
import {CachedControlPlaneStore} from './cached-store.ts';
import {config} from './config.ts';
import type {
  ChangePasswordInput,
  CreatePaymentOrderInput,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallMcpInput,
  InstallSkillInput,
  LoginInput,
  PaymentWebhookInput,
  RegisterInput,
  RunAuthorizeInput,
  UpsertAgentCatalogEntryInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UpdateMcpLibraryItemInput,
  UpdateSkillLibraryItemInput,
  UpdateProfileInput,
  UsageEventInput,
  WorkspaceBackupInput,
} from './domain.ts';
import {HttpError} from './errors.ts';
import {createJsonServer, createRawResponse, type HandlerContext} from './http.ts';
import {PgOemStore} from './oem-store.ts';
import {OemService} from './oem-service.ts';
import type {UpsertPortalAppInput, UpsertPortalModelInput, UpsertPortalMcpInput, UpsertPortalSkillInput} from './portal-domain.ts';
import {PgPortalStore} from './portal-store.ts';
import {PortalService} from './portal-service.ts';
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
const portalStore = new PgPortalStore(config.databaseUrl);

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
await ensureDefaultCatalogs(store);
await ensureDefaultSkillSyncSources(store);
await ensurePortalPreset(portalStore);

const service = new ControlPlaneService(store);
const oemService = new OemService(oemStore, async (accessToken) => service.me(accessToken), {
  controlStore: store,
});
const portalService = new PortalService(portalStore, async (accessToken) => service.me(accessToken));
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

function resolveRequestedAppName(
  headers: Record<string, string | string[] | undefined>,
  url?: URL,
): string | null {
  const headerValue = headers['x-iclaw-app-name'];
  const fromHeader = (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim().toLowerCase();
  if (fromHeader) {
    return fromHeader;
  }
  const fromQuery = (url?.searchParams.get('app_name') || '').trim().toLowerCase();
  return fromQuery || null;
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
    appName: (url.searchParams.get('app_name') || '').trim() || null,
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

async function packageGithubSkillArtifact(metadata: Record<string, unknown>): Promise<Buffer> {
  const github =
    metadata.github && typeof metadata.github === 'object' && !Array.isArray(metadata.github)
      ? (metadata.github as Record<string, unknown>)
      : null;
  if (!github || typeof github !== 'object' || Array.isArray(github)) {
    throw new HttpError(404, 'NOT_FOUND', 'github artifact metadata not found');
  }
  const owner = typeof github.owner === 'string' ? github.owner : '';
  const repo = typeof github.repo === 'string' ? github.repo : '';
  const skillPathRaw = typeof github.skill_path === 'string' ? github.skill_path : '.';
  const archiveUrl = typeof github.archive_url === 'string' ? github.archive_url : '';
  if (!owner || !repo || !archiveUrl) {
    throw new HttpError(404, 'NOT_FOUND', 'github artifact metadata is incomplete');
  }

  const tempRoot = await mkdtemp(resolve(tmpdir(), 'iclaw-skill-'));
  try {
    const archivePath = resolve(tempRoot, 'repo.tar.gz');
    const extractDir = resolve(tempRoot, 'extract');
    await mkdir(extractDir, {recursive: true});
    const response = await fetch(archiveUrl, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'iClaw-control-plane-skill-artifact/0.1',
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpError(502, 'BAD_GATEWAY', `failed to fetch github archive: ${response.status} ${text}`);
    }
    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });

    const extractedEntries = await readdir(extractDir, {withFileTypes: true});
    const rootDir = extractedEntries.find((entry) => entry.isDirectory())?.name || '';
    const repoRoot = rootDir ? resolve(extractDir, rootDir) : extractDir;
    const normalizedSkillPath = skillPathRaw === '.' ? '' : skillPathRaw.replace(/^\/+|\/+$/g, '');
    const skillRoot = normalizedSkillPath ? resolve(repoRoot, normalizedSkillPath) : repoRoot;
    if (!existsSync(resolve(skillRoot, 'SKILL.md'))) {
      throw new HttpError(404, 'NOT_FOUND', 'github skill artifact source is incomplete');
    }
    return execFileSync('tar', ['-czf', '-', '-C', skillRoot, '.'], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    }) as Buffer;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const detail = error instanceof Error ? error.message : 'failed to package github skill artifact';
    throw new HttpError(500, 'INTERNAL_ERROR', detail);
  } finally {
    await rm(tempRoot, {recursive: true, force: true}).catch(() => undefined);
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
    handler: async ({url, headers}: HandlerContext) => {
      const request = resolveDesktopUpdateRequest(url);
      if (!request.appVersion) {
        throw new HttpError(400, 'BAD_REQUEST', 'current_version is required');
      }
      const hint = await resolveDesktopUpdateHintPayload(request, portalStore, resolvePublicBaseUrl(headers));
      return hint || {
        latestVersion: request.appVersion,
        updateAvailable: false,
        mandatory: false,
        enforcementState: 'recommended',
        blockNewRuns: false,
        reasonCode: null,
        reasonMessage: null,
        manifestUrl: null,
        artifactUrl: null,
      };
    },
  },
  {
    method: 'GET',
    path: '/desktop/update',
    handler: async ({url, headers}: HandlerContext) => {
      const request = resolveDesktopUpdateRequest(url);
      if (!request.appVersion) {
        throw new HttpError(400, 'BAD_REQUEST', 'current_version is required');
      }
      const payload = await resolveDesktopUpdaterRoutePayload(request, portalStore, resolvePublicBaseUrl(headers));
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
          enforcement_state: payload.enforcementState,
          block_new_runs: payload.blockNewRuns,
          reason_code: payload.reasonCode,
          reason_message: payload.reasonMessage,
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
    method: 'POST',
    path: '/payments/orders',
    handler: ({headers, body}: HandlerContext) =>
      service.createPaymentOrder(requireBearerToken(headers), (body || {}) as CreatePaymentOrderInput),
  },
  {
    method: 'GET',
    path: '/payments/orders/:orderId',
    handler: ({headers, params}: HandlerContext) =>
      service.getPaymentOrder(requireBearerToken(headers), params.orderId || ''),
  },
  {
    method: 'POST',
    path: '/payments/webhooks/:provider',
    handler: ({params, body}: HandlerContext) =>
      service.applyPaymentWebhook(params.provider || '', (body || {}) as PaymentWebhookInput),
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
    handler: ({headers, url}: HandlerContext) =>
      service.listSkillCatalog(
        resolvePublicBaseUrl(headers),
        Number.parseInt(url.searchParams.get('limit') || '', 10),
        Number.parseInt(url.searchParams.get('offset') || '', 10),
      ),
  },
  {
    method: 'GET',
    path: '/mcp/catalog',
    handler: async ({headers, url}: HandlerContext) => {
      const appName = resolveRequestedAppName(headers, url);
      const detail = appName ? await portalStore.getAppDetail(appName).catch(() => null) : null;
      const defaultInstalledKeys = new Set(
        (detail?.mcpBindings || [])
          .filter((item) => item.enabled)
          .map((item) => item.mcpKey),
      );
      return service.listMcpCatalog(
        defaultInstalledKeys,
        Number.parseInt(url.searchParams.get('limit') || '', 10),
        Number.parseInt(url.searchParams.get('offset') || '', 10),
      );
    },
  },
  {
    method: 'GET',
    path: '/skills/catalog/personal',
    handler: ({headers, url}: HandlerContext) =>
      service.listPersonalSkillCatalog(
        requireBearerToken(headers),
        resolvePublicBaseUrl(headers),
        Number.parseInt(url.searchParams.get('limit') || '', 10),
        Number.parseInt(url.searchParams.get('offset') || '', 10),
      ),
  },
  {
    method: 'DELETE',
    path: '/skills/catalog/personal',
    handler: ({headers, url}: HandlerContext) =>
      service.deletePrivateSkill(requireBearerToken(headers), (url.searchParams.get('slug') || '').trim()),
  },
  {
    method: 'GET',
    path: '/admin/agents/catalog',
    handler: ({headers}: HandlerContext) => service.listAdminAgentCatalog(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/agents/catalog',
    handler: ({headers, body}: HandlerContext) =>
      service.upsertAdminAgentCatalogEntry(
        requireBearerToken(headers),
        (body || {}) as UpsertAgentCatalogEntryInput,
      ),
  },
  {
    method: 'DELETE',
    path: '/admin/agents/catalog',
    handler: ({headers, url}: HandlerContext) =>
      service.deleteAdminAgentCatalogEntry(
        requireBearerToken(headers),
        (url.searchParams.get('slug') || '').trim(),
      ),
  },
  {
    method: 'GET',
    path: '/admin/skills/catalog',
    handler: ({headers, url}: HandlerContext) =>
      service.listAdminSkillCatalog(
        requireBearerToken(headers),
        resolvePublicBaseUrl(headers),
        Number.parseInt(url.searchParams.get('limit') || '', 10),
        Number.parseInt(url.searchParams.get('offset') || '', 10),
      ),
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
    path: '/admin/skills/sync/sources',
    handler: ({headers}: HandlerContext) => service.listSkillSyncSources(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/skills/sync/sources',
    handler: ({headers, body}: HandlerContext) =>
      service.upsertSkillSyncSource(requireBearerToken(headers), (body || {}) as UpsertSkillSyncSourceInput),
  },
  {
    method: 'DELETE',
    path: '/admin/skills/sync/sources',
    handler: ({headers, url}: HandlerContext) =>
      service.deleteSkillSyncSource(requireBearerToken(headers), (url.searchParams.get('id') || '').trim()),
  },
  {
    method: 'GET',
    path: '/admin/skills/sync/runs',
    handler: ({headers, url}: HandlerContext) =>
      service.listSkillSyncRuns(
        requireBearerToken(headers),
        url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      ),
  },
  {
    method: 'POST',
    path: '/admin/skills/sync/run',
    handler: ({headers, body}: HandlerContext) =>
      service.runSkillSync(
        requireBearerToken(headers),
        (((body || {}) as {source_id?: string}).source_id || '').trim(),
      ),
  },
  {
    method: 'GET',
    path: '/skills/library',
    handler: ({headers}: HandlerContext) => service.listUserSkillLibrary(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/mcp/library',
    handler: ({headers}: HandlerContext) => service.listUserMcpLibrary(requireBearerToken(headers)),
  },
  {
    method: 'POST',
    path: '/skills/library/install',
    handler: ({headers, body}: HandlerContext) =>
      service.installSkill(requireBearerToken(headers), (body || {}) as InstallSkillInput),
  },
  {
    method: 'POST',
    path: '/mcp/library/install',
    handler: ({headers, body}: HandlerContext) =>
      service.installMcp(requireBearerToken(headers), (body || {}) as InstallMcpInput),
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
    method: 'PUT',
    path: '/mcp/library/state',
    handler: ({headers, body}: HandlerContext) =>
      service.updateMcpLibraryItem(requireBearerToken(headers), (body || {}) as UpdateMcpLibraryItemInput),
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
    method: 'POST',
    path: '/mcp/library/uninstall',
    handler: ({headers, body}: HandlerContext) => {
      const data = (body || {}) as {mcp_key?: string};
      return service.removeMcp(requireBearerToken(headers), data.mcp_key || '');
    },
  },
  {
    method: 'GET',
    path: '/skills/artifact',
    handler: async ({url}: HandlerContext) => {
      const slug = (url.searchParams.get('slug') || '').trim();
      const version = (url.searchParams.get('version') || '').trim() || undefined;
      const entry = await service.getSkillArtifactEntry(slug, version);
      let archive: Buffer;
      if (entry.originType === 'bundled' && entry.artifactSourcePath) {
        resolveSkillSourceDir(entry.artifactSourcePath);
        archive = packageSkillArtifact(entry.artifactSourcePath);
      } else if (entry.originType === 'github_repo') {
        archive = await packageGithubSkillArtifact(entry.metadata);
      } else {
        throw new HttpError(404, 'NOT_FOUND', 'skill artifact source not configured');
      }
      return createRawResponse(archive, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': String(archive.length),
          'Cache-Control': 'public, max-age=300',
          'Content-Disposition': `attachment; filename="${entry.slug}-${entry.version}.tar.gz"`,
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
    handler: ({headers, url}: HandlerContext) =>
      oemService.listBrands(requireBearerToken(headers), {
        query: (url.searchParams.get('query') || '').trim() || null,
        status: (url.searchParams.get('status') || '').trim() || null,
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null,
      }),
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
    method: 'POST',
    path: '/admin/oem/asset/upload',
    handler: ({headers, body}: HandlerContext) =>
      oemService.uploadAssetFile(
        requireBearerToken(headers),
        (body || {}) as {
          brand_id?: string;
          asset_key?: string;
          kind?: string;
          content_type?: string;
          file_name?: string;
          file_base64?: string;
          metadata?: Record<string, unknown>;
        },
      ),
  },
  {
    method: 'DELETE',
    path: '/admin/oem/asset',
    handler: ({headers, url}: HandlerContext) =>
      oemService.deleteAsset(requireBearerToken(headers), {
        brand_id: (url.searchParams.get('brand_id') || '').trim(),
        asset_key: (url.searchParams.get('asset_key') || '').trim(),
      }),
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
    path: '/admin/mcp/catalog',
    handler: ({headers}: HandlerContext) => oemService.listMcpCatalog(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/mcp/catalog',
    handler: ({headers, body}: HandlerContext) =>
      oemService.upsertMcpCatalogEntry(
        requireBearerToken(headers),
        (body || {}) as {
          key?: string;
          enabled?: boolean;
          type?: string | null;
          command?: string | null;
          args?: string[];
          http_url?: string | null;
          env?: Record<string, string>;
        },
      ),
  },
  {
    method: 'DELETE',
    path: '/admin/mcp/catalog',
    handler: ({headers, url}: HandlerContext) =>
      oemService.deleteMcpCatalogEntry(requireBearerToken(headers), (url.searchParams.get('key') || '').trim()),
  },
  {
    method: 'POST',
    path: '/admin/mcp/test',
    handler: ({headers, body}: HandlerContext) =>
      oemService.testMcpCatalogEntry(
        requireBearerToken(headers),
        (body || {}) as {
          key?: string;
          command?: string | null;
          http_url?: string | null;
        },
      ),
  },
  {
    method: 'GET',
    path: '/admin/portal/apps',
    handler: ({headers}: HandlerContext) => portalService.listApps(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.upsertApp(requireBearerToken(headers), {
        ...((body || {}) as Record<string, unknown>),
        appName: params.appName || '',
      } as UpsertPortalAppInput),
  },
  {
    method: 'GET',
    path: '/admin/portal/apps/:appName',
    handler: ({headers, params}: HandlerContext) => portalService.getApp(requireBearerToken(headers), params.appName || ''),
  },
  {
    method: 'GET',
    path: '/admin/portal/catalog/skills',
    handler: ({headers}: HandlerContext) => portalService.listSkills(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/portal/catalog/skills/:slug',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.upsertSkill(requireBearerToken(headers), {
        ...((body || {}) as Record<string, unknown>),
        slug: params.slug || '',
      } as UpsertPortalSkillInput),
  },
  {
    method: 'DELETE',
    path: '/admin/portal/catalog/skills/:slug',
    handler: ({headers, params}: HandlerContext) =>
      portalService.deleteSkill(requireBearerToken(headers), params.slug || ''),
  },
  {
    method: 'GET',
    path: '/admin/portal/catalog/mcps',
    handler: ({headers}: HandlerContext) => portalService.listMcps(requireBearerToken(headers)),
  },
  {
    method: 'GET',
    path: '/admin/portal/catalog/models',
    handler: ({headers}: HandlerContext) => portalService.listModels(requireBearerToken(headers)),
  },
  {
    method: 'PUT',
    path: '/admin/portal/catalog/mcps/:mcpKey',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.upsertMcp(requireBearerToken(headers), {
        ...((body || {}) as Record<string, unknown>),
        mcpKey: params.mcpKey || '',
      } as UpsertPortalMcpInput),
  },
  {
    method: 'PUT',
    path: '/admin/portal/catalog/models',
    handler: ({headers, body}: HandlerContext) =>
      portalService.upsertModel(requireBearerToken(headers), (body || {}) as UpsertPortalModelInput),
  },
  {
    method: 'DELETE',
    path: '/admin/portal/catalog/models',
    handler: ({headers, url}: HandlerContext) =>
      portalService.deleteModel(requireBearerToken(headers), (url.searchParams.get('ref') || '').trim()),
  },
  {
    method: 'DELETE',
    path: '/admin/portal/catalog/mcps/:mcpKey',
    handler: ({headers, params}: HandlerContext) =>
      portalService.deleteMcp(requireBearerToken(headers), params.mcpKey || ''),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName/skills',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.replaceAppSkills(requireBearerToken(headers), params.appName || '', (body || []) as never),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName/mcps',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.replaceAppMcps(requireBearerToken(headers), params.appName || '', (body || []) as never),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName/models',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.replaceAppModels(requireBearerToken(headers), params.appName || '', (body || []) as never),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName/menus',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.replaceAppMenus(requireBearerToken(headers), params.appName || '', (body || []) as never),
  },
  {
    method: 'POST',
    path: '/admin/portal/apps/:appName/publish',
    handler: ({headers, params}: HandlerContext) =>
      portalService.publishApp(requireBearerToken(headers), params.appName || ''),
  },
  {
    method: 'POST',
    path: '/admin/portal/apps/:appName/restore',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.restoreApp(requireBearerToken(headers), params.appName || '', (body || {}) as {version?: number}),
  },
  {
    method: 'POST',
    path: '/admin/portal/apps/:appName/assets/:assetKey/upload',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.uploadAsset(requireBearerToken(headers), params.appName || '', params.assetKey || '', (body || {}) as {
        content_type?: string;
        file_name?: string;
        file_base64?: string;
        metadata?: Record<string, unknown>;
      }),
  },
  {
    method: 'DELETE',
    path: '/admin/portal/apps/:appName/assets/:assetKey',
    handler: ({headers, params}: HandlerContext) =>
      portalService.deleteAsset(requireBearerToken(headers), params.appName || '', params.assetKey || ''),
  },
  {
    method: 'PUT',
    path: '/admin/portal/apps/:appName/desktop-release/:channel/:platform/:arch/:artifactType',
    bodyType: 'raw',
    handler: ({headers, params, body}: HandlerContext<Buffer>) =>
      portalService.uploadDesktopReleaseArtifact(requireBearerToken(headers), params.appName || '', {
        channel: params.channel || '',
        platform: params.platform || '',
        arch: params.arch || '',
        artifactType: params.artifactType || '',
        fileName: Array.isArray(headers['x-iclaw-file-name']) ? headers['x-iclaw-file-name'][0] : headers['x-iclaw-file-name'],
        contentType: Array.isArray(headers['content-type']) ? headers['content-type'][0] : headers['content-type'],
        content: Buffer.isBuffer(body) ? body : Buffer.alloc(0),
      }),
  },
  {
    method: 'POST',
    path: '/admin/portal/apps/:appName/desktop-release/:channel/publish',
    handler: ({headers, params, body}: HandlerContext) =>
      portalService.publishDesktopRelease(requireBearerToken(headers), params.appName || '', {
        ...((body || {}) as Record<string, unknown>),
        channel: params.channel || '',
      }),
  },
  {
    method: 'GET',
    path: '/portal/public-config',
    handler: ({headers, url}: HandlerContext) =>
      portalService.getPublicAppConfig((url.searchParams.get('app_name') || '').trim(), resolvePublicBaseUrl(headers), {
        surfaceKey: (url.searchParams.get('surface_key') || '').trim() || null,
      }),
  },
  {
    method: 'GET',
    path: '/desktop/release-manifest',
    handler: async ({headers, url}: HandlerContext) => {
      const payload = await portalService.getDesktopReleaseManifest(
        (url.searchParams.get('app_name') || '').trim(),
        resolvePublicBaseUrl(headers),
        {
          channel: (url.searchParams.get('channel') || '').trim() || null,
          platform: (url.searchParams.get('target') || '').trim() || null,
          arch: (url.searchParams.get('arch') || '').trim() || null,
        },
      );
      return createRawResponse(JSON.stringify(payload), {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    },
  },
  {
    method: 'GET',
    path: '/desktop/release-file',
    handler: async ({url}: HandlerContext) => {
      const result = await portalService.getDesktopReleaseFile(
        (url.searchParams.get('app_name') || '').trim(),
        {
          channel: (url.searchParams.get('channel') || '').trim() || null,
          platform: (url.searchParams.get('target') || '').trim() || null,
          arch: (url.searchParams.get('arch') || '').trim() || null,
          artifactType: (url.searchParams.get('artifact_type') || '').trim() || null,
        },
      );
      return createRawResponse(result.file.buffer, {
        statusCode: 200,
        headers: {
          'Content-Type': result.file.contentType,
          'Content-Length': String(result.file.buffer.length),
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileMeta.fileName)}"`,
          'Cache-Control': 'no-store',
        },
      });
    },
  },
  {
    method: 'GET',
    path: '/portal/asset/file',
    handler: async ({url}: HandlerContext) => {
      const result = await portalService.getAssetFile(
        (url.searchParams.get('app_name') || '').trim(),
        (url.searchParams.get('asset_key') || '').trim(),
      );
      return createRawResponse(result.file.buffer, {
        headers: {
          'Content-Type': result.file.contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    },
  },
  {
    method: 'GET',
    path: '/oem/asset/file',
    handler: async ({url}: HandlerContext) => {
      const result = await oemService.getAssetFile(
        (url.searchParams.get('brand_id') || '').trim(),
        (url.searchParams.get('asset_key') || '').trim(),
      );
      return createRawResponse(result.file.buffer, {
        headers: {
          'Content-Type': result.file.contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    },
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
  resolveResponseHeaders: ({request}) =>
    resolveDesktopUpdateResponseHeaders(request.headers, portalStore, resolvePublicBaseUrl(request.headers)),
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`[control-plane] listening on http://127.0.0.1:${config.port}`);
});
