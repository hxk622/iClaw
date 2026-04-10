import path from 'node:path';
import { createHash } from 'node:crypto';

export type DesktopActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DesktopActionGrantScope = 'once' | 'task' | 'session' | 'ttl';
export type DesktopActionExecutorType = 'template' | 'shell' | 'browser' | 'filesystem' | 'process' | 'upload';
export type DesktopActionAccessMode = 'read' | 'write' | 'execute' | 'connect';

export type DesktopActionNetworkDestination = {
  scheme: string;
  host: string;
  port: number | null;
  pathPrefix: string | null;
  redirectPolicy: 'none' | 'same-origin-only' | 'allowlisted';
};

export type DesktopActionGrantRecord = {
  intentFingerprint: string;
  approvedPlanHash: string;
  capability: string;
  riskLevel: DesktopActionRiskLevel;
  scope: DesktopActionGrantScope;
  taskId: string | null;
  sessionKey: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type DesktopActionLocalIntent = {
  capability: string;
  riskLevel: DesktopActionRiskLevel;
  executorType: DesktopActionExecutorType;
  executorTemplateId: string | null;
  requiresElevation: boolean;
  publisherId: string | null;
  packageDigest: string | null;
  resources: Array<{ kind: string; value: string; access: DesktopActionAccessMode }>;
  networkDestinations: DesktopActionNetworkDestination[];
  compiledPlanHash: string;
};

export function normalizeDesktopActionPath(input: string, platform: NodeJS.Platform = process.platform): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (platform === 'win32') {
    const normalized = path.win32.normalize(trimmed.replace(/\//g, '\\'));
    const unc = normalized.startsWith('\\\\');
    if (unc) {
      return normalized.replace(/\\+$/, '');
    }
    return normalized.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`).replace(/\\+$/, '');
  }

  const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'));
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

export function normalizeDesktopActionNetworkDestination(
  input: string | Partial<DesktopActionNetworkDestination>,
): DesktopActionNetworkDestination {
  if (typeof input === 'string') {
    const parsed = new URL(input);
    const pathPrefix = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : null;
    return {
      scheme: parsed.protocol.replace(/:$/, '').toLowerCase(),
      host: parsed.hostname.toLowerCase(),
      port: parsed.port ? Number(parsed.port) : null,
      pathPrefix,
      redirectPolicy: 'none',
    };
  }

  return {
    scheme: String(input.scheme || '').trim().toLowerCase(),
    host: String(input.host || '').trim().toLowerCase(),
    port: typeof input.port === 'number' && Number.isFinite(input.port) ? Math.floor(input.port) : null,
    pathPrefix: input.pathPrefix ? String(input.pathPrefix).trim().replace(/\/+$/, '') || null : null,
    redirectPolicy: input.redirectPolicy || 'none',
  };
}

export function clampDesktopActionGrantScope(
  requested: DesktopActionGrantScope,
  capability: string,
  riskLevel: DesktopActionRiskLevel,
): DesktopActionGrantScope {
  const normalizedCapability = capability.trim().toLowerCase();
  if (normalizedCapability === 'elevated_execute') {
    return 'once';
  }
  if (riskLevel === 'high' || riskLevel === 'critical') {
    return 'once';
  }
  return requested;
}

export function buildDesktopActionIntentFingerprint(intent: DesktopActionLocalIntent): string {
  const payload = {
    capability: intent.capability.trim().toLowerCase(),
    riskLevel: intent.riskLevel,
    executorType: intent.executorType,
    executorTemplateId: intent.executorTemplateId,
    requiresElevation: intent.requiresElevation,
    publisherId: intent.publisherId,
    packageDigest: intent.packageDigest,
    resources: intent.resources
      .map((resource) => ({
        kind: resource.kind,
        value: normalizeDesktopActionPath(resource.value),
        access: resource.access,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    networkDestinations: intent.networkDestinations
      .map((entry) => normalizeDesktopActionNetworkDestination(entry))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function shouldReuseDesktopActionGrant(input: {
  grant: DesktopActionGrantRecord;
  intentFingerprint: string;
  approvedPlanHash: string;
  taskId?: string | null;
  sessionKey?: string | null;
  now?: string;
}): boolean {
  const { grant, intentFingerprint, approvedPlanHash } = input;
  if (grant.revokedAt) {
    return false;
  }
  if (grant.intentFingerprint !== intentFingerprint || grant.approvedPlanHash !== approvedPlanHash) {
    return false;
  }
  const nowMs = Date.parse(input.now || new Date().toISOString());
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= nowMs) {
    return false;
  }
  if (grant.scope === 'task') {
    return Boolean(input.taskId && grant.taskId && input.taskId === grant.taskId);
  }
  if (grant.scope === 'session') {
    return Boolean(input.sessionKey && grant.sessionKey && input.sessionKey === grant.sessionKey);
  }
  return grant.scope === 'once' || grant.scope === 'ttl';
}

export function verifyDesktopActionPlanHash(input: {
  approvedPlanHash: string | null;
  executedPlanHash: string | null;
}): { ok: boolean; reason: string | null } {
  const approved = String(input.approvedPlanHash || '').trim();
  const executed = String(input.executedPlanHash || '').trim();
  if (!approved || !executed) {
    return { ok: false, reason: 'missing_plan_hash' };
  }
  if (approved !== executed) {
    return { ok: false, reason: 'plan_hash_mismatch' };
  }
  return { ok: true, reason: null };
}
