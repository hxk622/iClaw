export type GatewayModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
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
  | 'deepseek'
  | 'kimi'
  | 'mistral'
  | 'llama'
  | 'generic';

export type ComposerModelOption = {
  id: string;
  label: string;
  family: ModelFamily;
  detail: string;
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
  deepseek: 60,
  kimi: 70,
  mistral: 80,
  llama: 90,
  generic: 999,
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
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
  const source = `${provider} ${normalizeText(entry.id)} ${normalizeText(entry.name)}`;

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
  if (provider === 'deepseek' || source.includes('deepseek')) {
    return 'deepseek';
  }
  if (provider === 'moonshot' || source.includes('kimi')) {
    return 'kimi';
  }
  if (provider === 'mistral' || source.includes('mistral')) {
    return 'mistral';
  }
  if (provider === 'meta' || provider === 'ollama' || source.includes('llama')) {
    return 'llama';
  }
  return 'generic';
}

export function resolveModelLabel(entry: GatewayModelCatalogEntry): string {
  const preferred = entry.name?.trim();
  if (preferred) {
    return preferred;
  }
  return prettifyModelName(entry.id);
}

function buildCapabilityDetail(entry: GatewayModelCatalogEntry): string {
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
      const family = detectModelFamily(entry);
      return {
        id: entry.id.trim(),
        label: resolveModelLabel(entry),
        family,
        detail: buildCapabilityDetail(entry),
        reasoning: Boolean(entry.reasoning),
        supportsImageInput: Boolean(entry.input?.includes('image')),
        contextWindow: typeof entry.contextWindow === 'number' ? entry.contextWindow : null,
      };
    })
    .sort((left, right) => {
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

export function findComposerModelOption(
  options: ComposerModelOption[],
  modelId: string | null | undefined,
): ComposerModelOption | null {
  const normalized = modelId?.trim();
  if (!normalized) {
    return null;
  }
  return options.find((option) => option.id === normalized) ?? null;
}
