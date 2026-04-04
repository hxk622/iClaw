import {Pool, type PoolConfig} from 'pg';

import {logError} from './logger.ts';

const DEFAULT_SEARCH_PATH = 'app,public';
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS = 60_000;

type PgPoolOptions = {
  applicationName?: string;
  connectionTimeoutMillis?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleInTransactionSessionTimeoutMs?: number;
};

function hasExplicitSearchPath(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const options = decodeURIComponent(url.searchParams.get('options') || '');
    return /search_path/i.test(options);
  } catch {
    return /search_path/i.test(databaseUrl);
  }
}

export function buildPgPoolConfig(databaseUrl: string, options: PgPoolOptions = {}): PoolConfig {
  const config: PoolConfig = {
    connectionString: databaseUrl,
    application_name: options.applicationName,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout:
      options.idleInTransactionSessionTimeoutMs ?? DEFAULT_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  };

  if (typeof options.statementTimeoutMs === 'number' && Number.isFinite(options.statementTimeoutMs)) {
    config.statement_timeout = options.statementTimeoutMs;
  }

  if (typeof options.lockTimeoutMs === 'number' && Number.isFinite(options.lockTimeoutMs)) {
    config.lock_timeout = options.lockTimeoutMs;
  }

  if (!hasExplicitSearchPath(databaseUrl)) {
    config.options = `-c search_path=${DEFAULT_SEARCH_PATH}`;
  }

  return config;
}

export function createPgPool(databaseUrl: string, label: string, options: PgPoolOptions = {}): Pool {
  const pool = new Pool(
    buildPgPoolConfig(databaseUrl, {
      applicationName: options.applicationName || `iclaw-control-plane-${label}`,
      ...options,
    }),
  );
  pool.on('error', (error) => {
    logError('postgres pool idle client error', {
      pool: label,
      error,
    });
  });
  return pool;
}
