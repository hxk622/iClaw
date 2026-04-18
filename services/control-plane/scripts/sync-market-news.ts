import { config } from '../src/config.ts';
import { ensureControlPlaneSchema } from '../src/pg-store.ts';
import { syncMarketNews } from '../src/sync-tasks/tasks/sync-market-news.ts';

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await ensureControlPlaneSchema(config.databaseUrl);
  await syncMarketNews();
}

main().catch((error) => {
  console.error('[sync-market-news] failed', error);
  process.exitCode = 1;
});
