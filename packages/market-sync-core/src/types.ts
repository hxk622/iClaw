export type SyncTaskCategory = 'snapshot' | 'reference' | 'fact' | 'enrich';

export type SyncTaskRunTrigger = 'manual' | 'schedule' | 'warmup';

export type SyncTaskExecutionResult = {
  syncCount?: number | null;
  dataSource?: string | null;
  metadata?: Record<string, unknown>;
};

export type SyncTaskDefinition = {
  id: string;
  label: string;
  category: SyncTaskCategory;
  schedule: string;
  timezone: string;
  warmupOnStartup: boolean;
  run: () => Promise<SyncTaskExecutionResult | void>;
};
