import { config } from '../src/config.ts';
import { ensureControlPlaneSchema } from '../src/pg-store.ts';
import { syncMarketOverview } from '../src/sync-tasks/tasks/sync-market-overview.ts';

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await ensureControlPlaneSchema(config.databaseUrl);
  await syncMarketOverview();
}

main().catch((error) => {
  console.error('[sync-market-overview] failed', error);
  process.exitCode = 1;
});
