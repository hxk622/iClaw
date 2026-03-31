import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadBrandProfile, resolveBrandId } from '../../scripts/lib/brand-profile-core.mjs';

const desktopNodeModules = path.resolve(__dirname, './node_modules');
const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
const workspaceMemoryDir = path.join(workspaceDir, 'memory');
const workspaceMemoryArchiveDir = path.join(workspaceDir, '.iclaw-memory-archive');
const memoryDbPath = path.join(os.homedir(), '.openclaw', 'memory', 'main.sqlite');
const resourcesDir = path.resolve(__dirname, '../../services/openclaw/resources');
const CONTROL_UI_BOOTSTRAP_CONFIG_PATH = '/__openclaw/control-ui-config.json';
const MEMORY_DEV_ENDPOINT = '/__iclaw/memory';

const workspaceFiles = {
  identity_md: 'IDENTITY.md',
  user_md: 'USER.md',
  soul_md: 'SOUL.md',
  agents_md: 'AGENTS.md',
  finance_decision_framework_md: 'FINANCE_DECISION_FRAMEWORK.md',
} as const;

type WorkspaceFileKey = keyof typeof workspaceFiles;

type DevMemoryEntry = {
  id: string;
  title: string;
  summary: string;
  content: string;
  domain: string;
  type: string;
  importance: string;
  sourceType: string;
  sourceLabel: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastRecalledAt: string | null;
  recallCount: number;
  captureConfidence: number;
  indexHealth: string;
  status: string;
  active: boolean;
};

type DevMemoryRuntimeStatus = {
  backend: string;
  files: number;
  chunks: number;
  dirty: boolean;
  workspaceDir: string;
  memoryDir: string;
  dbPath: string | null;
  provider: string | null;
  model: string | null;
  sourceCounts: Array<Record<string, unknown>>;
  scanTotalFiles: number;
  scanIssues: string[];
  ftsAvailable: boolean | null;
  ftsError: string | null;
  vectorAvailable: boolean | null;
  vectorError: string | null;
  embeddingConfigured: boolean;
  configuredScope: string | null;
  configuredProvider: string | null;
  configuredModel: string | null;
};

type DevMemorySnapshot = {
  entries: DevMemoryEntry[];
  runtimeStatus: DevMemoryRuntimeStatus;
  runtimeError: string | null;
  memoryDir: string;
  archiveDir: string;
};

function sanitizeMemoryScalar(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

function currentMemoryTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function deriveMemoryTitle(filePath: string, content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
    return trimmed;
  }
  return path.basename(filePath, '.md') || 'untitled-memory';
}

function deriveMemorySummary(content: string, fallback: string): string {
  const normalized = content.split(/\s+/).filter(Boolean).join(' ');
  return normalized ? normalized.slice(0, 58) : fallback;
}

function parseMemoryMetaMap(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    map[key] = value;
  }
  return map;
}

