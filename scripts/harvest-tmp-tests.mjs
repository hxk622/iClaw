import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpTestsDir = resolve(rootDir, '.tmp-tests');
const archiveRootDir = resolve(rootDir, 'tests/archive/tmp-tests');
const latestRootDir = resolve(archiveRootDir, 'latest');
const snapshotsRootDir = resolve(archiveRootDir, 'snapshots');
const catalogPath = resolve(archiveRootDir, 'catalog.json');
const readmePath = resolve(archiveRootDir, 'README.md');

function toPosixPath(value) {
  return value.split('\\').join('/');
}

function classifyModule(fileName) {
  const lower = fileName.toLowerCase();
  const rules = [
    {module: 'payment', keywords: ['payment', 'billing', 'recharge']},
    {module: 'auth', keywords: ['auth', 'login', 'welcome', 'token']},
    {module: 'chat', keywords: ['chat', 'conversation', 'switch', 'track', 'scope', 'send']},
    {module: 'oem', keywords: ['oem', 'menu-catalog', 'composer']},
    {module: 'ui', keywords: ['avatar', 'tool-card', 'visual', 'layout', 'scroll', 'selection-menu', 'buttons']},
    {module: 'models', keywords: ['model', 'weather', 'dashscope']},
  ];
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return rule.module;
    }
  }
  return 'misc';
}

function classifyPurpose(fileName) {
  const lower = fileName.toLowerCase();
  if (['debug', 'probe', 'inspect', 'trace', 'repro', 'list'].some((keyword) => lower.includes(keyword))) {
    return 'exploratory';
  }
  if (['e2e', 'smoke', 'check', 'verify', 'current-check', 'live-check'].some((keyword) => lower.includes(keyword))) {
    return 'candidate';
  }
  return 'unknown';
}

function classifyKind(ext) {
  if (ext === '.mjs' || ext === '.js' || ext === '.ts' || ext === '.tsx') {
    return 'script';
  }
  if (ext === '.applescript') {
    return 'automation';
  }
  if (ext === '.json' || ext === '.conf' || ext === '.remote') {
    return 'fixture';
  }
  return 'artifact';
}

function hashContent(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function walkFiles(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function loadCatalog() {
  if (!existsSync(catalogPath)) {
    return {version: 1, updatedAt: null, entries: []};
  }
  try {
    const content = await readFile(catalogPath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return {version: 1, updatedAt: null, entries: []};
  }
}

function renderReadme(catalog) {
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  const presentEntries = entries.filter((entry) => entry.sourcePresent);
  const candidateEntries = entries.filter((entry) => entry.promoteCandidate);
  const missingEntries = entries.filter((entry) => !entry.sourcePresent);
  const moduleCounts = new Map();
  for (const entry of entries) {
    moduleCounts.set(entry.module, (moduleCounts.get(entry.module) || 0) + 1);
  }
  const moduleSummary = Array.from(moduleCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    .map(([module, count]) => `- \`${module}\`: ${count}`)
    .join('\n');
  const candidateSummary = candidateEntries.length
    ? candidateEntries
        .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'zh-CN'))
        .map(
          (entry) =>
            `- \`${entry.sourcePath}\` -> \`${entry.archiveLatestPath}\` (${entry.module}, ${entry.purpose})`,
        )
        .join('\n')
    : '- 暂无';
  const missingSummary = missingEntries.length
    ? missingEntries
        .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'zh-CN'))
        .map((entry) => `- \`${entry.sourcePath}\` 最近一次归档于 ${entry.lastSeenAt}`)
        .join('\n')
    : '- 暂无';

  return `# Tmp Tests Archive

这是自动生成的 .tmp-tests 留存索引。

生成时间：
- \`${catalog.updatedAt}\`

当前统计：
- 当前源目录仍存在的临时文件：${presentEntries.length}
- 历史累计归档条目：${entries.length}
- 自动判定为可晋升正式测试的候选：${candidateEntries.length}

模块分布：
${moduleSummary || '- 暂无'}

候选晋升列表：
${candidateSummary}

已从源目录消失、但仍保留归档的条目：
${missingSummary}
`;
}

export async function harvestTmpTests() {
  await mkdir(archiveRootDir, {recursive: true});
  await mkdir(latestRootDir, {recursive: true});
  await mkdir(snapshotsRootDir, {recursive: true});

  const catalog = await loadCatalog();
  const nowIso = new Date().toISOString();
  const existingEntries = new Map(
    (Array.isArray(catalog.entries) ? catalog.entries : []).map((entry) => [entry.sourcePath, entry]),
  );
  const currentFiles = existsSync(tmpTestsDir) ? await walkFiles(tmpTestsDir) : [];
  const seen = new Set();

  for (const fullPath of currentFiles) {
    const relPath = toPosixPath(relative(rootDir, fullPath));
    const sourcePath = relPath;
    seen.add(sourcePath);
    const sourceName = basename(fullPath);
    const ext = extname(sourceName);
    const module = classifyModule(sourceName);
    const purpose = classifyPurpose(sourceName);
    const kind = classifyKind(ext);
    const content = await readFile(fullPath);
    const contentHash = hashContent(content);
    const shortHash = contentHash.slice(0, 12);
    const sourceStat = await stat(fullPath);
    const latestRelPath = toPosixPath(join('tests/archive/tmp-tests/latest', module, sourceName));
    const snapshotName = ext
      ? `${sourceName.slice(0, -ext.length)}__${shortHash}${ext}`
      : `${sourceName}__${shortHash}`;
    const snapshotRelPath = toPosixPath(join('tests/archive/tmp-tests/snapshots', module, snapshotName));
    const latestFullPath = resolve(rootDir, latestRelPath);
    const snapshotFullPath = resolve(rootDir, snapshotRelPath);

    await mkdir(dirname(latestFullPath), {recursive: true});
    await mkdir(dirname(snapshotFullPath), {recursive: true});
    await copyFile(fullPath, latestFullPath);
    if (!existsSync(snapshotFullPath)) {
      await copyFile(fullPath, snapshotFullPath);
    }

    const previous = existingEntries.get(sourcePath);
    const snapshotPaths = Array.isArray(previous?.archiveSnapshotPaths)
      ? Array.from(new Set([...previous.archiveSnapshotPaths, snapshotRelPath]))
      : [snapshotRelPath];
    existingEntries.set(sourcePath, {
      sourcePath,
      fileName: sourceName,
      module,
      purpose,
      kind,
      extension: ext || '',
      sourcePresent: true,
      promoteCandidate: purpose === 'candidate',
      sizeBytes: sourceStat.size,
      latestHash: contentHash,
      archiveLatestPath: latestRelPath,
      archiveSnapshotPaths: snapshotPaths.sort((a, b) => a.localeCompare(b, 'zh-CN')),
      createdAt: previous?.createdAt || nowIso,
      lastSeenAt: nowIso,
    });
  }

  for (const [sourcePath, previous] of existingEntries.entries()) {
    if (!seen.has(sourcePath)) {
      existingEntries.set(sourcePath, {
        ...previous,
        sourcePresent: false,
      });
    }
  }

  const nextCatalog = {
    version: 1,
    updatedAt: nowIso,
    entries: Array.from(existingEntries.values()).sort((a, b) =>
      a.sourcePath.localeCompare(b.sourcePath, 'zh-CN'),
    ),
  };
  await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
  await writeFile(readmePath, renderReadme(nextCatalog), 'utf8');
  return nextCatalog;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const catalog = await harvestTmpTests();
  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedAt: catalog.updatedAt,
        entries: catalog.entries.length,
      },
      null,
      2,
    ),
  );
}
