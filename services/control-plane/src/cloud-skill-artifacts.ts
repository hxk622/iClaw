import type {SkillCatalogEntryRecord} from './domain.ts';

export const CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD = 'portal_artifact_object_key';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getCloudSkillArtifactObjectKey(metadata: Record<string, unknown> | null | undefined): string | null {
  const normalized = trimString(asObject(metadata)[CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]);
  return normalized || null;
}

export function buildCloudSkillArtifactObjectKey(input: {
  slug: string;
  version: string;
  artifactFormat?: 'tar.gz' | 'zip' | null;
}): string {
  const slug = trimString(input.slug).toLowerCase();
  const version = trimString(input.version) || '1.0.0';
  const artifactFormat = input.artifactFormat === 'zip' ? 'zip' : 'tar.gz';
  const ext = artifactFormat === 'zip' ? 'zip' : 'tar.gz';
  return `portal-skills/${slug}/${version}/artifact.${ext}`;
}

export function shouldServeCloudSkillViaControlPlane(
  record:
    | Pick<SkillCatalogEntryRecord, 'distribution' | 'artifactUrl' | 'originType' | 'metadata'>
    | null
    | undefined,
): boolean {
  if (!record || record.distribution !== 'cloud') {
    return false;
  }
  if (trimString(record.artifactUrl)) {
    return false;
  }
  if (getCloudSkillArtifactObjectKey(record.metadata || {})) {
    return true;
  }
  return record.originType === 'github_repo';
}

export function buildCloudSkillArtifactProxyUrl(slug: string, baseUrl?: string | null): string | null {
  const origin = trimString(baseUrl).replace(/\/+$/, '');
  const normalizedSlug = trimString(slug);
  if (!origin || !normalizedSlug) {
    return null;
  }
  return `${origin}/skills/artifact?slug=${encodeURIComponent(normalizedSlug)}`;
}