async function parseMemoryEntryFromFile(filePath: string): Promise<DevMemoryEntry> {
  const raw = await fs.readFile(filePath, 'utf8');
  let meta: Record<string, string> = {};
  let content = raw.trim();

  if (raw.startsWith('---\n')) {
    const end = raw.indexOf('\n---\n', 4);
    if (end >= 0) {
      meta = parseMemoryMetaMap(raw.slice(4, end));
      content = raw.slice(end + 5).trim();
    }
  }

  const stat = await fs.stat(filePath);
  const modified = String(Math.floor(stat.mtimeMs / 1000));
  const title = meta.title?.trim() || deriveMemoryTitle(filePath, content);
  const summary = deriveMemorySummary(content, title);
  const id = meta.id?.trim() || path.basename(filePath, '.md') || `memory-${currentMemoryTimestamp()}`;
  const tags = (meta.tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const parseNumber = (key: string, fallback: number) => {
    const value = Number(meta[key] || '0');
    return Number.isFinite(value) ? value : fallback;
  };
  const parseFlag = (key: string, fallback: boolean) => {
    if (!(key in meta)) return fallback;
    return ['true', '1', 'yes'].includes(String(meta[key]).toLowerCase());
  };

  return {
    id,
    title,
    summary,
    content,
    domain: meta.domain || '其他',
    type: meta.type || '事实',
    importance: meta.importance || '中',
    sourceType: meta.sourceType || '手动创建',
    sourceLabel: meta.sourceLabel || filePath,
    tags,
    createdAt: meta.createdAt || modified,
    updatedAt: meta.updatedAt || modified,
    lastRecalledAt: meta.lastRecalledAt?.trim() ? meta.lastRecalledAt.trim() : null,
    recallCount: parseNumber('recallCount', 0),
    captureConfidence: parseNumber('captureConfidence', 1),
    indexHealth: meta.indexHealth || '待刷新',
    status: meta.status || '已确认',
    active: parseFlag('active', true),
  };
}

async function collectMemoryMarkdownFiles(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectMemoryMarkdownFiles(nextPath, files);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith('.md')) {
        files.push(nextPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return files;
}

async function loadMemoryEntries(): Promise<DevMemoryEntry[]> {
  const files = await collectMemoryMarkdownFiles(workspaceMemoryDir);
  const entries = await Promise.all(files.map((filePath) => parseMemoryEntryFromFile(filePath)));
  return entries.filter((entry) => entry.active).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function serializeMemoryEntryMarkdown(entry: DevMemoryEntry): string {
  const lastRecalledAt = entry.lastRecalledAt || '';
  const tags = entry.tags.join(', ');
  return [
    '---',
    `id: ${sanitizeMemoryScalar(entry.id)}`,
    `title: ${sanitizeMemoryScalar(entry.title)}`,
    `domain: ${sanitizeMemoryScalar(entry.domain)}`,
    `type: ${sanitizeMemoryScalar(entry.type)}`,
    `importance: ${sanitizeMemoryScalar(entry.importance)}`,
    `sourceType: ${sanitizeMemoryScalar(entry.sourceType)}`,
    `sourceLabel: ${sanitizeMemoryScalar(entry.sourceLabel)}`,
    `tags: ${sanitizeMemoryScalar(tags)}`,
    `status: ${sanitizeMemoryScalar(entry.status)}`,
    `createdAt: ${sanitizeMemoryScalar(entry.createdAt)}`,
    `updatedAt: ${sanitizeMemoryScalar(entry.updatedAt)}`,
    `lastRecalledAt: ${sanitizeMemoryScalar(lastRecalledAt)}`,
    `recallCount: ${entry.recallCount}`,
    `captureConfidence: ${entry.captureConfidence}`,
    `indexHealth: ${sanitizeMemoryScalar(entry.indexHealth)}`,
    `active: ${entry.active ? 'true' : 'false'}`,
    '---',
    entry.content.trim(),
    '',
  ].join('\n');
}

async function saveMemoryEntryPayload(rawEntry: unknown): Promise<DevMemoryEntry> {
  const entry = rawEntry as Partial<DevMemoryEntry>;
  const now = currentMemoryTimestamp();
  const normalized: DevMemoryEntry = {
    id: String(entry.id || '').trim() || `memory-${now}`,
    title: sanitizeMemoryScalar(String(entry.title || '新记忆')) || '新记忆',
    summary: '',
    content: typeof entry.content === 'string' ? entry.content : '',
    domain: String(entry.domain || '其他'),
    type: String(entry.type || '事实'),
    importance: String(entry.importance || '中'),
    sourceType: String(entry.sourceType || '手动创建'),
    sourceLabel: String(entry.sourceLabel || '浏览器调试'),
    tags: Array.isArray(entry.tags) ? entry.tags.map((item) => String(item).trim()).filter(Boolean) : [],
    createdAt: String(entry.createdAt || now),
    updatedAt: String(entry.updatedAt || now),
    lastRecalledAt: entry.lastRecalledAt ? String(entry.lastRecalledAt) : null,
    recallCount: Number(entry.recallCount || 0),
    captureConfidence: Number(entry.captureConfidence || 1),
    indexHealth: String(entry.indexHealth || '待刷新'),
    status: String(entry.status || '待检查'),
    active: entry.active !== false,
  };
  normalized.summary = deriveMemorySummary(normalized.content, normalized.title);

  await fs.mkdir(workspaceMemoryDir, { recursive: true });
  await fs.writeFile(
    path.join(workspaceMemoryDir, `${normalized.id}.md`),
    serializeMemoryEntryMarkdown(normalized),
    'utf8',
  );
  return normalized;
}

async function deleteMemoryEntryPayload(id: unknown): Promise<boolean> {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return true;
  const targets = [
    path.join(workspaceMemoryDir, `${normalizedId}.md`),
    path.join(workspaceMemoryArchiveDir, `${normalizedId}.md`),
  ];
  for (const target of targets) {
    try {
      await fs.rm(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return true;
}

async function archiveMemoryEntryPayload(id: unknown): Promise<boolean> {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return true;
  const source = path.join(workspaceMemoryDir, `${normalizedId}.md`);
  const target = path.join(workspaceMemoryArchiveDir, `${normalizedId}.md`);
  try {
    await fs.mkdir(workspaceMemoryArchiveDir, { recursive: true });
    await fs.rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return true;
}

async function loadMemorySnapshotPayload(): Promise<DevMemorySnapshot> {
  const entries = await loadMemoryEntries();
  let dbPath: string | null = null;
  try {
    await fs.access(memoryDbPath);
    dbPath = memoryDbPath;
  } catch {
    dbPath = null;
  }
  const sourceCounts = Array.from(
    entries.reduce((acc, entry) => {
      acc.set(entry.sourceType, (acc.get(entry.sourceType) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  ).map(([sourceType, count]) => ({ sourceType, count }));

  return {
    entries,
    runtimeStatus: {
      backend: 'builtin',
      files: entries.length,
      chunks: 0,
      dirty: entries.some((entry) => entry.indexHealth !== '健康'),
      workspaceDir: workspaceDir,
      memoryDir: workspaceMemoryDir,
      dbPath,
      provider: null,
      model: null,
      sourceCounts,
      scanTotalFiles: entries.length,
      scanIssues: [],
      ftsAvailable: null,
      ftsError: null,
      vectorAvailable: null,
      vectorError: null,
      embeddingConfigured: false,
      configuredScope: null,
      configuredProvider: null,
      configuredModel: null,
    },
    runtimeError: null,
    memoryDir: workspaceMemoryDir,
    archiveDir: workspaceMemoryArchiveDir,
  };
}

async function readWorkspaceFile(key: WorkspaceFileKey): Promise<string> {
  const filename = workspaceFiles[key];
  const workspacePath = path.join(workspaceDir, filename);
  const fallbackPath = path.join(resourcesDir, filename);
  try {
    return await fs.readFile(workspacePath, 'utf8');
  } catch {
    return fs.readFile(fallbackPath, 'utf8');
  }
}

async function loadWorkspacePayload() {
  const payload = {
    workspace_dir: workspaceDir,
    identity_md: await readWorkspaceFile('identity_md'),
    user_md: await readWorkspaceFile('user_md'),
    soul_md: await readWorkspaceFile('soul_md'),
    agents_md: await readWorkspaceFile('agents_md'),
    finance_decision_framework_md: await readWorkspaceFile('finance_decision_framework_md'),
  };
  return payload;
}

async function writeWorkspacePayload(body: unknown) {
  const payload = (body || {}) as {
    identity_md?: unknown;
    user_md?: unknown;
    soul_md?: unknown;
    agents_md?: unknown;
  };
  const current = await loadWorkspacePayload();
  const next = {
    identity_md: payload.identity_md ?? current.identity_md,
    user_md: payload.user_md ?? current.user_md,
    soul_md: payload.soul_md ?? current.soul_md,
    agents_md: payload.agents_md ?? current.agents_md,
  };
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, 'IDENTITY.md'), String(next.identity_md), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'USER.md'), String(next.user_md), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'SOUL.md'), String(next.soul_md), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), String(next.agents_md), 'utf8');
  const financePath = path.join(workspaceDir, 'FINANCE_DECISION_FRAMEWORK.md');
  try {
    await fs.access(financePath);
  } catch {
    await fs.writeFile(
      financePath,
      await fs.readFile(path.join(resourcesDir, 'FINANCE_DECISION_FRAMEWORK.md'), 'utf8'),
      'utf8',
    );
  }
}

function workspaceDevPlugin(assistantName: string) {
  return {
    name: 'iclaw-workspace-dev-plugin',
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith(CONTROL_UI_BOOTSTRAP_CONFIG_PATH)) {
          try {
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            const payload = {
              basePath: '',
              assistantName,
              assistantAvatar: null,
              assistantAgentId: null,
              serverVersion: null,
            };

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            res.end(JSON.stringify(payload));
            return;
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'bootstrap endpoint failed' }));
            return;
          }
        }

        if (!req.url?.startsWith('/__iclaw/workspace-files')) {
          if (!req.url?.startsWith(MEMORY_DEV_ENDPOINT)) {
            next();
            return;
          }
        }

        try {
          if (req.url?.startsWith('/__iclaw/workspace-files') && req.method === 'GET') {
            const payload = await loadWorkspacePayload();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          }

          if (req.url?.startsWith('/__iclaw/workspace-files') && req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            const body = raw.trim() ? JSON.parse(raw) : {};
            await writeWorkspacePayload(body);
            const payload = await loadWorkspacePayload();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          }

          if (req.url?.startsWith(MEMORY_DEV_ENDPOINT) && req.method === 'GET') {
            const payload = await loadMemorySnapshotPayload();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          }

          if (req.url?.startsWith(MEMORY_DEV_ENDPOINT) && req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            const body = raw.trim() ? JSON.parse(raw) : {};
            const action = String((body as { action?: unknown }).action || 'snapshot');

            if (action === 'save') {
              const entry = await saveMemoryEntryPayload((body as { entry?: unknown }).entry);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(entry));
              return;
            }

            if (action === 'delete') {
              await deleteMemoryEntryPayload((body as { id?: unknown }).id);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(true));
              return;
            }

            if (action === 'archive') {
              await archiveMemoryEntryPayload((body as { id?: unknown }).id);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(true));
              return;
            }

            if (action === 'reindex') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(true));
              return;
            }

            const payload = await loadMemorySnapshotPayload();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          }

          res.statusCode = 405;
          res.end('Method Not Allowed');
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'dev endpoint failed' }));
        }
      });
    },
  };
}

