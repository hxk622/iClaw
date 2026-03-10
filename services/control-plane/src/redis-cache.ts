import {createClient, type RedisClientType} from 'redis';

import type {KeyValueCache} from './cache.ts';

export class RedisKeyValueCache implements KeyValueCache {
  readonly label = 'redis';
  private readonly client: RedisClientType;
  private readonly keyPrefix: string;

  constructor(url: string, keyPrefix: string) {
    this.client = createClient({url});
    this.keyPrefix = keyPrefix.replace(/:$/, '');
  }

  async connect(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }
    await this.client.connect();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.key(key));
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

    await this.client.set(this.key(key), JSON.stringify(value), {
      EX: Math.max(1, Math.floor(ttlSeconds)),
    });
  }

  async delete(...keys: string[]): Promise<void> {
    const normalized = keys.filter((key) => key.trim().length > 0).map((key) => this.key(key));
    if (normalized.length === 0) {
      return;
    }
    await this.client.del(normalized);
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
