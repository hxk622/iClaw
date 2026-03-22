import { CachedControlPlaneStore } from '../src/cached-store.ts';
import { config } from '../src/config.ts';
import { ensureControlPlaneSchema, PgControlPlaneStore } from '../src/pg-store.ts';
import { createRedisKeyValueCache } from '../src/redis-cache.ts';
import { DEFAULT_CLAWHUB_SYNC_SOURCE } from '../src/skill-sync-defaults.ts';
import { syncSkillsFromSource } from '../src/skill-sync.ts';
import type { UpsertSkillSyncSourceInput } from '../src/domain.ts';
import type { ControlPlaneStore } from '../src/store.ts';

const SYNC_RUN_ITEM_LIMIT = 500;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({length: workerCount}, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          break;
        }
        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}

function parseArgs(): {
  dryRun: boolean;
  limit?: number;
  sort?: string;
  pageSize?: number;
  detailConcurrency?: number;
} {
  const args = process.argv.slice(2);
  const parsed: {
    dryRun: boolean;
    limit?: number;
    sort?: string;
    pageSize?: number;
    detailConcurrency?: number;
  } = {
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--limit') {
      parsed.limit = Number.parseInt(args[index + 1] ?? '0', 10);
      index += 1;
      continue;
    }
    if (arg === '--sort') {
      parsed.sort = (args[index + 1] || '').trim() || undefined;
      index += 1;
      continue;
    }
    if (arg === '--page-size') {
      parsed.pageSize = Number.parseInt(args[index + 1] ?? '25', 10);
      index += 1;
      continue;
    }
    if (arg === '--detail-concurrency') {
      parsed.detailConcurrency = Number.parseInt(args[index + 1] ?? '8', 10);
      index += 1;
      continue;
    }
    if (arg === '--') {
      continue;
    }
    throw new Error(`unknown arg: ${arg}`);
  }

  return parsed;
}

function buildSourceInput(args: ReturnType<typeof parseArgs>): Required<UpsertSkillSyncSourceInput> {
  const nextConfig: Record<string, unknown> = {
    ...DEFAULT_CLAWHUB_SYNC_SOURCE.config,
  };

  if (typeof args.limit === 'number' && Number.isFinite(args.limit)) {
    nextConfig.limit = Math.max(0, Math.floor(args.limit));
  }
  if (args.sort) {
    nextConfig.sort = args.sort;
  }
  if (typeof args.pageSize === 'number' && Number.isFinite(args.pageSize) && args.pageSize > 0) {
    nextConfig.page_size = Math.floor(args.pageSize);
  }
  if (
    typeof args.detailConcurrency === 'number' &&
    Number.isFinite(args.detailConcurrency) &&
    args.detailConcurrency > 0
  ) {
    nextConfig.detail_concurrency = Math.floor(args.detailConcurrency);
  }

  return {
    ...DEFAULT_CLAWHUB_SYNC_SOURCE,
    config: nextConfig,
  };
}

async function createStore(): Promise<ControlPlaneStore> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  await ensureControlPlaneSchema(config.databaseUrl);
  let store: ControlPlaneStore = new PgControlPlaneStore(config.databaseUrl);

  if (config.redisUrl) {
    try {
      const cache = await createRedisKeyValueCache(config.redisUrl, config.redisKeyPrefix);
      store = new CachedControlPlaneStore(store, cache);
    } catch (error) {
      console.warn('[sync-clawhub-top-skills] redis unavailable, continuing without cache', error);
    }
  }

  return store;
}

async function main() {
  const args = parseArgs();
  const store = await createStore();
  const source = await store.upsertSkillSyncSource(buildSourceInput(args));
  const existingEntries = await store.listSkillCatalogAdmin();
  const execution = await syncSkillsFromSource(source, existingEntries);
  const storedItems = execution.items.slice(0, SYNC_RUN_ITEM_LIMIT);
  const summary: Record<string, unknown> = {
    ...execution.summary,
    stored_item_count: storedItems.length,
    truncated_item_count: Math.max(0, execution.items.length - storedItems.length),
  };

  if (!args.dryRun) {
    await runWithConcurrency(execution.upserts, 16, async (upsert) => {
      await store.upsertSkillCatalogEntry(upsert);
    });
    await store.createSkillSyncRun({
      sourceId: source.id,
      sourceKey: source.sourceKey,
      sourceType: source.sourceType,
      displayName: source.displayName,
      status: execution.status,
      summary,
      items: storedItems,
      startedAt: typeof summary.started_at === 'string' ? summary.started_at : new Date().toISOString(),
      finishedAt: typeof summary.finished_at === 'string' ? summary.finished_at : new Date().toISOString(),
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        dryRun: args.dryRun,
        source: {
          id: source.id,
          sourceKey: source.sourceKey,
          displayName: source.displayName,
          config: source.config,
        },
        status: execution.status,
        summary,
        sample_items: execution.items.slice(0, 10),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('[sync-clawhub-top-skills] failed');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
