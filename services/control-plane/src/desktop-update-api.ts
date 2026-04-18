import {HttpError} from './errors.ts';
import {createRawResponse, type ResponseHeaderResolverContext, type Route} from './http.ts';
import {
  resolveDesktopUpdateHintPayload,
  resolveDesktopUpdateResponseHeaders,
  resolveDesktopUpdaterRoutePayload,
} from './desktop-update-resolver.ts';

type PortalStoreLike = {
  getAppDetail(appName: string): Promise<{app: {appName: string; config: Record<string, unknown>}} | null>;
};

type ResolvePublicBaseUrl = (headers: Record<string, string | string[] | undefined>) => string;

type DesktopUpdateApiDeps = {
  portalStore: PortalStoreLike;
  resolvePublicBaseUrl: ResolvePublicBaseUrl;
};

export function resolveDesktopUpdateRequest(url: URL) {
  return {
    appName: (url.searchParams.get('app_name') || '').trim() || null,
    appVersion: (url.searchParams.get('current_version') || '').trim() || null,
    platform: (url.searchParams.get('target') || '').trim() || null,
    arch: (url.searchParams.get('arch') || '').trim() || null,
    channel: (url.searchParams.get('channel') || '').trim() || null,
  };
}

export function createDesktopUpdateApiRoutes({portalStore, resolvePublicBaseUrl}: DesktopUpdateApiDeps): Route[] {
  return [
    {
      method: 'GET',
      path: '/desktop/update-hint',
      handler: async ({url, headers}) => {
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
          rolloutId: null,
          reasonCode: null,
          reasonMessage: null,
          manifestUrl: null,
          artifactUrl: null,
          artifactSha256: null,
        };
      },
    },
    {
      method: 'GET',
      path: '/desktop/update',
      handler: async ({url, headers}) => {
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
            rollout_id: payload.rolloutId,
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
            external_download_sha256: payload.externalDownloadSha256,
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
  ];
}

export function createDesktopUpdateResponseHeadersResolver({portalStore, resolvePublicBaseUrl}: DesktopUpdateApiDeps) {
  return async ({request}: ResponseHeaderResolverContext): Promise<Record<string, string>> =>
    resolveDesktopUpdateResponseHeaders(request.headers, portalStore, resolvePublicBaseUrl(request.headers));
}
