import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { config } from './config.ts';
import { HttpError } from './errors.ts';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_BUCKET = 'iclaw-files';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Endpoint(): string {
  return (config.s3Endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
}

function getS3Bucket(): string {
  return config.s3Bucket || DEFAULT_BUCKET;
}

function getAvatarProxyBaseUrl(): string {
  const base = config.apiUrl || `http://127.0.0.1:${config.port}`;
  return base.replace(/\/$/, '');
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'AVATAR_STORAGE_NOT_CONFIGURED', 'avatar storage is not configured');
  }
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: getS3Endpoint(),
      region: config.s3Region || DEFAULT_REGION,
      credentials: {
        accessKeyId: config.s3AccessKey,
        secretAccessKey: config.s3SecretKey,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

async function ensureBucketExists(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = getS3Client();
      try {
        await client.send(
          new HeadBucketCommand({
            Bucket: getS3Bucket(),
          }),
        );
      } catch {
        await client.send(
          new CreateBucketCommand({
            Bucket: getS3Bucket(),
          }),
        );
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

function inferExtension(contentType: string, filename?: string): string {
  const normalized = contentType.toLowerCase();
  if (filename?.includes('.')) {
    const ext = filename.slice(filename.lastIndexOf('.') + 1).trim().toLowerCase();
    if (ext) return ext;
  }
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  return 'bin';
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function getAvatarKey(userId: string, filename: string): string {
  return `avatars/${userId}/${filename}`;
}

export function getAvatarProxyUrl(key: string): string {
  return `${getAvatarProxyBaseUrl()}/auth/avatar?key=${encodeURIComponent(key)}`;
}

export function assertValidAvatar(content: Buffer, contentType: string): void {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported avatar type');
  }
  if (content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'avatar file is empty');
  }
  if (content.length > MAX_AVATAR_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'avatar file must be 5MB or smaller');
  }
}

export async function uploadAvatar(
  userId: string,
  content: Buffer,
  contentType: string,
  filename?: string,
): Promise<{ key: string; url: string }> {
  assertValidAvatar(content, contentType);
  await ensureBucketExists();
  const ext = inferExtension(contentType, filename);
  const key = getAvatarKey(userId, `avatar-${Date.now()}-${randomUUID()}.${ext}`);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      Body: content,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return {
    key,
    url: getAvatarProxyUrl(key),
  };
}

export async function deleteOldAvatars(userId: string, currentKey?: string): Promise<void> {
  await ensureBucketExists();
  const client = getS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: getS3Bucket(),
      Prefix: `avatars/${userId}/`,
      MaxKeys: 1000,
    }),
  );
  const objects = response.Contents || [];
  await Promise.all(
    objects
      .filter((item) => item.Key && item.Key !== currentKey)
      .map((item) =>
        client.send(
          new DeleteObjectCommand({
            Bucket: getS3Bucket(),
            Key: item.Key!,
          }),
        ),
      ),
  );
}

export async function deleteAvatarByKey(key: string): Promise<void> {
  const trimmedKey = key.trim();
  if (!trimmedKey.startsWith('avatars/')) return;
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: trimmedKey,
    }),
  );
}

export function extractAvatarKey(avatarUrl?: string | null): string | null {
  const trimmed = avatarUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('avatars/')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.pathname === '/auth/avatar') {
      const key = url.searchParams.get('key');
      return key?.startsWith('avatars/') ? key : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function downloadAvatar(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const trimmedKey = key.trim();
  if (!trimmedKey.startsWith('avatars/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid avatar key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: getS3Bucket(),
        Key: trimmedKey,
      }),
    );
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: trimmedKey,
      }),
    );
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'avatar not found');
    }
    const body =
      response.Body instanceof Readable
        ? await toBuffer(response.Body)
        : Buffer.from(await response.Body.transformToByteArray());
    return {
      buffer: body,
      contentType: head.ContentType || response.ContentType || 'application/octet-stream',
    };
  } catch (error) {
    const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
    if (error instanceof HttpError) throw error;
    if (name === 'NotFound' || name === 'NoSuchKey') {
      throw new HttpError(404, 'NOT_FOUND', 'avatar not found');
    }
    throw error;
  }
}
