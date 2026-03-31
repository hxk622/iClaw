type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type LogFields = Record<string, unknown>;

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'client_secret',
]);
const MAX_SERIALIZED_LENGTH = 8_000;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

function formatTimestamp(date = new Date()): string {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`,
  ].join(' ');
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  return normalized.endsWith('_token') || normalized.endsWith('_secret') || normalized.endsWith('_key');
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null,
    };
  }
  if (Buffer.isBuffer(value)) {
    return {
      type: 'buffer',
      size: value.byteLength,
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeValue(nestedKey, nestedValue),
      ]),
    );
  }
  if (typeof value === 'string' && value.length > MAX_SERIALIZED_LENGTH) {
    return `${value.slice(0, MAX_SERIALIZED_LENGTH)}…<truncated ${value.length - MAX_SERIALIZED_LENGTH} chars>`;
  }
  return value;
}

function serializeValue(key: string, value: unknown): string {
  const sanitized = sanitizeValue(key, value);
  if (sanitized === null) {
    return 'null';
  }
  if (sanitized === undefined) {
    return 'undefined';
  }
  if (typeof sanitized === 'string') {
    return /\s|=|"|\\/.test(sanitized) ? JSON.stringify(sanitized) : sanitized;
  }
  if (typeof sanitized === 'number' || typeof sanitized === 'boolean' || typeof sanitized === 'bigint') {
    return String(sanitized);
  }
  try {
    const json = JSON.stringify(sanitized);
    if (!json) {
      return 'null';
    }
    if (json.length > MAX_SERIALIZED_LENGTH) {
      return `${JSON.stringify(json.slice(0, MAX_SERIALIZED_LENGTH))}…<truncated ${json.length - MAX_SERIALIZED_LENGTH} chars>`;
    }
    return json;
  } catch {
    return JSON.stringify(String(sanitized));
  }
}

function renderFields(fields?: LogFields): string {
  if (!fields) {
    return '';
  }
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return '';
  }
  return ` ${entries.map(([key, value]) => `${key}=${serializeValue(key, value)}`).join(' ')}`;
}

function writeLog(level: LogLevel, message: string, fields?: LogFields): void {
  const line = `${formatTimestamp()} ${level} ${message}${renderFields(fields)}\n`;
  if (level === 'ERROR') {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}

export function logInfo(message: string, fields?: LogFields): void {
  writeLog('INFO', message, fields);
}

export function logWarn(message: string, fields?: LogFields): void {
  writeLog('WARN', message, fields);
}

export function logError(message: string, fields?: LogFields): void {
  writeLog('ERROR', message, fields);
}

