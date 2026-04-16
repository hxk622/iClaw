#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  collectBundleVerification,
  collectIconChain,
  collectInstallMetrics,
  collectOemConsistency,
  collectOpenclawDrift,
  collectPackageSize,
  collectPublishFlow,
  collectRuntimeCache,
  collectRuntimeSnapshot,
  collectSmokeTestPlan,
  collectWindowsEnvPrecheck,
  ensureVersionRecordSkeleton,
  resolveReleaseContext,
  summarizeStatuses,
} from './lib/release-guard-lib.mjs';

function parseArgs(argv) {
  const options = {
    brandId: '',
    channel: '',
    target: '',
    releaseVersion: '',
    writeVersionRecord: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      options.brandId = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--brand=')) {
      options.brandId = arg.slice('--brand='.length);
      continue;
    }
    if (arg === '--channel') {
      options.channel = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      options.channel = arg.slice('--channel='.length);
      continue;
    }
    if (arg === '--target') {
      options.target = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
      continue;
    }
    if (arg === '--release-version') {
      options.releaseVersion = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--release-version=')) {
      options.releaseVersion = arg.slice('--release-version='.length);
      continue;
    }
    if (arg === '--write-version-record') {
      options.writeVersionRecord = true;
    }
  }
  return options;
}

async function writeVersionRecordAppendix(context, report, reportPath) {
  const { versionRecordPath, testReportPath } = await ensureVersionRecordSkeleton(context);
  const appendix = [
    '',
    '## Release Guard',
    '',
    `- generated_at: \`${report.generatedAt}\``,
    `- overall_status: \`${report.overallStatus}\``,
    `- report_path: \`${path.relative(context.rootDir, reportPath)}\``,
    '',
    '| Check | Status | Summary |',
    '| --- | --- | --- |',
    ...Object.entries(report.checks).map(([key, value]) => `| ${key} | ${value.status} | ${String(value.summary || '').replace(/\|/g, '\\|')} |`),
    '',
  ].join('\n');

  async function appendIfMissing(filePath) {
    const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
    const nextRaw = raw.includes('## Release Guard')
      ? raw.replace(/\n## Release Guard[\s\S]*$/m, `\n${appendix.trimStart()}`)
      : `${raw.trimEnd()}\n${appendix}`;
    await fs.writeFile(filePath, nextRaw, 'utf8');
  }

  await appendIfMissing(versionRecordPath);
  await appendIfMissing(testReportPath);
}

async function main() {
  const rootDir = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const context = await resolveReleaseContext(rootDir, options);
  const checks = {
    openclaw_drift: await collectOpenclawDrift(context),
    oem_consistency: await collectOemConsistency(context),
    bundle_verification: await collectBundleVerification(context),
    smoke_test: await collectSmokeTestPlan(context),
    runtime_cache: await collectRuntimeCache(context),
    package_size: await collectPackageSize(context),
    install_metrics: await collectInstallMetrics(context),
    windows_env_precheck: await collectWindowsEnvPrecheck(context),
    icon_chain: await collectIconChain(context),
    runtime_snapshot: await collectRuntimeSnapshot(context),
    publish_flow: await collectPublishFlow(context),
    version_record: (() => {})(),
  };
  checks.version_record = await (async () => {
    const recordState = await ensureVersionRecordSkeleton(context);
    if (!recordState.versionRecordExists || !recordState.testReportExists) {
      return {
        status: 'warn',
        summary: 'version_record/test_report skeleton is missing',
        ...recordState,
        fix: `node scripts/release-create-version-record.mjs --release-version ${context.releaseVersion}`,
      };
    }
    return {
      status: 'pass',
      summary: 'version_record/test_report skeleton exists',
      ...recordState,
    };
  })();

  const report = {
    generatedAt: new Date().toISOString(),
    brandId: context.brandId,
    channel: context.channel,
    targetTriple: context.targetTriple,
    packageVersion: context.packageVersion,
    releaseVersion: context.releaseVersion,
    overallStatus: summarizeStatuses(checks),
    checkCount: Object.keys(checks).length,
    checks,
    sop: {
      windowsReleaseSop: 'docs/release/windows-desktop-release-sop.md',
      versionRecordReadme: 'docs/version_record/README.md',
    },
  };

  const outputDir = path.join(rootDir, 'dist', 'release-guard');
  await fs.mkdir(outputDir, { recursive: true });
  const reportFileName = `${context.brandId}-${context.channel}-${context.targetTriple}-${context.releaseVersion}.json`;
  const reportPath = path.join(outputDir, reportFileName);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.writeVersionRecord) {
    await writeVersionRecordAppendix(context, report, reportPath);
  }

  process.stdout.write(`${JSON.stringify({ ok: report.overallStatus !== 'fail', reportPath, overallStatus: report.overallStatus }, null, 2)}\n`);
  if (report.overallStatus === 'fail') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
