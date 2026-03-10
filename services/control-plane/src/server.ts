import { downloadAvatar } from './avatar-storage.ts';
import {CachedControlPlaneStore} from './cached-store.ts';
import {config} from './config.ts';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RunAuthorizeInput,
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

function requireBearerToken(headers: Record<string, string | string[] | undefined>): string {
  const authHeader = headers.authorization;
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!value || !value.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'missing bearer token');
  }
  return value.slice('Bearer '.length).trim();
}

const server = createJsonServer([
  {
    method: 'GET',
    path: '/health',
    handler: () => ({
      status: 'ok',
      service: 'iclaw-control-plane',
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
]);

server.listen(config.port, '127.0.0.1', () => {
  console.log(`[control-plane] listening on http://127.0.0.1:${config.port}`);
});
