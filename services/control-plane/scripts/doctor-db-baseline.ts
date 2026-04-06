import {
  DEFAULT_PLATFORM_DB_BASELINE_PATH,
  buildPlatformDbBaselineSnapshot,
  diffPlatformDbBaselineSnapshots,
  readPlatformDbBaselineSnapshot,
} from './lib/platform-db-baseline.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const snapshotPath = readArg('--snapshot') || DEFAULT_PLATFORM_DB_BASELINE_PATH;
  const [actual, expected] = await Promise.all([
    buildPlatformDbBaselineSnapshot(),
    readPlatformDbBaselineSnapshot(snapshotPath),
  ]);
  const diff = diffPlatformDbBaselineSnapshots(actual, expected);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: diff.equal,
        snapshotPath,
        source: 'database',
      },
      null,
      2,
    )}\n`,
  );
  if (!diff.equal) {
    process.exitCode = 1;
  }
}

await main();
