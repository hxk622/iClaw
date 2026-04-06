import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import {config} from './config.ts';

const SECRET_ALGO = 'aes-256-gcm';
const SECRET_IV_BYTES = 12;

function deriveKey(secretKey: string): Buffer {
  return createHash('sha256').update(secretKey).digest();
}

export function encryptInstallSecretPayloadWithKey(payload: Record<string, string>, secretKey: string): string | null {
  const normalizedEntries = Object.entries(payload).filter(
    ([key, value]) => key.trim() && typeof value === 'string' && value.trim(),
  );
  if (normalizedEntries.length === 0) {
    return null;
  }

  const iv = randomBytes(SECRET_IV_BYTES);
  const cipher = createCipheriv(SECRET_ALGO, deriveKey(secretKey), iv);
  const plaintext = Buffer.from(JSON.stringify(Object.fromEntries(normalizedEntries)), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function encryptInstallSecretPayload(payload: Record<string, string>): string | null {
  return encryptInstallSecretPayloadWithKey(payload, config.installSecretKey);
}

export function decryptInstallSecretPayloadWithKey(value: string | null | undefined, secretKey: string): Record<string, string> {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return {};
  }

  try {
    const payload = Buffer.from(normalized, 'base64');
    if (payload.length <= SECRET_IV_BYTES + 16) {
      return {};
    }
    const iv = payload.subarray(0, SECRET_IV_BYTES);
    const tag = payload.subarray(SECRET_IV_BYTES, SECRET_IV_BYTES + 16);
    const ciphertext = payload.subarray(SECRET_IV_BYTES + 16);
    const decipher = createDecipheriv(SECRET_ALGO, deriveKey(secretKey), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const [key, rawValue] of Object.entries(parsed || {})) {
      if (!key.trim() || typeof rawValue !== 'string' || !rawValue.trim()) {
        continue;
      }
      next[key] = rawValue;
    }
    return next;
  } catch {
    return {};
  }
}

export function decryptInstallSecretPayload(value: string | null | undefined): Record<string, string> {
  return decryptInstallSecretPayloadWithKey(value, config.installSecretKey);
}
