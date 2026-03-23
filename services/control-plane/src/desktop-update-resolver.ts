import type { IncomingHttpHeaders } from 'node:http';

import { config } from './config.ts';
import {
  DESKTOP_UPDATE_RESPONSE_HEADERS,
  resolveDesktopUpdaterPayload,
  resolveDesktopUpdateHint,
  type DesktopUpdaterPayload,
  type DesktopUpdateRequest,
  type DesktopUpdateHint,
} from './desktop-updates.ts';
import {type PgPortalStore} from './portal-store.ts';
import {
  resolvePortalDesktopReleaseHint,
  resolvePortalDesktopUpdaterPayload,
} from './portal-desktop-release.ts';

function readHeader(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] || '').trim() : typeof value === 'string' ? value.trim() : '';
}

export function desktopUpdateAllowedRequestHeaders(): string[] {
  return [
    'Content-Type',
    'Authorization',
    'x-iclaw-file-name',
    'x-iclaw-app-version',
    'x-iclaw-app-name',
    'x-iclaw-platform',
    'x-iclaw-arch',
    'x-iclaw-channel',
  ];
}

export function desktopUpdateExposedHeaders(): string[] {
  return [...DESKTOP_UPDATE_RESPONSE_HEADERS];
}

export async function resolveDesktopUpdateResponseHeaders(
  headers: IncomingHttpHeaders,
  portalStore: PgPortalStore,
  publicBaseUrl: string | null = null,
): Promise<Record<string, string>> {
  const requestedChannel = readHeader(headers, 'x-iclaw-channel') || config.desktopReleaseChannel;
  const request: DesktopUpdateRequest = {
    appName: readHeader(headers, 'x-iclaw-app-name') || null,
    appVersion: readHeader(headers, 'x-iclaw-app-version') || null,
    platform: readHeader(headers, 'x-iclaw-platform') || null,
    arch: readHeader(headers, 'x-iclaw-arch') || null,
    channel: requestedChannel,
  };
  const hint = await resolveDesktopUpdateHintPayload(request, portalStore, publicBaseUrl);
  if (!hint) return {};

  const responseHeaders: Record<string, string> = {
    'x-iclaw-app-name': request.appName || '',
    'x-iclaw-latest-version': hint.latestVersion,
    'x-iclaw-update-available': hint.updateAvailable ? 'true' : 'false',
    'x-iclaw-update-mandatory': hint.mandatory ? 'true' : 'false',
    'x-iclaw-update-enforcement-state': hint.enforcementState || 'recommended',
    'x-iclaw-update-block-new-runs': hint.blockNewRuns ? 'true' : 'false',
  };
  if (hint.reasonCode) {
    responseHeaders['x-iclaw-update-reason-code'] = hint.reasonCode;
  }
  if (hint.reasonMessage) {
    responseHeaders['x-iclaw-update-reason-message'] = hint.reasonMessage;
  }
  if (hint.manifestUrl) {
    responseHeaders['x-iclaw-update-manifest-url'] = hint.manifestUrl;
  }
  if (hint.artifactUrl) {
    responseHeaders['x-iclaw-update-artifact-url'] = hint.artifactUrl;
  }
  return responseHeaders;
}

export function buildDesktopUpdateSource(channel: string) {
  return {
    channel,
    manifestDir: config.desktopReleaseManifestDir,
    publicBaseUrl:
      channel === 'dev' ? config.desktopReleaseManifestBaseUrls.dev : config.desktopReleaseManifestBaseUrls.prod,
    cacheTtlMs: config.desktopReleaseManifestCacheTtlMs,
    mandatory: config.desktopUpdateMandatory,
    forceUpdateBelowVersion: config.desktopForceUpdateBelowVersion,
  };
}

export async function resolveDesktopUpdateHintPayload(
  request: DesktopUpdateRequest,
  portalStore: PgPortalStore,
  publicBaseUrl: string | null = null,
): Promise<DesktopUpdateHint | null> {
  const requestedChannel = request.channel || config.desktopReleaseChannel;
  const appName = readOptionalAppName(request.appName);
  if (appName) {
    const detail = await portalStore.getAppDetail(appName);
    if (detail) {
      const managed = resolvePortalDesktopReleaseHint({
        baseUrl: resolveDesktopPublicBaseUrl(publicBaseUrl),
        appName,
        config: detail.app.config,
        appVersion: request.appVersion || '',
        channel: requestedChannel,
        platform: request.platform,
        arch: request.arch,
      });
      if (managed) {
        return {
          appName,
          latestVersion: managed.latestVersion,
          updateAvailable: managed.updateAvailable,
          mandatory: managed.mandatory,
          enforcementState: managed.enforcementState,
          blockNewRuns: managed.blockNewRuns,
          reasonCode: managed.reasonCode,
          reasonMessage: managed.reasonMessage,
          manifestUrl: managed.manifestUrl,
          artifactUrl: managed.artifactUrl,
        };
      }
    }
  }
  return resolveDesktopUpdateHint(buildDesktopUpdateSource(requestedChannel), request);
}

export async function resolveDesktopUpdaterRoutePayload(
  request: DesktopUpdateRequest,
  portalStore: PgPortalStore,
  publicBaseUrl: string | null = null,
): Promise<DesktopUpdaterPayload | null> {
  const requestedChannel = request.channel || config.desktopReleaseChannel;
  const appName = readOptionalAppName(request.appName);
  if (appName) {
    const detail = await portalStore.getAppDetail(appName);
    if (detail) {
      const managed = resolvePortalDesktopUpdaterPayload({
        baseUrl: resolveDesktopPublicBaseUrl(publicBaseUrl),
        appName,
        config: detail.app.config,
        appVersion: request.appVersion || '',
        channel: requestedChannel,
        platform: request.platform,
        arch: request.arch,
      });
      if (managed) {
        return {
          version: managed.version,
          url: managed.url,
          signature: managed.signature,
          notes: managed.notes,
          pubDate: managed.pubDate,
          mandatory: managed.mandatory,
          enforcementState: managed.enforcementState,
          blockNewRuns: managed.blockNewRuns,
          reasonCode: managed.reasonCode,
          reasonMessage: managed.reasonMessage,
          externalDownloadUrl: managed.externalDownloadUrl,
        };
      }
    }
  }
  return resolveDesktopUpdaterPayload(buildDesktopUpdateSource(requestedChannel), request);
}

function readOptionalAppName(value?: string | null): string | null {
  const normalized = (value || '').trim().toLowerCase();
  return normalized || null;
}

function resolveDesktopPublicBaseUrl(value: string | null): string {
  const candidate = (value || '').trim();
  if (candidate) {
    return candidate.replace(/\/$/, '');
  }
  if (config.apiUrl.trim()) {
    return config.apiUrl.trim().replace(/\/$/, '');
  }
  return `http://127.0.0.1:${config.port}`;
}
