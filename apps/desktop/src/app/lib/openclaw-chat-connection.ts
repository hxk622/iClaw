export type SessionHistoryState = 'unknown' | 'empty' | 'has-history';

export type OpenClawGatewayReadinessInput = {
  appConnected: boolean;
  embeddedClientReady: boolean;
  gatewayTransportReady: boolean;
};

export type OpenClawGatewayReadiness = {
  sessionReady: boolean;
  transportReady: boolean;
  reconnectingSession: boolean;
};

export function deriveOpenClawGatewayReadiness(
  input: OpenClawGatewayReadinessInput,
): OpenClawGatewayReadiness {
  const sessionReady = input.appConnected && input.embeddedClientReady;
  const transportReady = input.gatewayTransportReady;
  return {
    sessionReady,
    transportReady,
    reconnectingSession: transportReady && !sessionReady,
  };
}

export type OpenClawChatSurfaceLifecycleInput = {
  optimisticEmptySessionActive: boolean;
  statusConnected: boolean;
  statusLastError: string | null;
  gatewayTransportReady: boolean;
  gatewayTransportError: string | null;
  surfaceVisible: boolean;
  surfaceReactivating: boolean;
  sessionTransitionVisible: boolean;
  initialSurfaceRestorePending: boolean;
  hasBootSettled: boolean;
  shellAuthenticated: boolean;
  sessionHistoryState: SessionHistoryState;
  hasObservedHistory: boolean;
  hasStableVisibleInput: boolean;
  hasStableVisibleChat: boolean;
  renderReady: boolean;
  compatibilityRecoveryActive: boolean;
  sendBlockedReason: string | null;
};

export type OpenClawChatSurfaceLifecycle = {
  allowImmediateEmptySessionUi: boolean;
  waitingForHistoryResolution: boolean;
  bootStillSettling: boolean;
  shouldForceSurfaceReveal: boolean;
  surfaceReadyForReveal: boolean;
  showBootMask: boolean;
  showSessionTransitionMask: boolean;
  showSurfaceReactivationMask: boolean;
  shellTransitioning: boolean;
  shouldShowConnectionCard: boolean;
  shouldShowRenderDiagnostics: boolean;
  allowDisconnectedComposerQueue: boolean;
  phase: 'hidden' | 'booting' | 'transitioning' | 'reactivating' | 'disconnected' | 'ready';
};

export function deriveOpenClawChatSurfaceLifecycle(
  input: OpenClawChatSurfaceLifecycleInput,
): OpenClawChatSurfaceLifecycle {
  const allowImmediateEmptySessionUi = input.shellAuthenticated && input.optimisticEmptySessionActive;
  const waitingForHistoryResolution =
    input.initialSurfaceRestorePending &&
    input.shellAuthenticated &&
    input.sessionHistoryState === 'unknown' &&
    !input.hasObservedHistory;
  const bootStillSettling =
    input.initialSurfaceRestorePending ||
    (!input.hasBootSettled && !input.hasObservedHistory && input.sessionHistoryState !== 'empty') ||
    waitingForHistoryResolution;
  const shouldForceSurfaceReveal =
    input.compatibilityRecoveryActive && input.statusConnected && !input.statusLastError;
  const surfaceUsable =
    input.hasStableVisibleInput ||
    input.hasStableVisibleChat ||
    allowImmediateEmptySessionUi ||
    input.sessionHistoryState === 'empty' ||
    shouldForceSurfaceReveal;
  const surfaceReadyForReveal =
    input.statusConnected &&
    surfaceUsable &&
    !input.statusLastError;
  const showBootMask =
    input.shellAuthenticated &&
    !input.sessionTransitionVisible &&
    !allowImmediateEmptySessionUi &&
    !input.compatibilityRecoveryActive &&
    !input.hasStableVisibleChat &&
    !input.hasStableVisibleInput &&
    !input.statusLastError &&
    (
      !surfaceReadyForReveal ||
      !input.hasBootSettled ||
      input.initialSurfaceRestorePending ||
      waitingForHistoryResolution ||
      !input.renderReady
    );
  const showSessionTransitionMask = input.sessionTransitionVisible && !showBootMask;
  const showSurfaceReactivationMask = false;
  const shellTransitioning = showBootMask || showSessionTransitionMask;
  const shouldShowConnectionCard =
    !allowImmediateEmptySessionUi &&
    input.surfaceVisible &&
    !input.surfaceReactivating &&
    !input.statusConnected &&
    !input.gatewayTransportReady &&
    (input.statusLastError ||
      input.gatewayTransportError ||
      (!input.sessionTransitionVisible && !bootStillSettling))
      ? true
      : false;
  const shouldShowRenderDiagnostics =
    !input.initialSurfaceRestorePending &&
    !input.sessionTransitionVisible &&
    !input.surfaceReactivating &&
    input.surfaceVisible &&
    input.shellAuthenticated &&
    input.statusConnected &&
    !surfaceUsable &&
    !input.renderReady;
  const allowDisconnectedComposerQueue =
    input.shellAuthenticated &&
    !input.sendBlockedReason &&
    !input.sessionTransitionVisible &&
    !input.surfaceReactivating;

  const phase: OpenClawChatSurfaceLifecycle['phase'] =
    !input.surfaceVisible
      ? 'hidden'
      : showSurfaceReactivationMask
        ? 'reactivating'
        : showBootMask
          ? 'booting'
          : showSessionTransitionMask
            ? 'transitioning'
            : !input.statusConnected
              ? 'disconnected'
              : 'ready';

  return {
    allowImmediateEmptySessionUi,
    waitingForHistoryResolution,
    bootStillSettling,
    shouldForceSurfaceReveal,
    surfaceReadyForReveal,
    showBootMask,
    showSessionTransitionMask,
    showSurfaceReactivationMask,
    shellTransitioning,
    shouldShowConnectionCard,
    shouldShowRenderDiagnostics,
    allowDisconnectedComposerQueue,
    phase,
  };
}

