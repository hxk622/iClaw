import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function candidateSourceDirs(rootDir, env = process.env) {
  const explicit = trimString(env.OPENCLAW_SOURCE_DIR || env.ICLAW_OPENCLAW_SOURCE_DIR);
  const sibling = path.resolve(rootDir, '..', 'openclaw');
  const vendored = path.join(rootDir, 'services', 'openclaw', 'runtime', 'openclaw');
  return [explicit, sibling, vendored].filter(Boolean);
}

export function resolveOpenclawSourceDir(rootDir, env = process.env) {
  return (
    candidateSourceDirs(rootDir, env).find((candidate) => {
      const packageJsonPath = path.join(candidate, 'package.json');
      const entryPath = path.join(candidate, 'openclaw.mjs');
      return fs.existsSync(packageJsonPath) && fs.existsSync(entryPath);
    }) || ''
  );
}

export function readOpenclawSourceVersion(sourceDir) {
  const normalizedDir = trimString(sourceDir);
  if (!normalizedDir) {
    return '';
  }
  try {
    const raw = fs.readFileSync(path.join(normalizedDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return trimString(parsed?.version);
  } catch {
    return '';
  }
}
