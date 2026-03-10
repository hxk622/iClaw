import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [algorithm, salt, stored] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !stored) return false;
  const derived = scryptSync(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(stored, 'hex');
  if (storedBuffer.length !== derived.length) return false;
  return timingSafeEqual(storedBuffer, derived);
}
