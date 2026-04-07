export type OpenClawConnectionCardInput = {
  allowImmediateEmptySessionUi: boolean;
  statusConnected: boolean;
  statusLastError: string | null;
  surfaceVisible: boolean;
  surfaceReactivating: boolean;
  sessionTransitionVisible: boolean;
  initialSurfaceRestorePending: boolean;
  hasBootSettled: boolean;
  shellAuthenticated: boolean;
  sessionHistoryState: 'unknown' | 'empty' | 'has-history';
  hasObservedHistory: boolean;
};

export function shouldShowOpenClawConnectionCard(input: OpenClawConnectionCardInput): boolean {
  const bootStillSettling =
    input.initialSurfaceRestorePending ||
    !input.hasBootSettled ||
    (input.shellAuthenticated && input.sessionHistoryState === 'unknown' && !input.hasObservedHistory);

  if (input.allowImmediateEmptySessionUi && !input.statusLastError) {
    return false;
  }

  if (!input.surfaceVisible || input.surfaceReactivating) {
    return false;
  }

  if ((input.sessionTransitionVisible || bootStillSettling) && !input.statusLastError) {
    return false;
  }

  if (input.statusConnected) {
    return false;
  }

  return true;
}
