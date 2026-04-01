import type {PoolConfig} from 'pg';

const DEFAULT_SEARCH_PATH = 'app,public';

function hasExplicitSearchPath(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const options = decodeURIComponent(url.searchParams.get('options') || '');
    return /search_path/i.test(options);
  } catch {
    return /search_path/i.test(databaseUrl);
  }
}

export function buildPgPoolConfig(databaseUrl: string): PoolConfig {
  if (hasExplicitSearchPath(databaseUrl)) {
    return {connectionString: databaseUrl};
  }
  return {
    connectionString: databaseUrl,
    options: `-c search_path=${DEFAULT_SEARCH_PATH}`,
  };
}
