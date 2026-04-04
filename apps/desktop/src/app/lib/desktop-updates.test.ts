import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDesktopUpdateVersion,
  normalizeDesktopUpdateEnforcementState,
  resolveDesktopUpdateArtifactUrl,
  resolveDesktopUpdateGateState,
} from './desktop-updates.ts';

test('formatDesktopUpdateVersion removes build metadata from display label', () => {
  assert.equal(formatDesktopUpdateVersion('1.0.1+202604021919'), '1.0.1');
  assert.equal(formatDesktopUpdateVersion('1.0.1'), '1.0.1');
});

test('normalizeDesktopUpdateEnforcementState respects explicit enforcement state before mandatory fallback', () => {
  assert.equal(
    normalizeDesktopUpdateEnforcementState({
      mandatory: false,
      enforcementState: 'required_now',
    }),
    'required_now',
  );
  assert.equal(
    normalizeDesktopUpdateEnforcementState({
      mandatory: true,
      enforcementState: undefined,
    }),
    'required_after_run',
  );
  assert.equal(
    normalizeDesktopUpdateEnforcementState({
      mandatory: false,
      enforcementState: undefined,
    }),
    'recommended',
  );
});

test('resolveDesktopUpdateGateState returns none when there is no update or version was skipped', () => {
  assert.equal(
    resolveDesktopUpdateGateState({
      hint: null,
      skippedVersion: null,
      currentRunBusy: false,
      readyToRestart: false,
    }),
    'none',
  );

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: {
        latestVersion: '1.0.2+202604041200',
        updateAvailable: true,
        mandatory: false,
        enforcementState: 'recommended',
      },
      skippedVersion: '1.0.2+202604041200',
      currentRunBusy: false,
      readyToRestart: false,
    }),
    'none',
  );
});

test('resolveDesktopUpdateGateState distinguishes recommended, waiting, blocked and restart-ready states', () => {
  const recommendedHint = {
    latestVersion: '1.0.2+202604041200',
    updateAvailable: true,
    mandatory: false,
    enforcementState: 'recommended' as const,
  };
  const requiredAfterRunHint = {
    latestVersion: '1.0.2+202604041200',
    updateAvailable: true,
    mandatory: true,
    enforcementState: 'required_after_run' as const,
  };
  const requiredNowHint = {
    latestVersion: '1.0.2+202604041200',
    updateAvailable: true,
    mandatory: true,
    enforcementState: 'required_now' as const,
  };

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: recommendedHint,
      skippedVersion: null,
      currentRunBusy: false,
      readyToRestart: false,
    }),
    'recommended',
  );

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: requiredAfterRunHint,
      skippedVersion: null,
      currentRunBusy: true,
      readyToRestart: false,
    }),
    'required_waiting_current_run',
  );

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: requiredAfterRunHint,
      skippedVersion: null,
      currentRunBusy: false,
      readyToRestart: false,
    }),
    'required_blocked',
  );

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: requiredNowHint,
      skippedVersion: null,
      currentRunBusy: true,
      readyToRestart: false,
    }),
    'required_blocked',
  );

  assert.equal(
    resolveDesktopUpdateGateState({
      hint: requiredNowHint,
      skippedVersion: null,
      currentRunBusy: false,
      readyToRestart: true,
    }),
    'ready_to_restart',
  );
});

test('resolveDesktopUpdateArtifactUrl prefers direct artifact url without fetching manifest', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch should not run when artifact url already exists');
  };

  try {
    const url = await resolveDesktopUpdateArtifactUrl({
      latestVersion: '1.0.2+202604041200',
      updateAvailable: true,
      mandatory: false,
      enforcementState: 'recommended',
      manifestUrl: 'https://updates.example.com/latest-prod.json',
      artifactUrl: 'https://downloads.example.com/iclaw.dmg',
    });
    assert.equal(url, 'https://downloads.example.com/iclaw.dmg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveDesktopUpdateArtifactUrl reads artifact url from target manifest payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        entry: {
          artifact_url: 'https://downloads.example.com/iclaw-target.dmg',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

  try {
    const url = await resolveDesktopUpdateArtifactUrl({
      latestVersion: '1.0.2+202604041200',
      updateAvailable: true,
      mandatory: false,
      enforcementState: 'recommended',
      manifestUrl: 'https://updates.example.com/latest-prod-mac-aarch64.json',
      artifactUrl: null,
    });
    assert.equal(url, 'https://downloads.example.com/iclaw-target.dmg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveDesktopUpdateArtifactUrl falls back to first entry in index manifest payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        entries: [
          {
            artifact_url: 'https://downloads.example.com/iclaw-index.dmg',
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

  try {
    const url = await resolveDesktopUpdateArtifactUrl({
      latestVersion: '1.0.2+202604041200',
      updateAvailable: true,
      mandatory: false,
      enforcementState: 'recommended',
      manifestUrl: 'https://updates.example.com/latest-prod.json',
      artifactUrl: null,
    });
    assert.equal(url, 'https://downloads.example.com/iclaw-index.dmg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveDesktopUpdateArtifactUrl throws when manifest request fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('bad gateway', { status: 502 });

  try {
    await assert.rejects(
      resolveDesktopUpdateArtifactUrl({
        latestVersion: '1.0.2+202604041200',
        updateAvailable: true,
        mandatory: false,
        enforcementState: 'recommended',
        manifestUrl: 'https://updates.example.com/latest-prod.json',
        artifactUrl: null,
      }),
      /无法获取更新信息：502/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
