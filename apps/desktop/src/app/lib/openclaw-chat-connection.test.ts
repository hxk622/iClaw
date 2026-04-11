import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveOpenClawChatSurfaceLifecycle,
  shouldAllowDisconnectedComposerQueue,
  shouldShowOpenClawConnectionCard,
  shouldShowOpenClawWelcomePage,
} from './openclaw-chat-connection.ts';

function buildInput(overrides = {}) {
  return {
    optimisticEmptySessionActive: false,
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
    hasStableVisibleInput: true,
    hasStableVisibleChat: true,
    renderReady: true,
    compatibilityRecoveryActive: false,
    sendBlockedReason: null,
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
        hasStableVisibleInput: false,
        hasStableVisibleChat: false,
        renderReady: false,
      }),
    ),
    false,
  );
});

test('shows reconnect affordance when cached history is already visible even before boot settles', () => {
  assert.equal(
    shouldShowOpenClawConnectionCard(
      buildInput({
        hasBootSettled: false,
        sessionHistoryState: 'has-history',
        hasObservedHistory: true,
        hasStableVisibleChat: true,
        renderReady: true,
      }),
    ),
    true,
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

test('deriveOpenClawChatSurfaceLifecycle centralizes boot/disconnect decisions', () => {
  const lifecycle = deriveOpenClawChatSurfaceLifecycle(
    buildInput({
      statusConnected: false,
      hasBootSettled: false,
      sessionHistoryState: 'has-history',
      hasObservedHistory: true,
      hasStableVisibleChat: true,
      renderReady: true,
    }),
  );

  assert.equal(lifecycle.phase, 'disconnected');
  assert.equal(lifecycle.showBootMask, false);
  assert.equal(lifecycle.shouldShowConnectionCard, true);
  assert.equal(lifecycle.allowDisconnectedComposerQueue, true);
});

test('deriveOpenClawChatSurfaceLifecycle keeps authenticated empty sessions interactive while connecting', () => {
  const lifecycle = deriveOpenClawChatSurfaceLifecycle(
    buildInput({
      optimisticEmptySessionActive: true,
      sessionHistoryState: 'empty',
      hasObservedHistory: false,
      hasStableVisibleInput: true,
      hasStableVisibleChat: false,
      renderReady: false,
      statusConnected: false,
    }),
  );

  assert.equal(lifecycle.allowImmediateEmptySessionUi, true);
  assert.equal(lifecycle.showBootMask, false);
  assert.equal(lifecycle.shouldShowConnectionCard, false);
  assert.equal(lifecycle.allowDisconnectedComposerQueue, true);
});

test('deriveOpenClawChatSurfaceLifecycle treats visible input as usable even when thread visibility lags', () => {
  const lifecycle = deriveOpenClawChatSurfaceLifecycle(
    buildInput({
      statusConnected: true,
      sessionHistoryState: 'unknown',
      hasObservedHistory: false,
      hasStableVisibleInput: true,
      hasStableVisibleChat: false,
      renderReady: true,
    }),
  );

  assert.equal(lifecycle.phase, 'ready');
  assert.equal(lifecycle.showBootMask, false);
  assert.equal(lifecycle.shouldShowRenderDiagnostics, false);
});

test('allows disconnected composer queue only when authenticated and not blocked by another transition', () => {
  assert.equal(
    shouldAllowDisconnectedComposerQueue({
      shellAuthenticated: true,
      sendBlockedReason: null,
      sessionTransitionVisible: false,
      surfaceReactivating: false,
    }),
    true,
  );

  assert.equal(
    shouldAllowDisconnectedComposerQueue({
      shellAuthenticated: false,
      sendBlockedReason: null,
      sessionTransitionVisible: false,
      surfaceReactivating: false,
    }),
    false,
  );

  assert.equal(
    shouldAllowDisconnectedComposerQueue({
      shellAuthenticated: true,
      sendBlockedReason: '正在切换模型，请稍后发送。',
      sessionTransitionVisible: false,
      surfaceReactivating: false,
    }),
    false,
  );

  assert.equal(
    shouldAllowDisconnectedComposerQueue({
      shellAuthenticated: true,
      sendBlockedReason: null,
      sessionTransitionVisible: true,
      surfaceReactivating: false,
    }),
    false,
  );
});

test('shows welcome page only for true empty-session lifecycle states', () => {
  assert.equal(
    shouldShowOpenClawWelcomePage({
      allowWelcomeForCurrentRoute: true,
      allowImmediateEmptySessionUi: true,
      bootStillSettling: false,
      shellTransitioning: false,
      sessionHistoryState: 'empty',
      hasObservedHistory: false,
      renderGroupCount: 0,
      showRenderDiagnosticsCard: false,
      showConnectionCard: false,
      statusBusy: false,
      welcomePageEnabled: true,
    }),
    true,
  );

  assert.equal(
    shouldShowOpenClawWelcomePage({
      allowWelcomeForCurrentRoute: true,
      allowImmediateEmptySessionUi: false,
      bootStillSettling: true,
      shellTransitioning: false,
      sessionHistoryState: 'empty',
      hasObservedHistory: false,
      renderGroupCount: 0,
      showRenderDiagnosticsCard: false,
      showConnectionCard: false,
      statusBusy: false,
      welcomePageEnabled: true,
    }),
    false,
  );

  assert.equal(
    shouldShowOpenClawWelcomePage({
      allowWelcomeForCurrentRoute: true,
      allowImmediateEmptySessionUi: false,
      bootStillSettling: false,
      shellTransitioning: false,
      sessionHistoryState: 'empty',
      hasObservedHistory: false,
      renderGroupCount: 0,
      showRenderDiagnosticsCard: true,
      showConnectionCard: false,
      statusBusy: false,
      welcomePageEnabled: true,
    }),
    false,
  );

  assert.equal(
    shouldShowOpenClawWelcomePage({
      allowWelcomeForCurrentRoute: true,
      allowImmediateEmptySessionUi: true,
      bootStillSettling: false,
      shellTransitioning: true,
      sessionHistoryState: 'empty',
      hasObservedHistory: false,
      renderGroupCount: 0,
      showRenderDiagnosticsCard: false,
      showConnectionCard: false,
      statusBusy: false,
      welcomePageEnabled: true,
    }),
    false,
  );
});
