export interface KeyValueCache {
  readonly label: string;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
}
