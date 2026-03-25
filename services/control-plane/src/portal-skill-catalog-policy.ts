export type SkillCatalogVisibilityMode = 'bindings_only' | 'all_cloud';

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function resolveSkillCatalogVisibilityMode(config: unknown): SkillCatalogVisibilityMode {
  const root = asObject(config);
  const capabilities = asObject(root.capabilities);
  const skillCatalog = asObject(
    capabilities.skill_catalog ?? capabilities.skillCatalog ?? root.skill_catalog ?? root.skillCatalog,
  );
  const rawMode = String(
    skillCatalog.visibility_mode ??
    skillCatalog.visibilityMode ??
    skillCatalog.scope ??
    '',
  )
    .trim()
    .toLowerCase();
  if (rawMode === 'bindings_only') {
    return 'bindings_only';
  }
  if (rawMode === 'all_cloud') {
    return 'all_cloud';
  }
  return 'all_cloud';
}

export function applySkillCatalogVisibilityMode(
  config: unknown,
  mode: SkillCatalogVisibilityMode,
): Record<string, unknown> {
  const root = asObject(config);
  const capabilities = asObject(root.capabilities);
  const skillCatalog = asObject(capabilities.skill_catalog ?? capabilities.skillCatalog);
  return {
    ...root,
    capabilities: {
      ...capabilities,
      skill_catalog: {
        ...skillCatalog,
        visibility_mode: mode,
      },
    },
  };
}
