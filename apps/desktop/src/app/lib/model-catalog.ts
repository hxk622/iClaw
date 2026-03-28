export type GatewayModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  logoPresetKey?: string | null;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<'text' | 'image'>;
};

export type ModelFamily =
  | 'gpt'
  | 'claude'
  | 'gemini'
  | 'grok'
  | 'qwen'
  | 'minimax'
  | 'deepseek'
  | 'kimi'
  | 'doubao'
  | 'glm'
  | 'mistral'
  | 'llama'
  | 'generic';

export type ComposerModelTier = 'advanced' | 'basic' | 'other';

export type ComposerModelOption = {
  id: string;
  label: string;
  family: ModelFamily;
  logoPresetKey: string | null;
  detail: string;
  badge: string | null;
  tier: ComposerModelTier;
  reasoning: boolean;
  supportsImageInput: boolean;
  contextWindow: number | null;
};

const MODEL_FAMILY_ORDER: Record<ModelFamily, number> = {
  gpt: 10,
  claude: 20,
  gemini: 30,
  grok: 40,
  qwen: 50,
  minimax: 60,
  deepseek: 70,
  kimi: 80,
  doubao: 90,
  glm: 100,
  mistral: 110,
  llama: 120,
  generic: 999,
};

const MODEL_TIER_ORDER: Record<ComposerModelTier, number> = {
  advanced: 10,
  basic: 20,
  other: 999,
};

type ModelPresentationProfile = {
  label: string;
  family: ModelFamily;
  tier: ComposerModelTier;
  badge: string | null;
  order: number;
};

type ModelProfileRule = {
  match: (source: string) => boolean;
  profile: ModelPresentationProfile;
};

const MODEL_PROFILE_RULES: ModelProfileRule[] = [
  {
    match: (source) =>
      (source.includes('qwen') && source.includes('3.5') && source.includes('plus')) ||
      source.includes('qwen3.5-plus') ||
      source.includes('qwen3_5_plus'),
    profile: {
      label: 'Qwen3.5 Plus',
      family: 'qwen',
      tier: 'advanced',
      badge: '0.6x',
      order: 10,
    },
  },
  {
    match: (source) => source.includes('minimax') && source.includes('m2.7'),
    profile: {
      label: 'MiniMax m2.7',
      family: 'minimax',
      tier: 'advanced',
      badge: '2x',
      order: 20,
    },
  },
  {
    match: (source) => source.includes('minimax') && source.includes('m2.5'),
    profile: {
      label: 'MiniMax m2.5',
      family: 'minimax',
      tier: 'advanced',
      badge: '1.8x',
      order: 30,
    },
  },
  {
    match: (source) => source.includes('kimi') && source.includes('k2.5'),
    profile: {
      label: 'Kimi k2.5',
      family: 'kimi',
      tier: 'advanced',
      badge: '1.8x',
      order: 40,
    },
  },
  {
    match: (source) =>
      (source.includes('doubao') && source.includes('seed') && source.includes('2.0') && source.includes('code')) ||
      source.includes('doubao-seed-2.0-code'),
    profile: {
      label: 'Doubao Seed-2.0-code',
      family: 'doubao',
      tier: 'advanced',
      badge: '1x',
      order: 50,
    },
  },
  {
    match: (source) =>
      (source.includes('qwen') && source.includes('coder') && source.includes('plus')) ||
      source.includes('qwen3-coder-plus'),
    profile: {
      label: 'Qwen3 Coder Plus',
      family: 'qwen',
      tier: 'advanced',
      badge: '2.5x',
      order: 60,
    },
  },
  {
    match: (source) =>
      (source.includes('qwen') && source.includes('max')) || source.includes('qwen3-max'),
    profile: {
      label: 'Qwen3 Max',
      family: 'qwen',
      tier: 'advanced',
      badge: '1x',
      order: 70,
    },
  },
  {
    match: (source) => (source.includes('glm') && source.includes('4.7')) || source.includes('glm-4.7'),
    profile: {
      label: 'GLM 4.7',
      family: 'glm',
      tier: 'basic',
      badge: '1.4x',
      order: 80,
    },
  },
  {
    match: (source) => (source.includes('glm') && source.includes('5')) || source.includes('glm-5'),
    profile: {
      label: 'GLM 5',
      family: 'glm',
      tier: 'advanced',
      badge: '1.6x',
      order: 85,
    },
  },
  {
    match: (source) =>
      (source.includes('deepseek') && source.includes('v3.2')) || source.includes('deepseek-v3.2'),
    profile: {
      label: 'DeepSeek V3.2',
      family: 'deepseek',
      tier: 'advanced',
      badge: '1x',
      order: 88,
    },
  },
  {
    match: (source) => source.includes('minimax') && source.includes('m2.1'),
    profile: {
      label: 'MiniMax m2.1',
      family: 'minimax',
      tier: 'basic',
      badge: '1.8x',
      order: 90,
    },
  },
];

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function buildModelSource(entry: Pick<GatewayModelCatalogEntry, 'id' | 'name' | 'provider'>): string {
  return `${normalizeText(entry.provider)} ${normalizeText(entry.id)} ${normalizeText(entry.name)}`;
}

function prettifyModelName(rawId: string): string {
  const fallback = rawId.includes('/') ? rawId.split('/').pop() ?? rawId : rawId;
  return fallback
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bIv\b/g, 'IV')
    .trim();
}

