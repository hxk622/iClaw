import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowOpenClawConnectionCard } from './openclaw-chat-connection.ts';

function buildInput(overrides = {}) {
  return {
    allowImmediateEmptySessionUi: false,
    statusConnected: false,
    statusLastError: null,
    surfaceVisible: true,
    surfaceReactivating: false,
    sessionTransitionVisible: false,
    initialSurfaceRestorePending: false,
    hasBootSettled: true,
    shellAuthenticated: true,
    sessionHistoryState: 'has-history',
    hasObservedHistory: true,
    ...overrides,
  };
}

test('shows reconnect affordance when gateway is disconnected even if cached history is visible', () => {
  assert.equal(
    shouldShowOpenClawConnectionCard(buildInput()),
    true,
  );
});

test('hides reconnect affordance while authenticated boot is still settling without an error', () => {
  assert.equal(
    shouldShowOpenClawConnectionCard(
      buildInput({
        initialSurfaceRestorePending: true,
        sessionHistoryState: 'unknown',
        hasObservedHistory: false,
      }),
    ),
    false,
  );
});

test('hides reconnect affordance when connection is healthy', () => {
  assert.equal(
    shouldShowOpenClawConnectionCard(
      buildInput({
        statusConnected: true,
      }),
    ),
    false,
  );
});
