export type OpenClawChatRecoveryCause = 'transport' | 'compatibility' | 'render-stuck';

export type OpenClawChatRecoveryAction = 'none' | 'reconnect' | 'reset-embedded' | 'force-reveal';

function normalizeRecoveryText(value?: string | null): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function looksLikeOpenClawTransportIssue(value?: string | null): boolean {
  const normalized = normalizeRecoveryText(value);
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('seq gap') ||
    normalized.includes('websocket') ||
    normalized.includes('gateway connection closed') ||
    normalized.includes('gateway websocket closed') ||
    normalized.includes("reading 'ws'") ||
    normalized.includes('transport error')
  );
}

export function looksLikeOpenClawCompatibilityIssue(value?: string | null): boolean {
  const normalized = normalizeRecoveryText(value);
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('unknown method') ||
    normalized.includes('method not found') ||
    normalized.includes('unsupported method') ||
    normalized.includes('unsupported rpc') ||
    normalized.includes('not supported') ||
    normalized.includes('not support') ||
    normalized.includes('rpc unsupported') ||
    normalized.includes('sessions.subscribe')
  );
}

export function resolveOpenClawChatRecoveryAction(input: {
  attempt: number;
  cause: OpenClawChatRecoveryCause;
}): OpenClawChatRecoveryAction {
  const attempt = Math.max(0, input.attempt);
  if (input.cause === 'transport') {
    return attempt < 4 ? 'reconnect' : 'none';
  }
  if (input.cause === 'compatibility') {
    if (attempt < 2) {
      return 'reset-embedded';
    }
    return attempt < 4 ? 'force-reveal' : 'none';
  }
  if (attempt < 1) {
    return 'reset-embedded';
  }
  return attempt < 3 ? 'force-reveal' : 'none';
}
