import {
  DEFAULT_PLATFORM_DB_BASELINE_PATH,
  writePlatformDbBaselineSnapshot,
} from './lib/platform-db-baseline.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const outPath = readArg('--out') || DEFAULT_PLATFORM_DB_BASELINE_PATH;
  const result = await writePlatformDbBaselineSnapshot(outPath);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        path: result.path,
        changed: result.changed,
        source: 'database',
      },
      null,
      2,
    )}\n`,
  );
}

await main();
