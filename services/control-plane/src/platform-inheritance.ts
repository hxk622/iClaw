import type {
  PortalAppMcpBindingRecord,
  PortalAppSkillBindingRecord,
  PortalJsonObject,
  PortalMcpRecord,
  PortalSkillRecord,
} from './portal-domain.ts';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asObject(value: unknown): PortalJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as PortalJsonObject;
}

function compareSkillBindings(left: PortalAppSkillBindingRecord, right: PortalAppSkillBindingRecord): number {
  return left.sortOrder - right.sortOrder || left.skillSlug.localeCompare(right.skillSlug, 'zh-CN');
}

function compareMcpBindings(left: PortalAppMcpBindingRecord, right: PortalAppMcpBindingRecord): number {
  return left.sortOrder - right.sortOrder || left.mcpKey.localeCompare(right.mcpKey, 'zh-CN');
}

export function mergePlatformSkillBindings(
  appName: string,
  bindings: PortalAppSkillBindingRecord[],
  platformSkills: PortalSkillRecord[],
): PortalAppSkillBindingRecord[] {
  const merged = new Map<string, PortalAppSkillBindingRecord>();
  const platformMap = new Map(
    platformSkills
      .filter((item) => item.active !== false)
      .map((item, index) => [item.slug, {index}] as const),
  );

  for (const binding of bindings) {
    const skillSlug = String(binding.skillSlug || '').trim();
    if (!skillSlug) continue;
    const baseConfig = cloneJson(asObject(binding.config));
    if (platformMap.has(skillSlug)) {
      merged.set(skillSlug, {
        ...binding,
        appName: binding.appName || appName,
        skillSlug,
        enabled: true,
        sortOrder: (platformMap.get(skillSlug)?.index || 0) * 10 + 10,
        config: {
          ...baseConfig,
          source_layer: 'platform',
          managed_by: 'platform',
          locked: true,
        },
      });
      continue;
    }
    merged.set(skillSlug, {
      ...binding,
      appName: binding.appName || appName,
      skillSlug,
      config: baseConfig,
    });
  }

  platformMap.forEach(({index}, skillSlug) => {
    if (merged.has(skillSlug)) return;
    merged.set(skillSlug, {
      appName,
      skillSlug,
      enabled: true,
      sortOrder: index * 10 + 10,
      config: {
        source_layer: 'platform',
        managed_by: 'platform',
        locked: true,
      },
    });
  });

  return Array.from(merged.values()).sort(compareSkillBindings);
}

export function mergePlatformMcpBindings(
  appName: string,
  bindings: PortalAppMcpBindingRecord[],
  platformMcps: PortalMcpRecord[],
): PortalAppMcpBindingRecord[] {
  const merged = new Map<string, PortalAppMcpBindingRecord>();
  const platformMap = new Map(
    platformMcps
      .filter((item) => item.active !== false)
      .map((item, index) => [item.mcpKey, {index}] as const),
  );

  for (const binding of bindings) {
    const mcpKey = String(binding.mcpKey || '').trim();
    if (!mcpKey) continue;
    const baseConfig = cloneJson(asObject(binding.config));
    if (platformMap.has(mcpKey)) {
      merged.set(mcpKey, {
        ...binding,
        appName: binding.appName || appName,
        mcpKey,
        enabled: true,
        sortOrder: (platformMap.get(mcpKey)?.index || 0) * 10 + 10,
        config: {
          ...baseConfig,
          source_layer: 'platform',
          managed_by: 'platform',
          locked: true,
        },
      });
      continue;
    }
    merged.set(mcpKey, {
      ...binding,
      appName: binding.appName || appName,
      mcpKey,
      config: baseConfig,
    });
  }

  platformMap.forEach(({index}, mcpKey) => {
    if (merged.has(mcpKey)) return;
    merged.set(mcpKey, {
      appName,
      mcpKey,
      enabled: true,
      sortOrder: index * 10 + 10,
      config: {
        source_layer: 'platform',
        managed_by: 'platform',
        locked: true,
      },
    });
  });

  return Array.from(merged.values()).sort(compareMcpBindings);
}
