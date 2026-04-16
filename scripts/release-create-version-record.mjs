#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    releaseVersion: '',
    owner: process.env.USERNAME || process.env.USER || 'unknown',
    environment: process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || 'prod',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--release-version') {
      options.releaseVersion = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--release-version=')) {
      options.releaseVersion = arg.slice('--release-version='.length);
      continue;
    }
    if (arg === '--owner') {
      options.owner = argv[index + 1] || options.owner;
      index += 1;
      continue;
    }
    if (arg.startsWith('--owner=')) {
      options.owner = arg.slice('--owner='.length) || options.owner;
    }
  }
  return options;
}

async function ensureFile(filePath, content) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }
}

async function main() {
  const rootDir = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const releaseVersion = trimString(options.releaseVersion);
  if (!releaseVersion) {
    throw new Error('Usage: node scripts/release-create-version-record.mjs --release-version <x.y.z.build>');
  }
  const now = new Date();
  const nowText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} CST`;
  const versionRecordPath = path.join(rootDir, 'docs', 'version_record', `${releaseVersion}.md`);
  const testReportPath = path.join(rootDir, 'docs', 'version_record', 'test_report', `${releaseVersion}.md`);
  await ensureFile(versionRecordPath, `# ${releaseVersion}

## 1. 发布基线

- \`version_no\`: \`${releaseVersion}\`
- \`environment\`: \`${trimString(options.environment) || 'prod'}\`
- \`owner\`: \`${trimString(options.owner)}\`
- \`window\`: \`${nowText}\`
- \`test_report\`: \`docs/version_record/test_report/${releaseVersion}.md\`
- \`status\`: \`draft\`

## 2. 变更摘要

- 待补充。

## 3. 发布产物

- 待补充。

## 4. 验证结果

- 待补充。

## 5. 风险与备注

- 待补充。
`);
  await ensureFile(testReportPath, `# ${releaseVersion} Test Report

## 1. 基本信息

- \`version_no\`: \`${releaseVersion}\`
- \`release_id\`: \`${releaseVersion}\`
- \`environment\`: \`${trimString(options.environment) || 'prod'}\`
- \`report_owner\`: \`${trimString(options.owner)}\`
- \`generated_at\`: \`${nowText}\`
- \`related_version_record\`: \`docs/version_record/${releaseVersion}.md\`
- \`minio_prefix\`: \`pending\`

## 2. 测试范围

- 待补充。

## 3. 执行环境

- 待补充。

## 4. 执行用例

| Case ID | 脚本/文档 | 类型 | 结果 | 备注 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## 5. 关键结果

- 待补充。

## 6. 证据

- 待补充。

## 7. 风险结论

- 待补充。
`);
  process.stdout.write(JSON.stringify({ versionRecordPath, testReportPath }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