export type OpenClawConnectionCardInput = Pick<
  OpenClawChatSurfaceLifecycleInput,
  | 'optimisticEmptySessionActive'
  | 'statusConnected'
  | 'statusLastError'
  | 'gatewayTransportReady'
  | 'gatewayTransportError'
  | 'surfaceVisible'
  | 'surfaceReactivating'
  | 'sessionTransitionVisible'
  | 'initialSurfaceRestorePending'
  | 'hasBootSettled'
  | 'shellAuthenticated'
  | 'sessionHistoryState'
  | 'hasObservedHistory'
> & {
  allowImmediateEmptySessionUi?: boolean;
};

export function shouldShowOpenClawConnectionCard(input: OpenClawConnectionCardInput): boolean {
  return deriveOpenClawChatSurfaceLifecycle({
    optimisticEmptySessionActive: input.allowImmediateEmptySessionUi ?? false,
    statusConnected: input.statusConnected,
    statusLastError: input.statusLastError,
    gatewayTransportReady: input.gatewayTransportReady,
    gatewayTransportError: input.gatewayTransportError,
    surfaceVisible: input.surfaceVisible,
    surfaceReactivating: input.surfaceReactivating,
    sessionTransitionVisible: input.sessionTransitionVisible,
    initialSurfaceRestorePending: input.initialSurfaceRestorePending,
    hasBootSettled: input.hasBootSettled,
    shellAuthenticated: input.shellAuthenticated,
    sessionHistoryState: input.sessionHistoryState,
    hasObservedHistory: input.hasObservedHistory,
    hasStableVisibleInput: false,
    hasStableVisibleChat: input.hasObservedHistory,
    renderReady: input.hasObservedHistory || input.sessionHistoryState === 'empty',
    compatibilityRecoveryActive: false,
    sendBlockedReason: null,
  }).shouldShowConnectionCard;
}

export type OpenClawDisconnectedComposerQueueInput = Pick<
  OpenClawChatSurfaceLifecycleInput,
  'shellAuthenticated' | 'sendBlockedReason' | 'sessionTransitionVisible' | 'surfaceReactivating'
>;

export function shouldAllowDisconnectedComposerQueue(
  input: OpenClawDisconnectedComposerQueueInput,
): boolean {
  return deriveOpenClawChatSurfaceLifecycle({
    optimisticEmptySessionActive: false,
    statusConnected: false,
    statusLastError: null,
    gatewayTransportReady: false,
    gatewayTransportError: null,
    surfaceVisible: true,
    surfaceReactivating: input.surfaceReactivating,
    sessionTransitionVisible: input.sessionTransitionVisible,
    initialSurfaceRestorePending: false,
    hasBootSettled: true,
    shellAuthenticated: input.shellAuthenticated,
    sessionHistoryState: 'empty',
    hasObservedHistory: false,
    hasStableVisibleInput: false,
    hasStableVisibleChat: false,
    renderReady: false,
    compatibilityRecoveryActive: false,
    sendBlockedReason: input.sendBlockedReason,
  }).allowDisconnectedComposerQueue;
}

export type OpenClawWelcomePageInput = Pick<
  OpenClawChatSurfaceLifecycle,
  'allowImmediateEmptySessionUi' | 'bootStillSettling' | 'shellTransitioning'
> & {
  allowWelcomeForCurrentRoute: boolean;
  preferBrandWelcomeForRoute: boolean;
  sessionHistoryState: SessionHistoryState;
  hasObservedHistory: boolean;
  renderGroupCount: number;
  showRenderDiagnosticsCard: boolean;
  showConnectionCard: boolean;
  statusBusy: boolean;
  welcomePageEnabled: boolean;
};

export function shouldShowOpenClawWelcomePage(input: OpenClawWelcomePageInput): boolean {
  if (!input.allowWelcomeForCurrentRoute || !input.welcomePageEnabled) {
    return false;
  }

  const canShowForEmptySession =
    input.preferBrandWelcomeForRoute ||
    (input.allowImmediateEmptySessionUi && input.sessionHistoryState === 'empty') ||
    (!input.bootStillSettling &&
      !input.hasObservedHistory &&
      input.sessionHistoryState === 'empty');

  if (!canShowForEmptySession) {
    return false;
  }

  if (
    input.shellTransitioning ||
    input.showRenderDiagnosticsCard ||
    input.showConnectionCard ||
    input.statusBusy
  ) {
    return false;
  }

  return true;
}
