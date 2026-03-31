import {createClient, type RedisClientType} from 'redis';

import type {KeyValueCache} from './cache.ts';
import {logWarn} from './logger.ts';

export class RedisKeyValueCache implements KeyValueCache {
  readonly label = 'redis';
  private readonly client: RedisClientType;
  private readonly keyPrefix: string;
  private lastErrorAt = 0;

  constructor(url: string, keyPrefix: string) {
    this.client = createClient({url});
    this.keyPrefix = keyPrefix.replace(/:$/, '');
    this.client.on('error', (error) => {
      const now = Date.now();
      if (now - this.lastErrorAt < 10_000) {
        return;
      }
      this.lastErrorAt = now;
      logWarn('redis cache error, continuing without cache for this request', {error});
    });
  }

  async connect(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }
    await this.client.connect();
  }

  async get<T>(key: string): Promise<T | null> {
    let raw: string | null = null;
    try {
      raw = await this.client.get(this.key(key));
    } catch {
      return null;
    }
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return;
    }

    try {
      await this.client.set(this.key(key), JSON.stringify(value), {
        EX: Math.max(1, Math.floor(ttlSeconds)),
      });
    } catch {
      return;
    }
  }

  async delete(...keys: string[]): Promise<void> {
    const normalized = keys.filter((key) => key.trim().length > 0).map((key) => this.key(key));
    if (normalized.length === 0) {
      return;
    }
    try {
      await this.client.del(normalized);
    } catch {
      return;
    }
  }

  private key(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
}

export async function createRedisKeyValueCache(url: string, keyPrefix: string): Promise<RedisKeyValueCache> {
  const cache = new RedisKeyValueCache(url, keyPrefix);
  await cache.connect();
  return cache;
}
