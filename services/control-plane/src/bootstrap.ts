import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from './config.ts';
import {hashPassword} from './passwords.ts';
import type {PortalPresetManifest} from './portal-domain.ts';
import {syncPortalPresetManifest} from './portal-preset.ts';
import {DEFAULT_CLAWHUB_SYNC_SOURCE} from './skill-sync-defaults.ts';
import type {PgPortalStore} from './portal-store.ts';
import type {ControlPlaneStore} from './store.ts';

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
