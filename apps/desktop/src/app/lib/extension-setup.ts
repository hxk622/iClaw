export type ExtensionSetupFieldType = 'secret' | 'text' | 'textarea' | 'number' | 'select' | 'boolean';

export type ExtensionSetupFieldOption = {
  label: string;
  value: string;
};

export type ExtensionSetupField = {
  key: string;
  label: string;
  type: ExtensionSetupFieldType;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  injectAs?: string | null;
  options?: ExtensionSetupFieldOption[];
};

export type ExtensionSetupSchema = {
  version: number;
  fields: ExtensionSetupField[];
};

export type ExtensionSetupStatus = 'not_required' | 'configured' | 'missing';

export type ExtensionInstallConfigSnapshot = {
  setupValues: Record<string, unknown>;
  configuredSecretKeys: string[];
  status: ExtensionSetupStatus;
  schemaVersion: number | null;
  updatedAt: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function titleizeFieldKey(value: string): string {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 3 && /^[A-Z0-9]+$/.test(part)
        ? part
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

function isLikelySecretEnvKey(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return false;
  if (normalized.startsWith('UV_') || normalized === 'PORT' || normalized === 'NODE_ENV') {
    return false;
  }
  return ['KEY', 'TOKEN', 'SECRET', 'COOKIE', 'PASSWORD'].some((part) => normalized.includes(part));
}

function normalizeField(input: unknown): ExtensionSetupField | null {
  const value = asObject(input);
  const key = typeof value.key === 'string' ? value.key.trim() : '';
  if (!key) {
    return null;
  }
  const rawType = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
  const type: ExtensionSetupFieldType =
    rawType === 'secret' ||
    rawType === 'textarea' ||
    rawType === 'number' ||
    rawType === 'select' ||
    rawType === 'boolean'
      ? rawType
      : 'text';
  const options =
    type === 'select'
      ? (Array.isArray(value.options) ? value.options : [])
          .map((item) => {
            const option = asObject(item);
            const optionValue = typeof option.value === 'string' ? option.value.trim() : '';
            if (!optionValue) return null;
            return {
              label:
                typeof option.label === 'string' && option.label.trim()
                  ? option.label.trim()
                  : optionValue,
              value: optionValue,
            };
          })
          .filter((item): item is ExtensionSetupFieldOption => Boolean(item))
      : undefined;

  return {
    key,
    label:
      typeof value.label === 'string' && value.label.trim()
        ? value.label.trim()
        : titleizeFieldKey(key),
    type,
    required: value.required !== false,
    placeholder: typeof value.placeholder === 'string' ? value.placeholder : null,
    helpText:
      typeof value.help_text === 'string'
        ? value.help_text
        : typeof value.helpText === 'string'
          ? value.helpText
          : null,
    injectAs:
      typeof value.inject_as === 'string'
        ? value.inject_as.trim() || null
        : typeof value.injectAs === 'string'
          ? value.injectAs.trim() || null
          : null,
    options,
  };
}

function normalizeSchema(input: unknown): ExtensionSetupSchema | null {
  const value = asObject(input);
  const fields = (Array.isArray(value.fields) ? value.fields : [])
    .map(normalizeField)
    .filter((item): item is ExtensionSetupField => Boolean(item));
  if (fields.length === 0) {
    return null;
  }
  const version =
    typeof value.version === 'number' && Number.isFinite(value.version) && value.version > 0
      ? Math.floor(value.version)
      : 1;
  return {version, fields};
}

export function parseExtensionSetupSchema(
  metadata: Record<string, unknown> | null | undefined,
  config: Record<string, unknown> | null | undefined = {},
): ExtensionSetupSchema | null {
  const normalizedMetadata = metadata || {};
  const normalizedConfig = config || {};
  const explicit =
    normalizeSchema(normalizedMetadata.setup_schema) ||
    normalizeSchema(normalizedMetadata.setupSchema) ||
    normalizeSchema(normalizedConfig.setup_schema) ||
    normalizeSchema(normalizedConfig.setupSchema);
  if (explicit) {
    return explicit;
  }

  const envKeys = new Set<string>([
    ...asStringArray(normalizedMetadata.required_env),
    ...asStringArray(normalizedMetadata.requiredEnv),
    ...asStringArray(normalizedConfig.required_env),
    ...asStringArray(normalizedConfig.requiredEnv),
  ]);
  for (const key of Object.keys(asObject(normalizedConfig.env))) {
    if (isLikelySecretEnvKey(key)) {
      envKeys.add(key);
    }
  }
  if (envKeys.size === 0) {
    return null;
  }
  return {
    version: 1,
    fields: Array.from(envKeys).map((key) => ({
      key,
      label: titleizeFieldKey(key),
      type: 'secret',
      required: true,
      injectAs: key,
    })),
  };
}
