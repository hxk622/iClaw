import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  resolveDesktopUpdateHint,
  resolveDesktopUpdaterPayload,
} from './desktop-updates.ts';

async function withManifestDir<T>(
  files: Array<{ name: string; payload: Record<string, unknown> }>,
  run: (manifestDir: string) => Promise<T>,
): Promise<T> {
  const manifestDir = await mkdtemp(join(tmpdir(), 'iclaw-desktop-update-test-'));
  try {
    await Promise.all(
      files.map((file) =>
        writeFile(join(manifestDir, file.name), `${JSON.stringify(file.payload, null, 2)}\n`, 'utf8'),
      ),
    );
    return await run(manifestDir);
  } finally {
    await rm(manifestDir, { recursive: true, force: true });
  }
}

test('resolveDesktopUpdateHint reads target manifest and reports available update', async () => {
  await withManifestDir(
    [
      {
        name: 'latest-prod-darwin-aarch64.json',
        payload: {
          version: '1.0.2+202604041200',
          rollout_id: 'rollout-prod-20260404',
          entry: {
            platform: 'darwin',
            arch: 'aarch64',
            version: '1.0.2+202604041200',
            artifact_url: 'https://updates.example.com/iClaw.dmg',
            artifact_sha256: 'installer-sha',
            published_at: '2026-04-04T00:00:00.000Z',
            updater: {
              url: 'https://updates.example.com/iClaw.app.tar.gz',
              signature: 'signed-updater-payload',
              pub_date: '2026-04-04T00:00:00.000Z',
            },
          },
        },
      },
    ],
    async (manifestDir) => {
      const hint = await resolveDesktopUpdateHint(
        {
          channel: 'prod',
          manifestDir,
          publicBaseUrl: 'https://updates.example.com',
          cacheTtlMs: 0,
          mandatory: false,
        },
        {
          appVersion: '1.0.1+202604021919',
          channel: 'prod',
          platform: 'darwin',
          arch: 'aarch64',
        },
      );

      assert.ok(hint);
      assert.equal(hint.latestVersion, '1.0.2+202604041200');
      assert.equal(hint.rolloutId, 'rollout-prod-20260404');
      assert.equal(hint.updateAvailable, true);
      assert.equal(hint.mandatory, false);
      assert.equal(hint.manifestUrl, 'https://updates.example.com/latest-prod-darwin-aarch64.json');
      assert.equal(hint.artifactUrl, 'https://updates.example.com/iClaw.dmg');
      assert.equal(hint.artifactSha256, 'installer-sha');
    },
  );
});

test('resolveDesktopUpdaterPayload returns signed updater metadata and external installer link', async () => {
  await withManifestDir(
    [
      {
        name: 'latest-prod-darwin-aarch64.json',
        payload: {
          version: '1.0.2+202604041200',
          rollout_id: 'rollout-prod-20260404',
          entry: {
            platform: 'darwin',
            arch: 'aarch64',
            version: '1.0.2+202604041200',
            artifact_url: 'https://updates.example.com/iClaw.dmg',
            artifact_sha256: 'installer-sha',
            published_at: '2026-04-04T00:00:00.000Z',
            updater: {
              url: 'https://updates.example.com/iClaw.app.tar.gz',
              signature: 'signed-updater-payload',
              notes: 'Signed update available.',
              pub_date: '2026-04-04T00:00:00.000Z',
            },
          },
        },
      },
    ],
    async (manifestDir) => {
      const payload = await resolveDesktopUpdaterPayload(
        {
          channel: 'prod',
          manifestDir,
          publicBaseUrl: 'https://updates.example.com',
          cacheTtlMs: 0,
          mandatory: true,
          forceUpdateBelowVersion: '1.0.2',
        },
        {
          appVersion: '1.0.0+202604010001',
          channel: 'prod',
          platform: 'darwin',
          arch: 'aarch64',
        },
      );

      assert.ok(payload);
      assert.equal(payload.version, '1.0.2+202604041200');
      assert.equal(payload.rolloutId, 'rollout-prod-20260404');
      assert.equal(payload.url, 'https://updates.example.com/iClaw.app.tar.gz');
      assert.equal(payload.signature, 'signed-updater-payload');
      assert.equal(payload.notes, 'Signed update available.');
      assert.equal(payload.mandatory, true);
      assert.equal(payload.externalDownloadUrl, 'https://updates.example.com/iClaw.dmg');
      assert.equal(payload.externalDownloadSha256, 'installer-sha');
    },
  );
});

test('resolveDesktopUpdaterPayload returns null when updater signature is missing', async () => {
  await withManifestDir(
    [
      {
        name: 'latest-prod-darwin-aarch64.json',
        payload: {
          version: '1.0.2+202604041200',
          entry: {
            platform: 'darwin',
            arch: 'aarch64',
            version: '1.0.2+202604041200',
            artifact_url: 'https://updates.example.com/iClaw.dmg',
            artifact_sha256: 'installer-sha',
            published_at: '2026-04-04T00:00:00.000Z',
            updater: {
              url: 'https://updates.example.com/iClaw.app.tar.gz',
            },
          },
        },
      },
    ],
    async (manifestDir) => {
      const payload = await resolveDesktopUpdaterPayload(
        {
          channel: 'prod',
          manifestDir,
          publicBaseUrl: 'https://updates.example.com',
          cacheTtlMs: 0,
          mandatory: false,
        },
        {
          appVersion: '1.0.1+202604021919',
          channel: 'prod',
          platform: 'darwin',
          arch: 'aarch64',
        },
      );

      assert.equal(payload, null);
    },
  );
});