export function detectModelFamily(entry: Pick<GatewayModelCatalogEntry, 'id' | 'name' | 'provider'>): ModelFamily {
  const provider = normalizeText(entry.provider);
  const source = buildModelSource(entry);

  if (provider === 'openai' || source.includes('gpt') || source.includes('o1') || source.includes('o3') || source.includes('o4')) {
    return 'gpt';
  }
  if (provider === 'anthropic' || source.includes('claude')) {
    return 'claude';
  }
  if (provider === 'google' || source.includes('gemini')) {
    return 'gemini';
  }
  if (provider === 'xai' || source.includes('grok')) {
    return 'grok';
  }
  if (provider === 'qwen' || provider === 'dashscope' || source.includes('qwen')) {
    return 'qwen';
  }
  if (provider === 'minimax' || source.includes('minimax')) {
    return 'minimax';
  }
  if (provider === 'deepseek' || source.includes('deepseek')) {
    return 'deepseek';
  }
  if (provider === 'moonshot' || source.includes('kimi')) {
    return 'kimi';
  }
  if (provider === 'doubao' || provider === 'volcengine' || source.includes('doubao') || source.includes('seed')) {
    return 'doubao';
  }
  if (provider === 'zhipu' || source.includes('glm')) {
    return 'glm';
  }
  if (provider === 'mistral' || source.includes('mistral')) {
    return 'mistral';
  }
  if (provider === 'meta' || provider === 'ollama' || source.includes('llama')) {
    return 'llama';
  }
  return 'generic';
}

function resolveModelPresentationProfile(
  entry: Pick<GatewayModelCatalogEntry, 'id' | 'name' | 'provider'>,
): ModelPresentationProfile | null {
  const source = buildModelSource(entry);
  const matchedRule = MODEL_PROFILE_RULES.find((rule) => rule.match(source));
  return matchedRule?.profile ?? null;
}

export function resolveModelLabel(entry: GatewayModelCatalogEntry): string {
  const profile = resolveModelPresentationProfile(entry);
  if (profile) {
    return profile.label;
  }
  const preferred = entry.name?.trim();
  if (preferred) {
    return preferred;
  }
  return prettifyModelName(entry.id);
}

function buildCapabilityDetail(
  entry: GatewayModelCatalogEntry,
  profile: ModelPresentationProfile | null,
): string {
  if (profile) {
    const tags = [profile.badge]
      .filter((value): value is string => Boolean(value));
    if (tags.length > 0) {
      return tags.join(' · ');
    }
  }

  const tags: string[] = [];
  if (entry.input?.includes('image')) {
    tags.push('图像理解');
  }
  if (entry.reasoning) {
    tags.push('推理增强');
  }
  if (typeof entry.contextWindow === 'number') {
    if (entry.contextWindow >= 1_000_000) {
      tags.push('超长上下文');
    } else if (entry.contextWindow >= 200_000) {
      tags.push('长上下文');
    }
  }
  if (tags.length === 0) {
    tags.push('文本对话');
  }
  return tags.join(' · ');
}

export function buildComposerModelOptions(models: GatewayModelCatalogEntry[]): ComposerModelOption[] {
  const deduped = new Map<string, GatewayModelCatalogEntry>();
  models.forEach((entry) => {
    const id = entry.id?.trim();
    if (!id) {
      return;
    }
    deduped.set(id, entry);
  });

  return Array.from(deduped.values())
    .map((entry) => {
      const presentation = resolveModelPresentationProfile(entry);
      const family = presentation?.family ?? detectModelFamily(entry);
      return {
        id: entry.id.trim(),
        label: resolveModelLabel(entry),
        family,
        logoPresetKey: typeof entry.logoPresetKey === 'string' && entry.logoPresetKey.trim() ? entry.logoPresetKey.trim() : null,
        detail: buildCapabilityDetail(entry, presentation),
        badge: presentation?.badge ?? null,
        tier: presentation?.tier ?? 'other',
        reasoning: Boolean(entry.reasoning),
        supportsImageInput: Boolean(entry.input?.includes('image')),
        contextWindow: typeof entry.contextWindow === 'number' ? entry.contextWindow : null,
      };
    })
    .sort((left, right) => {
      const leftProfile = MODEL_PROFILE_RULES.find((rule) => rule.profile.label === left.label)?.profile ?? null;
      const rightProfile = MODEL_PROFILE_RULES.find((rule) => rule.profile.label === right.label)?.profile ?? null;
      const profileDelta = (leftProfile?.order ?? Number.MAX_SAFE_INTEGER) - (rightProfile?.order ?? Number.MAX_SAFE_INTEGER);
      if (profileDelta !== 0) {
        return profileDelta;
      }
      const tierDelta = MODEL_TIER_ORDER[left.tier] - MODEL_TIER_ORDER[right.tier];
      if (tierDelta !== 0) {
        return tierDelta;
      }
      const familyDelta = MODEL_FAMILY_ORDER[left.family] - MODEL_FAMILY_ORDER[right.family];
      if (familyDelta !== 0) {
        return familyDelta;
      }
      if (left.reasoning !== right.reasoning) {
        return left.reasoning ? -1 : 1;
      }
      return left.label.localeCompare(right.label, 'zh-CN');
    });
}

export function matchesComposerModelId(optionId: string, modelId: string | null | undefined): boolean {
  const normalizedOptionId = optionId.trim();
  const normalizedModelId = modelId?.trim();
  if (!normalizedOptionId || !normalizedModelId) {
    return false;
  }
  if (normalizedOptionId === normalizedModelId) {
    return true;
  }
  const optionTail = normalizedOptionId.split('/').pop() || normalizedOptionId;
  const modelTail = normalizedModelId.split('/').pop() || normalizedModelId;
  return optionTail === modelTail;
}

export function findComposerModelOption(
  options: ComposerModelOption[],
  modelId: string | null | undefined,
): ComposerModelOption | null {
  const normalized = modelId?.trim();
  if (!normalized) {
    return null;
  }
  return options.find((option) => matchesComposerModelId(option.id, normalized)) ?? null;
}
