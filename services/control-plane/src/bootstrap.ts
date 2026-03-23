import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from './config.ts';
import {
  DEFAULT_AGENT_CATALOG_SEEDS,
  DEFAULT_CLOUD_SKILL_SEEDS,
  DEPRECATED_DEFAULT_AGENT_SLUGS,
} from './catalog-defaults.ts';
import {hashPassword} from './passwords.ts';
import type {PortalPresetManifest} from './portal-domain.ts';
import {syncPortalPresetManifest} from './portal-preset.ts';
import {DEFAULT_CLAWHUB_SYNC_SOURCE} from './skill-sync-defaults.ts';
import type {PgPortalStore} from './portal-store.ts';
import type {ControlPlaneStore} from './store.ts';

const LEGACY_DEFAULT_INVESTMENT_CATEGORY_FIXUPS: Record<string, {from: string[]; to: string}> = {
  'a-share-value-hunter': {from: ['stock'], to: 'value'},
  'us-value-compass': {from: ['global'], to: 'value'},
};

function rolePriority(role: 'user' | 'admin' | 'super_admin'): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
}

export async function ensureBootstrapAdmin(store: ControlPlaneStore): Promise<void> {
  if (!config.bootstrapAdminEnabled) {
    return;
  }

  const username = config.bootstrapAdminUsername;
  const email = config.bootstrapAdminEmail;
  const passwordHash = hashPassword(config.bootstrapAdminPassword);

  let user = (await store.getUserByIdentifier(username)) || (await store.getUserByEmail(email));
  if (!user) {
    await store.createUser({
      username,
      email,
      displayName: config.bootstrapAdminDisplayName,
      passwordHash,
      role: 'admin',
      initialCreditBalance: config.defaultCreditBalance,
    });
    return;
  }

  if (rolePriority(user.role) < rolePriority('admin')) {
    user = (await store.updateUserRole(user.id, 'admin')) || user;
  }

  if (!user.passwordHash || config.bootstrapAdminResetPassword) {
    await store.setPasswordHash(user.id, passwordHash);
  }
}

export async function ensurePortalPreset(portalStore: PgPortalStore): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(dirname(currentFile), '../../..');
  const manifestPath = resolve(repoRoot, 'services/control-plane/presets/core-oem.json');
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as PortalPresetManifest;
  if (raw.schemaVersion !== 1) {
    throw new Error(`unsupported portal preset schema version: ${raw.schemaVersion}`);
  }

  await syncPortalPresetManifest(portalStore, raw, {
    manifestDir: dirname(manifestPath),
  });
}

export async function ensureDefaultSkillSyncSources(store: ControlPlaneStore): Promise<void> {
  await store.upsertSkillSyncSource(DEFAULT_CLAWHUB_SYNC_SOURCE);
}

export async function ensureDefaultCatalogs(store: ControlPlaneStore): Promise<void> {
  for (const skill of DEFAULT_CLOUD_SKILL_SEEDS) {
    if (await store.getSkillCatalogEntry(skill.slug)) {
      continue;
    }
    await store.upsertSkillCatalogEntry({
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      visibility: 'showcase',
      market: skill.market,
      category: skill.category,
      skill_type: skill.skillType,
      publisher: skill.publisher || 'iClaw',
      distribution: skill.artifactSourcePath ? 'bundled' : 'cloud',
      tags: skill.tags,
      version: skill.version || '1.0.0',
      artifact_url: skill.artifactUrl || null,
      artifact_format: skill.artifactFormat || 'tar.gz',
      artifact_sha256: null,
      artifact_source_path: skill.artifactSourcePath || null,
      origin_type: skill.artifactSourcePath ? 'bundled' : 'clawhub',
      source_url: skill.artifactUrl || null,
      metadata: {},
      active: true,
    });
  }

  for (const agent of DEFAULT_AGENT_CATALOG_SEEDS) {
    if (await store.getAgentCatalogEntry(agent.slug)) {
      continue;
    }
    await store.upsertAgentCatalogEntry({
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      publisher: agent.publisher,
      featured: agent.featured,
      official: agent.official,
      tags: agent.tags,
      capabilities: agent.capabilities,
      use_cases: agent.useCases,
      metadata: agent.metadata,
      sort_order: agent.sortOrder,
      active: agent.active,
    });
  }

  for (const [slug, fixup] of Object.entries(LEGACY_DEFAULT_INVESTMENT_CATEGORY_FIXUPS)) {
    const existing = await store.getAgentCatalogEntry(slug);
    if (!existing || existing.active === false) {
      continue;
    }

    const metadata =
      existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? ({...existing.metadata} as Record<string, unknown>)
        : {};
    const surface = typeof metadata.surface === 'string' ? metadata.surface : '';
    const currentCategory =
      typeof metadata.investment_category === 'string' ? metadata.investment_category.trim() : '';

    if (surface !== 'investment-experts' || !fixup.from.includes(currentCategory)) {
      continue;
    }

    metadata.investment_category = fixup.to;
    await store.upsertAgentCatalogEntry({
      slug: existing.slug,
      name: existing.name,
      description: existing.description,
      category: existing.category,
      publisher: existing.publisher,
      featured: existing.featured,
      official: existing.official,
      tags: existing.tags,
      capabilities: existing.capabilities,
      use_cases: existing.useCases,
      metadata,
      sort_order: existing.sortOrder,
      active: existing.active,
    });
  }

  for (const slug of DEPRECATED_DEFAULT_AGENT_SLUGS) {
    const existing = await store.getAgentCatalogEntry(slug);
    if (!existing || existing.active === false) {
      continue;
    }
    await store.upsertAgentCatalogEntry({
      slug: existing.slug,
      name: existing.name,
      description: existing.description,
      category: existing.category,
      publisher: existing.publisher,
      featured: existing.featured,
      official: existing.official,
      tags: existing.tags,
      capabilities: existing.capabilities,
      use_cases: existing.useCases,
      metadata: {
        ...existing.metadata,
        deprecated: true,
      },
      sort_order: existing.sortOrder,
      active: false,
    });
  }
}
