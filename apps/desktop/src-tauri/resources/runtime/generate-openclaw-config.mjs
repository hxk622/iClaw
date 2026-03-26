import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MEMORY_LANCEDB_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_MEMORY_LANCEDB_API_KEY_PLACEHOLDER = 'iclaw-memory-local';

const MANAGED_FINANCE_MODEL_PROVIDERS = [
  {
    providerId: 'qwen',
    api: 'openai-completions',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    authHeader: true,
    models: [
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', reasoning: true, input: ['text', 'image'], contextWindow: 131072, maxTokens: 8192 },
      { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus', reasoning: true, input: ['text'], contextWindow: 262144, maxTokens: 8192 },
      { id: 'qwen3-max', name: 'Qwen3 Max', reasoning: true, input: ['text', 'image'], contextWindow: 262144, maxTokens: 8192 },
    ],
  },
  {
    providerId: 'minimax',
    api: 'anthropic-messages',
    baseUrl: 'https://api.minimax.io/anthropic',
    authHeader: true,
    models: [
      { id: 'MiniMax-M2.7', name: 'MiniMax m2.7', reasoning: true, input: ['text'], contextWindow: 200000, maxTokens: 8192 },
      { id: 'MiniMax-M2.5', name: 'MiniMax m2.5', reasoning: true, input: ['text'], contextWindow: 200000, maxTokens: 8192 },
      { id: 'MiniMax-M2.1', name: 'MiniMax m2.1', reasoning: true, input: ['text'], contextWindow: 128000, maxTokens: 8192 },
    ],
  },
  {
    providerId: 'moonshot',
    api: 'openai-completions',
    baseUrl: 'https://api.moonshot.ai/v1',
    authHeader: true,
    models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5', reasoning: false, input: ['text', 'image'], contextWindow: 256000, maxTokens: 8192 }],
  },
  {
    providerId: 'volcengine',
    api: 'openai-completions',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    authHeader: true,
    models: [{ id: 'doubao-seed-2.0-code', name: 'Doubao Seed-2.0-code', reasoning: true, input: ['text'], contextWindow: 128000, maxTokens: 8192 }],
  },
  {
    providerId: 'zai',
    api: 'openai-completions',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    authHeader: true,
    models: [{ id: 'glm-4.7', name: 'GLM 4.7', reasoning: true, input: ['text'], contextWindow: 204800, maxTokens: 131072 }],
  },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function ensureObject(parent, key) {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }
  return parent[key];
}

function readJsonIfExists(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function writeJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeOpenaiBaseUrl(raw) {
  const baseUrl = trimString(raw).replace(/\/+$/, '');
  if (!baseUrl) return '';
  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
}

function sanitizeLegacySkillEntries(root) {
  const skills = root.skills;
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return;
  }
  const entries = skills.entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return;
  }
  for (const [key, value] of Object.entries(entries)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    if ('apiKeys' in value) {
      delete value.apiKeys;
    }
    entries[key] = value;
  }
  skills.entries = entries;
  root.skills = skills;
}

function parseAllowedOrigins(rawMode, rawOrigins) {
  const explicitOrigins = String(rawOrigins || '')
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (explicitOrigins.length > 0) {
    return [...new Set(explicitOrigins)];
  }
  if (rawMode === 'dev') {
    return ['http://127.0.0.1:1520', 'http://localhost:1520'];
  }
  return ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'];
}

function loadPortalRuntimeSnapshot() {
  const snapshotPath = trimString(process.env.ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH);
  const portalRuntimeConfigPath = trimString(process.env.ICLAW_OPENCLAW_PORTAL_RUNTIME_CONFIG_PATH);
  const raw = readJsonIfExists(snapshotPath) ?? readJsonIfExists(portalRuntimeConfigPath);
  if (!raw) {
    return null;
  }
  if (raw.config && typeof raw.config === 'object' && !Array.isArray(raw.config)) {
    return raw;
  }
  return { brandId: trimString(process.env.APP_NAME), publishedVersion: 0, config: raw };
}

function extractOemModelConfig(snapshot) {
  const rootConfig = asObject(snapshot?.config);
  const capabilities = asObject(rootConfig.capabilities);
  const models = asObject(capabilities.models);
  const defaultModelRef = trimString(models.default);
  const entries = asArray(models.entries)
    .map((item) => asObject(item))
    .map((entry) => {
      const modelRef = trimString(entry.ref);
      const providerFromRef = modelRef.includes('/') ? modelRef.split('/')[0].trim() : '';
      const modelFromRef = modelRef.includes('/') ? modelRef.split('/').pop().trim() : modelRef;
      return {
        modelRef,
        providerId: trimString(entry.providerId || entry.provider_id) || providerFromRef,
        modelId: trimString(entry.modelId || entry.model_id) || modelFromRef,
        label: trimString(entry.label) || modelFromRef,
        api: trimString(entry.api) || 'openai-completions',
        baseUrl: trimString(entry.baseUrl || entry.base_url),
        useRuntimeOpenai: asBool(entry.useRuntimeOpenai ?? entry.use_runtime_openai, providerFromRef === 'openai' && !trimString(entry.baseUrl || entry.base_url)),
        authHeader: typeof (entry.authHeader ?? entry.auth_header) === 'boolean' ? Boolean(entry.authHeader ?? entry.auth_header) : true,
        reasoning: asBool(entry.reasoning),
        input: asArray(entry.input).filter((item) => typeof item === 'string'),
        contextWindow: asNumber(entry.contextWindow ?? entry.context_window, 0),
        maxTokens: asNumber(entry.maxTokens ?? entry.max_tokens, 0),
      };
    })
    .filter((entry) => entry.modelRef && entry.providerId && entry.modelId);

  return { defaultModelRef, entries };
}

