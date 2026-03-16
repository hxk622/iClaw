import type { IncomingHttpHeaders } from 'node:http';

import { config } from './config.ts';
import {
  DESKTOP_UPDATE_RESPONSE_HEADERS,
  resolveDesktopUpdateHint,
  type DesktopUpdateRequest,
} from './desktop-updates.ts';

function readHeader(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] || '').trim() : typeof value === 'string' ? value.trim() : '';
}

export function desktopUpdateAllowedRequestHeaders(): string[] {
  return [
    'Content-Type',
    'Authorization',
    'x-iclaw-app-version',
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
): Promise<Record<string, string>> {
  const requestedChannel = readHeader(headers, 'x-iclaw-channel') || config.desktopReleaseChannel;
  const request: DesktopUpdateRequest = {
    appVersion: readHeader(headers, 'x-iclaw-app-version') || null,
    platform: readHeader(headers, 'x-iclaw-platform') || null,
    arch: readHeader(headers, 'x-iclaw-arch') || null,
    channel: requestedChannel,
  };
  const hint = await resolveDesktopUpdateHint(
    {
      channel: requestedChannel,
      manifestDir: config.desktopReleaseManifestDir,
      publicBaseUrl:
        requestedChannel === 'dev'
          ? config.desktopReleaseManifestBaseUrls.dev
          : config.desktopReleaseManifestBaseUrls.prod,
      cacheTtlMs: config.desktopReleaseManifestCacheTtlMs,
      mandatory: config.desktopUpdateMandatory,
    },
    request,
  );
  if (!hint) return {};

  const responseHeaders: Record<string, string> = {
    'x-iclaw-latest-version': hint.latestVersion,
    'x-iclaw-update-available': hint.updateAvailable ? 'true' : 'false',
    'x-iclaw-update-mandatory': hint.mandatory ? 'true' : 'false',
  };
  if (hint.manifestUrl) {
    responseHeaders['x-iclaw-update-manifest-url'] = hint.manifestUrl;
  }
  if (hint.artifactUrl) {
    responseHeaders['x-iclaw-update-artifact-url'] = hint.artifactUrl;
  }
  return responseHeaders;
}
