import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import type {PortalPresetManifest} from '../src/portal-domain.ts';
import {ensureControlPlaneSchema, PgControlPlaneStore} from '../src/pg-store.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await ensureControlPlaneSchema(config.databaseUrl);

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const manifestPath = readArg('--manifest') || resolve(scriptDir, '../presets/core-oem.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PortalPresetManifest;
  const store = new PgControlPlaneStore(config.databaseUrl);
  try {
    const appNames = new Set((manifest.apps || []).map((app) => app.appName).filter(Boolean));
    const skillRefs = uniq([
      ...(manifest.skills || []).map((skill) => skill.slug),
      ...((manifest.bindings?.skills || []).flatMap((binding) => binding.items.map((item) => item.skillSlug))),
    ]);
    const mcpRefs = uniq([
      ...(manifest.mcps || []).map((mcp) => mcp.mcpKey),
      ...((manifest.bindings?.mcps || []).flatMap((binding) => binding.items.map((item) => item.mcpKey))),
    ]);
    const skillChecks = await Promise.all(
      skillRefs.map(async (slug) => ({slug, record: await store.getSkillCatalogEntry(slug)})),
    );
    const mcpChecks = await Promise.all(
      mcpRefs.map(async (mcpKey) => ({mcpKey, record: await store.getMcpCatalogEntry(mcpKey)})),
    );

    const missingSkills = skillChecks.filter((item) => !item.record).map((item) => item.slug);
    const inactiveSkills = skillChecks.filter((item) => item.record && item.record.active === false).map((item) => item.slug);
    const missingMcps = mcpChecks.filter((item) => !item.record).map((item) => item.mcpKey);
    const inactiveMcps = mcpChecks.filter((item) => item.record && item.record.active === false).map((item) => item.mcpKey);
    const missingBindingApps = uniq([
      ...(manifest.bindings?.skills || []).map((binding) => binding.appName),
      ...(manifest.bindings?.mcps || []).map((binding) => binding.appName),
      ...(manifest.bindings?.models || []).map((binding) => binding.appName),
      ...(manifest.bindings?.menus || []).map((binding) => binding.appName),
      ...(manifest.bindings?.composerControls || []).map((binding) => binding.appName),
      ...(manifest.bindings?.composerShortcuts || []).map((binding) => binding.appName),
    ]).filter((appName) => !appNames.has(appName));

    const ok =
      missingSkills.length === 0 &&
      inactiveSkills.length === 0 &&
      missingMcps.length === 0 &&
      inactiveMcps.length === 0 &&
      missingBindingApps.length === 0;

    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          manifestPath,
          summary: {
            appCount: manifest.apps?.length || 0,
            skillRefCount: skillRefs.length,
            mcpRefCount: mcpRefs.length,
          },
          issues: {
            missingSkills,
            inactiveSkills,
            missingMcps,
            inactiveMcps,
            missingBindingApps,
          },
        },
        null,
        2,
      )}\n`,
    );
    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await store.close();
  }
}

await main();
