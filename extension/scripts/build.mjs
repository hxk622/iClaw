import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const publicDir = resolve(root, 'public');
const distDir = resolve(root, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });
await writeFile(resolve(distDir, 'BUILD_ENV'), 'extension\n');
await mkdir(dirname(resolve(distDir, 'build-meta.json')), { recursive: true });
await writeFile(
  resolve(distDir, 'build-meta.json'),
  JSON.stringify({
    name: '@iclaw/extension',
    builtAt: new Date().toISOString(),
  }, null, 2),
);
console.log(`[extension] built -> ${distDir}`);
