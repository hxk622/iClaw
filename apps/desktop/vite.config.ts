import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const desktopNodeModules = path.resolve(__dirname, './node_modules');
const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
const resourcesDir = path.resolve(__dirname, '../../services/openclaw/resources');

const workspaceFiles = {
  identity_md: 'IDENTITY.md',
  user_md: 'USER.md',
  soul_md: 'SOUL.md',
  agents_md: 'AGENTS.md',
  finance_decision_framework_md: 'FINANCE_DECISION_FRAMEWORK.md',
} as const;

type WorkspaceFileKey = keyof typeof workspaceFiles;

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
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, 'IDENTITY.md'), String(payload.identity_md ?? ''), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'USER.md'), String(payload.user_md ?? ''), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'SOUL.md'), String(payload.soul_md ?? ''), 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), String(payload.agents_md ?? ''), 'utf8');
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

function workspaceDevPlugin() {
  return {
    name: 'iclaw-workspace-dev-plugin',
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
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

export default defineConfig({
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react(), tailwindcss(), workspaceDevPlugin()],
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
});
