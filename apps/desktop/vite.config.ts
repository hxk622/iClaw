import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadBrandProfile, resolveBrandId } from '../../scripts/lib/brand-profile-core.mjs';

const desktopNodeModules = path.resolve(__dirname, './node_modules');
const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
const resourcesDir = path.resolve(__dirname, '../../services/openclaw/resources');
const skillsDir = path.resolve(__dirname, '../../skills');
const CONTROL_UI_BOOTSTRAP_CONFIG_PATH = '/__openclaw/control-ui-config.json';

const workspaceFiles = {
  identity_md: 'IDENTITY.md',
  user_md: 'USER.md',
  soul_md: 'SOUL.md',
  agents_md: 'AGENTS.md',
  finance_decision_framework_md: 'FINANCE_DECISION_FRAMEWORK.md',
} as const;

type WorkspaceFileKey = keyof typeof workspaceFiles;

type BundledSkillCatalogItem = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  license: string | null;
  homepage: string | null;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string | null;
  distribution: string | null;
  path: string;
  source: 'bundled';
};

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

function parseFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith('---\n')) {
    return {};
  }

  const closingIndex = raw.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return {};
  }

  const frontmatter = raw.slice(4, closingIndex).split('\n');
  const values: Record<string, string> = {};
  let blockKey: string | null = null;
  let blockLines: string[] = [];

  for (const line of frontmatter) {
    if (blockKey) {
      if (/^\s/.test(line) || !line.trim()) {
        blockLines.push(line.replace(/^\s+/, ''));
        continue;
      }
      values[blockKey] = blockLines.join('\n').trim();
      blockKey = null;
      blockLines = [];
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;
    if (value === '|' || value === '>') {
      blockKey = key;
      blockLines = [];
      continue;
    }
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }

  if (blockKey) {
    values[blockKey] = blockLines.join('\n').trim();
  }

  return values;
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  const normalized = value.replace(/^\[/, '').replace(/\]$/, '');
  return normalized
    .split(',')
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

async function loadBundledSkillsCatalog(): Promise<BundledSkillCatalogItem[]> {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const items = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        try {
          const raw = await fs.readFile(skillMdPath, 'utf8');
          const frontmatter = parseFrontmatter(raw);
          const name = frontmatter.name?.trim();
          const description = frontmatter.description?.trim();

          if (!name || !description) {
            return null;
          }

          return {
            slug: (frontmatter.slug || entry.name).trim(),
            name,
            description,
            tags: parseTags(frontmatter.tags),
            license: frontmatter.license?.trim() || null,
            homepage: frontmatter.homepage?.trim() || null,
            market: frontmatter.market?.trim() || null,
            category: frontmatter.category?.trim() || null,
            skill_type: frontmatter.skill_type?.trim() || null,
            publisher: frontmatter.publisher?.trim() || null,
            distribution: frontmatter.distribution?.trim() || null,
            path: skillMdPath,
            source: 'bundled',
          } satisfies BundledSkillCatalogItem;
        } catch {
          return null;
        }
      }),
  );

  return items
    .filter((item): item is BundledSkillCatalogItem => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
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

        if (req.url?.startsWith('/__iclaw/bundled-skills')) {
          try {
            if (req.method !== 'GET') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            const payload = await loadBundledSkillsCatalog();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'skills endpoint failed' }));
            return;
          }
        }

        if (!req.url?.startsWith('/__iclaw/workspace-files')) {
          next();
          return;
        }

        try {
          if (req.method === 'GET') {
            const payload = await loadWorkspacePayload();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return;
          }

          if (req.method === 'POST') {
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

          res.statusCode = 405;
          res.end('Method Not Allowed');
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'workspace endpoint failed' }));
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