export default defineConfig(async () => {
  const rootDir = path.resolve(__dirname, '../../');
  const brandId = resolveBrandId();
  let assistantName = brandId;

  try {
    const { profile } = await loadBrandProfile({ rootDir, brandId });
    assistantName = profile.displayName || profile.websiteTitle || profile.productName || brandId;
  } catch {
    assistantName = brandId;
  }

  return {
    envDir: rootDir,
    envPrefix: ['VITE_', 'APP_NAME', 'ICLAW_PORTAL_APP_NAME'],
    plugins: [react(), tailwindcss(), workspaceDevPlugin(assistantName)],
    resolve: {
      alias: [
        { find: '@openclaw-ui', replacement: path.resolve(__dirname, '../../../openclaw/ui/src') },
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: /^lit$/, replacement: path.resolve(desktopNodeModules, 'lit/index.js') },
        { find: /^lit\/(.*)$/, replacement: path.resolve(desktopNodeModules, 'lit/$1') },
        {
          find: /^dompurify$/,
          replacement: path.resolve(desktopNodeModules, 'dompurify/dist/purify.es.mjs'),
        },
        {
          find: /^marked$/,
          replacement: path.resolve(desktopNodeModules, 'marked/lib/marked.esm.js'),
        },
        {
          find: /^@noble\/ed25519$/,
          replacement: path.resolve(desktopNodeModules, '@noble/ed25519/index.js'),
        },
      ],
    },
    server: {
      fs: {
        allow: [
          path.resolve(__dirname, '../../'),
          path.resolve(__dirname, '../../../openclaw'),
        ],
      },
    },
  };
});
