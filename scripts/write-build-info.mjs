#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveDirtyFlag() {
  const statusOutput = runGit(['status', '--short', '--untracked-files=all']);
  if (!statusOutput) {
    return false;
  }
  const relevantLines = statusOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes('.omx/'));
  return relevantLines.length > 0;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPathArg = (args.out || '').trim();
  if (!outputPathArg) {
    throw new Error('Missing required --out <path>');
  }

  const packagePathArg = (args.package || '').trim();
  const component = (args.component || '').trim() || null;
  const buildTime = (process.env.ICLAW_BUILD_TIME || args['build-time'] || '').trim() || new Date().toISOString();
  const releaseVersionOverride = (process.env.ICLAW_RELEASE_VERSION || args['release-version'] || '').trim();
  const gitCommitOverride = (process.env.ICLAW_GIT_COMMIT || args['git-commit'] || '').trim();
  const gitTagOverride = (process.env.ICLAW_GIT_TAG || args['git-tag'] || '').trim();

  const resolvedOutputPath = path.resolve(repoRoot, outputPathArg);
  const resolvedPackagePath = packagePathArg ? path.resolve(repoRoot, packagePathArg) : null;
  const packageJson = resolvedPackagePath ? await readJson(resolvedPackagePath) : null;
  const rootPackageJson = await readJson(path.join(repoRoot, 'package.json'));

  const gitCommit = gitCommitOverride || runGit(['rev-parse', 'HEAD']) || null;
  const gitTag = gitTagOverride || runGit(['describe', '--tags', '--exact-match']) || null;
  const dirty = resolveDirtyFlag();
  const releaseVersion =
    releaseVersionOverride ||
    (typeof rootPackageJson.releaseVersion === 'string' && rootPackageJson.releaseVersion.trim()) ||
    (typeof rootPackageJson.version === 'string' && rootPackageJson.version.trim()) ||
    null;

  const payload = {
    git_commit: gitCommit,
    git_tag: gitTag,
    release_version: releaseVersion,
    build_time: buildTime,
    component,
    package_name: typeof packageJson?.name === 'string' ? packageJson.name : null,
    package_version: typeof packageJson?.version === 'string' ? packageJson.version : null,
    dirty,
  };

  await fs.mkdir(path.dirname(resolvedOutputPath), {recursive: true});
  await fs.writeFile(resolvedOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${resolvedOutputPath}\n`);
}

await main();