function upsertManagedProviderModel(provider, model) {
  if (!trimString(model.id)) return;
  if (!Array.isArray(provider.models)) {
    provider.models = [];
  }
  const index = provider.models.findIndex((entry) => entry && typeof entry === 'object' && entry.id === model.id);
  const base = index >= 0 && provider.models[index] && typeof provider.models[index] === 'object' ? provider.models[index] : {};
  const next = {
    ...base,
    id: model.id,
    name: model.name,
    reasoning: Boolean(model.reasoning),
    input: Array.isArray(model.input) ? model.input : [],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: asNumber(model.contextWindow, 0),
    maxTokens: asNumber(model.maxTokens, 0),
  };
  if (index >= 0) {
    provider.models[index] = next;
  } else {
    provider.models.push(next);
  }
}

function ensureManagedProvider(providers, definition) {
  const provider = ensureObject(providers, definition.providerId);
  provider.api = definition.api;
  provider.authHeader = definition.authHeader;
  provider.baseUrl = definition.baseUrl;
  if (typeof provider.apiKey !== 'string') {
    provider.apiKey = '';
  }
  for (const model of definition.models) {
    upsertManagedProviderModel(provider, model);
  }
}

function replaceProviderModels(provider, entries) {
  provider.models = entries
    .map((entry) => ({
      id: entry.modelId,
      name: entry.label || entry.modelId,
      reasoning: Boolean(entry.reasoning),
      input: Array.isArray(entry.input) ? entry.input : [],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: asNumber(entry.contextWindow, 0),
      maxTokens: asNumber(entry.maxTokens, 0),
    }))
    .filter((entry) => entry.id);
}

function upsertManagedOpenAiModel(provider, modelId) {
  if (!trimString(modelId)) return;
  upsertManagedProviderModel(provider, {
    id: modelId,
    name: modelId === 'gpt-5.4' ? 'GPT 5.4' : modelId,
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 272000,
    maxTokens: 128000,
  });
}

function baseUrlSupportsEmbeddings(baseUrl) {
  const normalized = trimString(baseUrl).toLowerCase();
  if (!normalized) return false;
  return !normalized.includes('fast.vpsairobot.com');
}

