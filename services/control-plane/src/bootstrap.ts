import {readdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from './config.ts';
import {hashPassword} from './passwords.ts';
import type {ControlPlaneStore} from './store.ts';
import type {PgOemStore} from './oem-store.ts';

const DEFAULT_SEED_OEM_BRANDS = ['iclaw', 'licaiclaw'];

function getSeedBrandIds(): Set<string> {
  const raw = (process.env.CONTROL_PLANE_SEED_OEM_BRANDS || DEFAULT_SEED_OEM_BRANDS.join(',')).trim();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
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

export async function ensureSeedOemBrands(oemStore: PgOemStore): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(dirname(currentFile), '../../..');
  const brandsRoot = resolve(repoRoot, 'brands');
  const entries = await readdir(brandsRoot, {withFileTypes: true});
  const seedBrandIds = getSeedBrandIds();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!seedBrandIds.has(entry.name.trim().toLowerCase())) continue;
    const brandPath = resolve(brandsRoot, entry.name, 'brand.json');
    try {
      const raw = JSON.parse(await readFile(brandPath, 'utf8')) as Record<string, unknown>;
      const brandId = String(raw.brandId || entry.name).trim();
      if (!brandId) continue;

      const storage = raw.storage && typeof raw.storage === 'object' ? (raw.storage as Record<string, unknown>) : {};
      const configDocument = {
        brand_id: brandId,
        brand_meta: {
          brand_id: brandId,
          tenant_key: String(storage.namespace || brandId).trim() || brandId,
          display_name: String(raw.displayName || brandId).trim() || brandId,
          product_name: String(raw.productName || raw.displayName || brandId).trim() || brandId,
          legal_name: String(raw.legalName || raw.displayName || brandId).trim() || brandId,
          bundle_identifier: String(raw.bundleIdentifier || '').trim(),
          auth_service: String(raw.authService || '').trim(),
          storage_namespace: String(storage.namespace || brandId).trim() || brandId,
        },
        website: raw.website || {},
        endpoints: raw.endpoints || {},
        oauth: raw.oauth || {},
        distribution: raw.distribution || {},
        runtime_distribution: raw.runtimeDistribution || {},
        theme: raw.theme || {},
        assets: raw.assets || {},
        surfaces: {
          'home-web': {
            enabled: true,
            config: {
              website: raw.website || {},
              distribution: raw.distribution || {},
              assets: raw.assets || {},
            },
          },
          desktop: {
            enabled: true,
            config: {
              productName: String(raw.productName || raw.displayName || brandId).trim() || brandId,
              displayName: String(raw.displayName || brandId).trim() || brandId,
              sidebarSubtitle: String(raw.sidebarSubtitle || '').trim(),
              theme: raw.theme || {},
              assets: raw.assets || {},
            },
          },
          header: {
            enabled: true,
            config: {},
          },
          sidebar: {
            enabled: true,
            config: {},
          },
          input: {
            enabled: true,
            config: {},
          },
        },
        capabilities: {
          skills: [],
          mcp_servers: [],
          agents: [],
          menus: [],
        },
      };

      const assets = Object.entries((raw.assets as Record<string, unknown>) || {}).flatMap(([assetKey, assetValue]) => {
        if (typeof assetValue !== 'string' || !assetValue.trim()) {
          return [];
        }
        return [
          {
            assetKey,
            kind: assetKey,
            storageProvider: 'repo',
            objectKey: assetValue.trim(),
            publicUrl: null,
            metadata: {},
          },
        ];
      });

      await oemStore.seedBrand({
        brandId,
        tenantKey: String(storage.namespace || brandId).trim() || brandId,
        displayName: String(raw.displayName || brandId).trim() || brandId,
        productName: String(raw.productName || raw.displayName || brandId).trim() || brandId,
        config: configDocument,
        assets,
      });
    } catch (error) {
      console.warn('[control-plane] failed to seed OEM brand', brandPath, error);
    }
  }
}
