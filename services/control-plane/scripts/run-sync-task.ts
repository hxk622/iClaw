import { config } from '../src/config.ts';
import { ensureControlPlaneSchema } from '../src/pg-store.ts';
import { MARKET_SYNC_TASKS } from '../src/sync-tasks/task-registry.ts';

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const taskId = (readArg('--task') || '').trim();
  const listOnly = process.argv.includes('--list');

  if (listOnly) {
    console.log(
      JSON.stringify(
        MARKET_SYNC_TASKS.map((task) => ({
          id: task.id,
          label: task.label,
          category: task.category,
          schedule: task.schedule,
          timezone: task.timezone,
          warmup_on_startup: task.warmupOnStartup,
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (!taskId) {
    throw new Error('task id is required; use --task <task-id> or --list');
  }

  const task = MARKET_SYNC_TASKS.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`unknown task id: ${taskId}`);
  }

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  await ensureControlPlaneSchema(config.databaseUrl);
  await task.run();
}

main().catch((error) => {
  console.error('[run-sync-task] failed', error);
  process.exitCode = 1;
});
