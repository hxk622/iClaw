import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../../../../..');
const packagedManifestPath = path.join(moduleDir, 'packaged-plugins-manifest.json');
const repoManifestPath = path.join(repoRoot, 'plugins', 'manifest.json');

function ensureObject(value, errorMessage) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value;
}

function resolveSourceBaseDir(manifestPath) {
  if (manifestPath) {
    return path.dirname(path.resolve(manifestPath));
  }
  if (fs.existsSync(repoManifestPath)) {
    return repoRoot;
  }
  return moduleDir;
}

function normalizeSource(rawSource, pluginId, sourceBaseDir) {
  const source = ensureObject(rawSource, `Plugin "${pluginId}" is missing a valid source object`);
  const type = String(source.type || '').trim();
  if (!type) {
    throw new Error(`Plugin "${pluginId}" is missing source.type`);
  }

  if (type === 'git') {
    const repository = String(source.repository || '').trim();
    const ref = String(source.ref || source.version || '').trim();
    if (!repository || !ref) {
      throw new Error(`Plugin "${pluginId}" git source requires repository and ref/version`);
    }
    return { type, repository, ref };
  }

  if (type === 'path') {
    const targetPath = String(source.path || '').trim();
    if (!targetPath) {
      throw new Error(`Plugin "${pluginId}" path source requires path`);
    }
    return { type, path: path.resolve(sourceBaseDir, targetPath) };
  }

  if (type === 'npm') {
    const spec =
      String(source.spec || '').trim() ||
      (() => {
        const name = String(source.name || '').trim();
        const version = String(source.version || '').trim();
        return name && version ? `${name}@${version}` : '';
      })();
    if (!spec) {
      throw new Error(`Plugin "${pluginId}" npm source requires spec or name+version`);
    }
    return { type, spec };
  }

  throw new Error(`Plugin "${pluginId}" has unsupported source.type "${type}"`);
}

function normalizeEntry(rawEntry) {
  if (rawEntry == null) {
    return { enabled: false };
  }
  const entry = ensureObject(rawEntry, 'Plugin entry must be an object');
  const normalized = {};
  if (typeof entry.enabled === 'boolean') {
    normalized.enabled = entry.enabled;
  }
  if (entry.config !== undefined) {
    normalized.config = ensureObject(entry.config, 'Plugin entry config must be an object');
  }
  return normalized;
}

export function resolvePackagedPluginsManifestPath(env = process.env) {
  const override = String(env.ICLAW_PACKAGED_PLUGINS_MANIFEST_PATH || '').trim();
  if (override) {
    return path.resolve(override);
  }
  if (fs.existsSync(packagedManifestPath)) {
    return packagedManifestPath;
  }
  return repoManifestPath;
}

export function loadPackagedPlugins({ manifestPath, env = process.env } = {}) {
  const resolvedManifestPath = manifestPath || resolvePackagedPluginsManifestPath(env);
  if (!fs.existsSync(resolvedManifestPath)) {
    return [];
  }

  const sourceBaseDir = resolveSourceBaseDir(resolvedManifestPath);
  const parsed = JSON.parse(fs.readFileSync(resolvedManifestPath, 'utf8'));
  const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
  return plugins.map((rawPlugin, index) => {
    const plugin = ensureObject(rawPlugin, `Plugin record at index ${index} must be an object`);
    const id = String(plugin.id || '').trim();
    if (!id) {
      throw new Error(`Plugin record at index ${index} is missing id`);
    }
    return {
      id,
      source: normalizeSource(plugin.source, id, sourceBaseDir),
      entry: normalizeEntry(plugin.entry),
    };
  });
}

export function buildPackagedPluginEntries(packagedPlugins) {
  const entries = {};
  for (const plugin of packagedPlugins) {
    const entry = {};
    if (typeof plugin.entry.enabled === 'boolean') {
      entry.enabled = plugin.entry.enabled;
    }
    if (plugin.entry.config && Object.keys(plugin.entry.config).length > 0) {
      entry.config = plugin.entry.config;
    }
    if (Object.keys(entry).length > 0) {
      entries[plugin.id] = entry;
    }
  }
  return entries;
}