function main() {
  const configPath = trimString(process.env.ICLAW_OPENCLAW_CONFIG_PATH || process.env.OPENCLAW_CONFIG_PATH);
  const runtimeConfigPath = trimString(process.env.ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH);
  const gatewayToken = trimString(process.env.ICLAW_OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN);
  const workspaceDir = trimString(process.env.ICLAW_OPENCLAW_WORKSPACE_DIR);
  const mode = trimString(process.env.ICLAW_OPENCLAW_RUNTIME_MODE || 'prod').toLowerCase();
  if (!configPath) {
    throw new Error('ICLAW_OPENCLAW_CONFIG_PATH is required');
  }
  if (!gatewayToken) {
    throw new Error('ICLAW_OPENCLAW_GATEWAY_TOKEN is required');
  }

  const config = readJsonIfExists(configPath) ?? {};
  const runtimeConfig = asObject(readJsonIfExists(runtimeConfigPath));
  const portalRuntimeSnapshot = loadPortalRuntimeSnapshot();
  const oemModelConfig = extractOemModelConfig(portalRuntimeSnapshot);
  const normalizedApiKey = trimString(runtimeConfig.openai_api_key);
  const normalizedBaseUrl = normalizeOpenaiBaseUrl(runtimeConfig.openai_base_url);
  const normalizedModel = trimString(runtimeConfig.openai_model);
  const runtimeModelRef = normalizedModel ? (normalizedModel.includes('/') ? normalizedModel : `openai/${normalizedModel}`) : '';
  const activeModelRef = oemModelConfig.defaultModelRef || runtimeModelRef;
  const activeModelId = activeModelRef ? activeModelRef.split('/').pop() : '';
  const allowlistModelRefs = oemModelConfig.entries.length > 0
    ? oemModelConfig.entries.map((entry) => entry.modelRef).filter(Boolean)
    : (activeModelRef ? [activeModelRef] : []);
  const mergedAllowedOrigins = parseAllowedOrigins(mode, process.env.ICLAW_OPENCLAW_ALLOWED_ORIGINS);
  const memoryAutoRecallEnabled = baseUrlSupportsEmbeddings(normalizedBaseUrl);

  sanitizeLegacySkillEntries(config);

  const gateway = ensureObject(config, 'gateway');
  gateway.mode = 'local';
  const auth = ensureObject(gateway, 'auth');
  auth.mode = 'token';
  auth.token = gatewayToken;
  const controlUi = ensureObject(gateway, 'controlUi');
  const existingOrigins = Array.isArray(controlUi.allowedOrigins)
    ? controlUi.allowedOrigins.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : [];
  controlUi.allowedOrigins = [...new Set([...existingOrigins, ...mergedAllowedOrigins])];
  controlUi.allowInsecureAuth = true;
  gateway.controlUi = controlUi;
  config.gateway = gateway;

  const agents = ensureObject(config, 'agents');
  const defaults = ensureObject(agents, 'defaults');
  if (activeModelRef) {
    const existingModel = defaults.model;
    defaults.model = existingModel && typeof existingModel === 'object' && !Array.isArray(existingModel)
      ? { ...existingModel, primary: activeModelRef }
      : { primary: activeModelRef };
  }
  defaults.models = Object.fromEntries(allowlistModelRefs.map((value) => [value, {}]));
  if (workspaceDir) {
    defaults.workspace = workspaceDir;
  }
  defaults.compaction = {
    ...(defaults.compaction && typeof defaults.compaction === 'object' && !Array.isArray(defaults.compaction) ? defaults.compaction : {}),
    mode: 'safeguard',
  };
  defaults.thinkingDefault = 'xhigh';
  defaults.timeoutSeconds = 1800;
  defaults.maxConcurrent = 4;
  defaults.subagents = {
    ...(defaults.subagents && typeof defaults.subagents === 'object' && !Array.isArray(defaults.subagents) ? defaults.subagents : {}),
    maxConcurrent: 8,
  };
  agents.defaults = defaults;
  config.agents = agents;

  const modelsConfig = ensureObject(config, 'models');
  const providers = ensureObject(modelsConfig, 'providers');
  const openaiProvider = ensureObject(providers, 'openai');
  openaiProvider.api = 'openai-completions';
  openaiProvider.authHeader = true;
  if (normalizedBaseUrl) {
    openaiProvider.baseUrl = normalizedBaseUrl;
  }
  if (normalizedApiKey) {
    openaiProvider.apiKey = normalizedApiKey;
  }
  const openaiRuntimeEntries = oemModelConfig.entries.filter((entry) => entry.useRuntimeOpenai);
  if (openaiRuntimeEntries.length > 0) {
    replaceProviderModels(openaiProvider, openaiRuntimeEntries);
  } else if (activeModelId) {
    upsertManagedOpenAiModel(openaiProvider, activeModelId);
  } else if (!Array.isArray(openaiProvider.models)) {
    openaiProvider.models = [];
  }
  providers.openai = openaiProvider;

  if (oemModelConfig.entries.length === 0) {
    for (const provider of MANAGED_FINANCE_MODEL_PROVIDERS) {
      ensureManagedProvider(providers, provider);
    }
  } else {
    const providerIds = [...new Set(oemModelConfig.entries.map((entry) => entry.providerId).filter(Boolean))];
    for (const providerId of providerIds) {
      if (providerId === 'openai') continue;
      const matchingEntries = oemModelConfig.entries.filter((entry) => entry.providerId === providerId);
      if (!matchingEntries.length) continue;
      const provider = ensureObject(providers, providerId);
      provider.api = matchingEntries[0].api || 'openai-completions';
      provider.authHeader = matchingEntries[0].authHeader ?? true;
      if (matchingEntries[0].baseUrl) {
        provider.baseUrl = matchingEntries[0].baseUrl;
      }
      if (typeof provider.apiKey !== 'string') {
        provider.apiKey = '';
      }
      replaceProviderModels(provider, matchingEntries);
      providers[providerId] = provider;
    }
  }
  modelsConfig.providers = providers;
  config.models = modelsConfig;

  const plugins = ensureObject(config, 'plugins');
  const slots = ensureObject(plugins, 'slots');
  slots.memory = 'memory-lancedb';
  const entries = ensureObject(plugins, 'entries');
  const memoryPlugin = ensureObject(entries, 'memory-lancedb');
  const memoryPluginConfig = ensureObject(memoryPlugin, 'config');
  const embedding = ensureObject(memoryPluginConfig, 'embedding');
  if (!trimString(embedding.apiKey)) {
    embedding.apiKey = normalizedApiKey || DEFAULT_MEMORY_LANCEDB_API_KEY_PLACEHOLDER;
  }
  if (!trimString(embedding.model)) {
    embedding.model = DEFAULT_MEMORY_LANCEDB_EMBEDDING_MODEL;
  }
  if (normalizedBaseUrl) {
    embedding.baseUrl = normalizedBaseUrl;
  }
  memoryPluginConfig.autoRecall = memoryAutoRecallEnabled;
  memoryPluginConfig.autoCapture = false;
  plugins.slots = slots;
  plugins.entries = entries;
  config.plugins = plugins;

  writeJson(configPath, config);
}

main();
