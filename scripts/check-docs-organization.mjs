import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, 'docs');

const expectedRootFiles = new Set(['README.md']);
const requiredReadmeDirs = [
  'architecture',
  'design',
  'plans',
  'standards',
  'release',
  'reference',
  'ops',
  'archive',
  'prd',
  'version_record',
];

const absolutePathPatterns = [
  /\/Users\/xingkaihan\/Documents\/Code\/iClaw\/docs\//g,
  /\/D:\/code\/iClaw\/docs\//g,
];

async function listRootFiles() {
  const entries = await readdir(docsRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

async function assertRootFiles() {
  const files = await listRootFiles();
  const unexpected = files.filter((file) => !expectedRootFiles.has(file));
  if (unexpected.length) {
    throw new Error(`docs root contains unexpected files: ${unexpected.join(', ')}`);
  }
}

async function assertReadmes() {
  for (const dir of requiredReadmeDirs) {
    const entries = await readdir(path.join(docsRoot, dir)).catch(() => null);
    if (!entries) {
      throw new Error(`missing docs directory: ${dir}`);
    }
    if (!entries.includes('README.md')) {
      throw new Error(`missing README.md in docs/${dir}`);
    }
  }
}

async function walkMarkdownFiles(rootDir) {
  const result = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.obsidian') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.canvas'))) {
        result.push(fullPath);
      }
    }
  }
  return result.sort();
}

async function assertNoAbsoluteDocPaths() {
  const files = await walkMarkdownFiles(docsRoot);
  const offenders = [];
  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    if (absolutePathPatterns.some((pattern) => pattern.test(raw))) {
      offenders.push(path.relative(repoRoot, file));
    }
  }
  if (offenders.length) {
    throw new Error(`docs contain absolute local paths: ${offenders.join(', ')}`);
  }
}

async function main() {
  await assertRootFiles();
  await assertReadmes();
  await assertNoAbsoluteDocPaths();
  console.log('docs organization check passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
