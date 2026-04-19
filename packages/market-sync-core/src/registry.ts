import type { SyncTaskDefinition } from './types.ts';

export function filterWarmupTasks(tasks: SyncTaskDefinition[]): SyncTaskDefinition[] {
  return tasks.filter((task) => task.warmupOnStartup);
}

export function listTaskIds(tasks: SyncTaskDefinition[]): string[] {
  return tasks.map((task) => task.id);
}
