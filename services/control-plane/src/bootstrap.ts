import {createHash} from 'node:crypto';
import {config} from './config.ts';
import {
  DEFAULT_AGENT_CATALOG_SEEDS,
  DEFAULT_CLOUD_SKILL_SEEDS,
  DEPRECATED_DEFAULT_AGENT_SLUGS,
} from './catalog-defaults.ts';
import {hashPassword} from './passwords.ts';
import {applySkillCatalogVisibilityMode, resolveSkillCatalogVisibilityMode} from './portal-skill-catalog-policy.ts';
import {DEFAULT_CLAWHUB_SYNC_SOURCE} from './skill-sync-defaults.ts';
import type {PgPortalStore} from './portal-store.ts';
import type {ControlPlaneStore} from './store.ts';

const LEGACY_DEFAULT_INVESTMENT_CATEGORY_FIXUPS: Record<string, {from: string[]; to: string}> = {
  'a-share-value-hunter': {from: ['stock'], to: 'value'},
  'us-value-compass': {from: ['global'], to: 'value'},
};
const LEGACY_DEFAULT_INVESTMENT_EXPERT_AVATAR_URLS = new Set([
  'https://images.unsplash.com/photo-1738566061505-556830f8b8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'https://images.unsplash.com/photo-1739300293504-234817eead52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'https://images.unsplash.com/photo-1758599543154-76ec1c4257df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'https://images.unsplash.com/photo-1772987057599-2f1088c1e993?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'https://images.unsplash.com/photo-1579540830482-659e7518c895?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
]);
const DEFAULT_CATALOGS_BOOTSTRAP_VERSION = 4;
const DEFAULT_CATALOGS_STATE_KEY = 'bootstrap/default-catalogs';
const DEFAULT_CATALOG_UPSERT_CONCURRENCY = 12;

function readMetadataString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const DEFAULT_INVESTMENT_EXPERT_AVATAR_BY_SLUG = new Map(
  DEFAULT_AGENT_CATALOG_SEEDS.flatMap((agent) => {
    const metadata =
      agent.metadata && typeof agent.metadata === 'object' && !Array.isArray(agent.metadata)
        ? (agent.metadata as Record<string, unknown>)
        : null;
    if (!metadata || readMetadataString(metadata.surface) !== 'investment-experts') {
      return [];
    }
    if (readMetadataString(metadata.persona_type) === 'real-persona') {
      return [];
    }
    const avatarUrl = readMetadataString(metadata.avatar_url);
    return avatarUrl ? [[agent.slug, avatarUrl] as const] : [];
  }),
);

function buildDefaultCatalogsHash(): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        skills: DEFAULT_CLOUD_SKILL_SEEDS,
        agents: DEFAULT_AGENT_CATALOG_SEEDS,
        deprecatedAgents: DEPRECATED_DEFAULT_AGENT_SLUGS,
        investmentCategoryFixups: LEGACY_DEFAULT_INVESTMENT_CATEGORY_FIXUPS,
        bootstrapVersion: DEFAULT_CATALOGS_BOOTSTRAP_VERSION,
      }),
    )
    .digest('hex');
}

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

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({length: concurrency}, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        await worker(items[index], index);
      }
    }),
  );
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

export async function ensurePortalSkillCatalogPolicy(portalStore: PgPortalStore): Promise<void> {
  const apps = await portalStore.listApps();
  for (const app of apps) {
    if (resolveSkillCatalogVisibilityMode(app.config) === 'all_cloud') {
      continue;
    }
    await portalStore.upsertApp({
      appName: app.appName,
      displayName: app.displayName,
      description: app.description,
      status: app.status,
      defaultLocale: app.defaultLocale,
      config: applySkillCatalogVisibilityMode(app.config, 'all_cloud'),
    });
  }
}

export async function ensureDefaultSkillSyncSources(store: ControlPlaneStore): Promise<void> {
  await store.upsertSkillSyncSource(DEFAULT_CLAWHUB_SYNC_SOURCE);
}

