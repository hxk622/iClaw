import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MEMORY_LANCEDB_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_MEMORY_LANCEDB_API_KEY_PLACEHOLDER = 'iclaw-memory-local';
const DEFAULT_PROVIDER_MODEL_CONTEXT_WINDOW = 131072;
const DEFAULT_PROVIDER_MODEL_MAX_TOKENS = 8192;

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

function normalizePositiveModelLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function extractResolvedProviderConfig(snapshot) {
  const rootConfig = asObject(snapshot?.config);
  const modelProvider = asObject(rootConfig.model_provider);
  const profile = asObject(modelProvider.profile);
  const providerKey = trimString(profile.provider_key || profile.providerKey);
  if (!providerKey) {
    return null;
  }
  const models = asArray(modelProvider.models)
    .map((item) => asObject(item))
    .map((entry) => ({
      modelRef: trimString(entry.model_ref || entry.modelRef),
      modelId: trimString(entry.model_id || entry.modelId),
      label: trimString(entry.label),
      reasoning: asBool(entry.reasoning),
      input: asArray(entry.input_modalities || entry.inputModalities).filter((value) => typeof value === 'string'),
      contextWindow: normalizePositiveModelLimit(
        Number.isFinite(entry.context_window) ? Number(entry.context_window) : entry.contextWindow,
        DEFAULT_PROVIDER_MODEL_CONTEXT_WINDOW,
      ),
      maxTokens: normalizePositiveModelLimit(
        Number.isFinite(entry.max_tokens) ? Number(entry.max_tokens) : entry.maxTokens,
        DEFAULT_PROVIDER_MODEL_MAX_TOKENS,
      ),
      enabled: asBool(entry.enabled, true),
    }))
    .filter((entry) => entry.enabled && entry.modelRef && entry.modelId);
  return {
    providerKey,
    providerLabel: trimString(profile.provider_label || profile.providerLabel) || providerKey,
    apiProtocol: trimString(profile.api_protocol || profile.apiProtocol) || 'openai-completions',
    baseUrl: trimString(profile.base_url || profile.baseUrl),
    apiKey: trimString(profile.api_key || profile.apiKey),
    authMode: trimString(profile.auth_mode || profile.authMode) || 'bearer',
    models,
  };
}

function replaceProviderModels(provider, entries) {
  provider.models = entries
    .map((entry) => ({
      id: entry.modelId,
      name: entry.label || entry.modelId,
      reasoning: Boolean(entry.reasoning),
      input: Array.isArray(entry.input) ? entry.input : [],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: normalizePositiveModelLimit(entry.contextWindow, DEFAULT_PROVIDER_MODEL_CONTEXT_WINDOW),
      maxTokens: normalizePositiveModelLimit(entry.maxTokens, DEFAULT_PROVIDER_MODEL_MAX_TOKENS),
    }))
    .filter((entry) => entry.id);
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
  const resolvedProviderConfig = extractResolvedProviderConfig(portalRuntimeSnapshot);
  if (!resolvedProviderConfig?.providerKey) {
    throw new Error('Missing resolved model provider config. Configure Model Center before launching OpenClaw.');
  }
  if (!Array.isArray(resolvedProviderConfig.models) || resolvedProviderConfig.models.length === 0) {
    throw new Error(`Resolved provider "${resolvedProviderConfig.providerKey}" has no enabled models. Configure Model Center before launching OpenClaw.`);
  }
  const normalizedApiKey = trimString(runtimeConfig.openai_api_key);
  const normalizedBaseUrl = normalizeOpenaiBaseUrl(runtimeConfig.openai_base_url);
  const activeModelRef = resolvedProviderConfig.models[0]?.modelRef || '';
  const activeModelId = activeModelRef ? activeModelRef.split('/').pop() : '';
  const allowlistModelRefs = resolvedProviderConfig.models.map((entry) => entry.modelRef).filter(Boolean);
  const mergedAllowedOrigins = parseAllowedOrigins(mode, process.env.ICLAW_OPENCLAW_ALLOWED_ORIGINS);
  const embeddingBaseUrl = normalizeOpenaiBaseUrl(resolvedProviderConfig?.baseUrl || normalizedBaseUrl);
  const embeddingApiKey = trimString(resolvedProviderConfig?.apiKey || normalizedApiKey);
  const memoryAutoRecallEnabled = baseUrlSupportsEmbeddings(embeddingBaseUrl);

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
  const providers = {};

  const resolvedProvider = {};
  resolvedProvider.api = resolvedProviderConfig.apiProtocol || 'openai-completions';
  resolvedProvider.authHeader = resolvedProviderConfig.authMode !== 'query';
  if (resolvedProviderConfig.baseUrl) {
    resolvedProvider.baseUrl = resolvedProviderConfig.baseUrl;
  }
  if (resolvedProviderConfig.apiKey) {
    resolvedProvider.apiKey = resolvedProviderConfig.apiKey;
  }
  replaceProviderModels(resolvedProvider, resolvedProviderConfig.models.map((entry) => ({
    modelId: entry.modelId,
    label: entry.label || entry.modelId,
    reasoning: entry.reasoning,
    input: entry.input,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  })));
  providers[resolvedProviderConfig.providerKey] = resolvedProvider;
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
    embedding.apiKey = embeddingApiKey || DEFAULT_MEMORY_LANCEDB_API_KEY_PLACEHOLDER;
  }
  if (!trimString(embedding.model)) {
    embedding.model = DEFAULT_MEMORY_LANCEDB_EMBEDDING_MODEL;
  }
  if (embeddingBaseUrl) {
    embedding.baseUrl = embeddingBaseUrl;
  }
  memoryPluginConfig.autoRecall = memoryAutoRecallEnabled;
  memoryPluginConfig.autoCapture = false;
  plugins.slots = slots;
  plugins.entries = entries;
  config.plugins = plugins;

  writeJson(configPath, config);
}

main();
