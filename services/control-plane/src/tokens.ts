import {createHash, randomBytes} from 'node:crypto';

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('hex')}`;
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