export async function ensureDefaultCatalogs(store: ControlPlaneStore): Promise<void> {
  const seedHash = buildDefaultCatalogsHash();
  const previousState = await store.getSystemState(DEFAULT_CATALOGS_STATE_KEY);
  const [existingSkills, existingAgents] = await Promise.all([
    store.listSkillCatalogAdmin(),
    store.listAgentCatalogAdmin(),
  ]);
  const existingSkillMap = new Map(existingSkills.map((item) => [item.slug, item]));
  const existingAgentMap = new Map(existingAgents.map((item) => [item.slug, item]));
  const hasSkillGap = DEFAULT_CLOUD_SKILL_SEEDS.some((skill) => {
    const entry = existingSkillMap.get(skill.slug);
    return !entry || entry.active === false || entry.distribution !== 'cloud';
  });
  const hasAgentGap = DEFAULT_AGENT_CATALOG_SEEDS.some((agent) => {
    const entry = existingAgentMap.get(agent.slug);
    return !entry || entry.active === false;
  });
  if (
    typeof previousState?.seedHash === 'string' &&
    previousState.seedHash === seedHash &&
    !hasSkillGap &&
    !hasAgentGap
  ) {
    return;
  }

  await runWithConcurrency(DEFAULT_CLOUD_SKILL_SEEDS, DEFAULT_CATALOG_UPSERT_CONCURRENCY, async (skill) => {
    const existing = existingSkillMap.get(skill.slug);
    const distribution = 'cloud';
    const originType = existing?.originType || skill.originType || 'clawhub';
    const record = await store.upsertSkillCatalogEntry({
      slug: existing?.slug || skill.slug,
      name: existing?.name || skill.name,
      description: existing?.description || skill.description,
      market: existing?.market || skill.market,
      category: existing?.category || skill.category,
      skill_type: existing?.skillType || skill.skillType,
      publisher: existing?.publisher || skill.publisher || 'iClaw',
      distribution,
      tags: existing?.tags?.length ? existing.tags : skill.tags,
      version: existing?.version || skill.version || '1.0.0',
      artifact_url: existing?.artifactUrl || skill.artifactUrl || null,
      artifact_format: existing?.artifactFormat || skill.artifactFormat || 'tar.gz',
      artifact_sha256: existing?.artifactSha256 || null,
      artifact_source_path: null,
      origin_type: originType,
      source_url: existing?.sourceUrl || skill.sourceUrl || skill.artifactUrl || null,
      metadata: existing?.metadata || skill.metadata || {},
      active: true,
    });
    existingSkillMap.set(record.slug, record);
  });

  await runWithConcurrency(DEFAULT_AGENT_CATALOG_SEEDS, DEFAULT_CATALOG_UPSERT_CONCURRENCY, async (agent) => {
    if (existingAgentMap.has(agent.slug)) {
      return;
    }
    const record = await store.upsertAgentCatalogEntry({
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
    existingAgentMap.set(record.slug, record);
  });

  for (const [slug, fixup] of Object.entries(LEGACY_DEFAULT_INVESTMENT_CATEGORY_FIXUPS)) {
    const existing = existingAgentMap.get(slug) || null;
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
    const record = await store.upsertAgentCatalogEntry({
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
    existingAgentMap.set(record.slug, record);
  }

  for (const [slug, avatarUrl] of DEFAULT_INVESTMENT_EXPERT_AVATAR_BY_SLUG) {
    const existing = existingAgentMap.get(slug) || null;
    if (!existing || existing.active === false) {
      continue;
    }

    const metadata =
      existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? ({...existing.metadata} as Record<string, unknown>)
        : {};
    const surface = readMetadataString(metadata.surface);
    const personaType = readMetadataString(metadata.persona_type);
    const currentAvatar = readMetadataString(metadata.avatar_url);
    const shouldReplaceAvatar =
      surface === 'investment-experts' &&
      personaType !== 'real-persona' &&
      currentAvatar !== avatarUrl &&
      (!currentAvatar ||
        currentAvatar.startsWith('https://i.pravatar.cc/') ||
        LEGACY_DEFAULT_INVESTMENT_EXPERT_AVATAR_URLS.has(currentAvatar));

    if (!shouldReplaceAvatar) {
      continue;
    }

    metadata.avatar_url = avatarUrl;
    const record = await store.upsertAgentCatalogEntry({
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
    existingAgentMap.set(record.slug, record);
  }

  for (const slug of DEPRECATED_DEFAULT_AGENT_SLUGS) {
    const existing = existingAgentMap.get(slug) || null;
    if (!existing || existing.active === false) {
      continue;
    }
    const record = await store.upsertAgentCatalogEntry({
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
    existingAgentMap.set(record.slug, record);
  }

  await store.setSystemState(DEFAULT_CATALOGS_STATE_KEY, {
    seedHash,
    appliedAt: new Date().toISOString(),
  });
}
