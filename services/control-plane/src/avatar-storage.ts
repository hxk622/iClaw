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
const DEFAULT_LEGACY_BUCKET = 'iclaw-files';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

let s3Client: S3Client | null = null;
const bucketReady = new Map<string, Promise<void>>();

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Endpoint(): string {
  return (config.s3Endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
}

function getUserAssetsBucket(): string {
  return (config.userAssetsBucket || '').trim() || 'iclaw-user-assets';
}

function getLegacyAvatarBuckets(): string[] {
  return Array.from(
    new Set(
      [config.s3Bucket || '', DEFAULT_LEGACY_BUCKET]
        .map((bucket) => bucket.trim())
        .filter(Boolean),
    ),
  );
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

async function ensureBucketExists(bucket: string): Promise<void> {
  const normalizedBucket = bucket.trim();
  if (!normalizedBucket) {
    throw new HttpError(500, 'AVATAR_STORAGE_BUCKET_INVALID', 'avatar storage bucket is invalid');
  }
  if (!bucketReady.has(normalizedBucket)) {
    bucketReady.set(normalizedBucket, (async () => {
      const client = getS3Client();
      try {
        await client.send(
          new HeadBucketCommand({
            Bucket: normalizedBucket,
          }),
        );
      } catch {
        await client.send(
          new CreateBucketCommand({
            Bucket: normalizedBucket,
          }),
        );
      }
    })().catch((error) => {
      bucketReady.delete(normalizedBucket);
      throw error;
    }));
  }
  await bucketReady.get(normalizedBucket);
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

function getAvatarTenantId(): string {
  return (config.userAssetsTenantId || config.appName || 'iclaw').trim() || 'iclaw';
}

function getTenantAvatarPrefix(tenantId: string, userId: string): string {
  return `tenants/${tenantId}/users/${userId}/avatar/`;
}

function getLegacyAvatarPrefix(userId: string): string {
  return `avatars/${userId}/`;
}

function isAvatarKey(value: string): boolean {
  return value.startsWith('tenants/') || value.startsWith('avatars/');
}

function isMissingObjectStoreError(error: unknown): boolean {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  return name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket' || name === 'NotFoundError';
}

async function listKeys(bucket: string, prefix: string): Promise<string[]> {
  const normalizedBucket = bucket.trim();
  const normalizedPrefix = prefix.trim();
  if (!normalizedBucket || !normalizedPrefix) {
    return [];
  }
  const client = getS3Client();
  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: normalizedBucket,
        Prefix: normalizedPrefix,
        MaxKeys: 1000,
      }),
    );
    return (response.Contents || []).map((item) => item.Key || '').filter(Boolean);
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return [];
    }
    throw error;
  }
}

async function deleteObjectIfExists(bucket: string, key: string): Promise<void> {
  const normalizedBucket = bucket.trim();
  const normalizedKey = key.trim();
  if (!normalizedBucket || !normalizedKey) {
    return;
  }
  const client = getS3Client();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: normalizedBucket,
        Key: normalizedKey,
      }),
    );
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }
    throw error;
  }
}

async function readAvatarFromBucket(bucket: string, key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const normalizedBucket = bucket.trim();
  const normalizedKey = key.trim();
  if (!normalizedBucket || !normalizedKey) {
    return null;
  }
  const client = getS3Client();
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: normalizedBucket,
        Key: normalizedKey,
      }),
    );
    const response = await client.send(
      new GetObjectCommand({
        Bucket: normalizedBucket,
        Key: normalizedKey,
      }),
    );
    if (!response.Body) {
      return null;
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
    if (isMissingObjectStoreError(error)) {
      return null;
    }
    throw error;
  }
}

function getAvatarReadBuckets(key: string): string[] {
  const normalizedKey = key.trim();
  if (normalizedKey.startsWith('tenants/')) {
    return [getUserAssetsBucket()];
  }
  return Array.from(new Set([getUserAssetsBucket(), ...getLegacyAvatarBuckets()]));
}

export function getAvatarKey(userId: string, filename: string, tenantId = getAvatarTenantId()): string {
  return `${getTenantAvatarPrefix(tenantId, userId)}${filename}`;
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
  const bucket = getUserAssetsBucket();
  await ensureBucketExists(bucket);
  const ext = inferExtension(contentType, filename);
  const key = getAvatarKey(userId, `avatar-${Date.now()}-${randomUUID()}.${ext}`);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
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
  const normalizedCurrentKey = currentKey?.trim() || null;
  const tenantPrefix = getTenantAvatarPrefix(getAvatarTenantId(), userId);
  const tenantBucket = getUserAssetsBucket();
  await ensureBucketExists(tenantBucket);

  const tenantKeys = await listKeys(tenantBucket, tenantPrefix);
  await Promise.all(
    tenantKeys
      .filter((key) => key !== normalizedCurrentKey)
      .map((key) => deleteObjectIfExists(tenantBucket, key)),
  );

  const legacyPrefix = getLegacyAvatarPrefix(userId);
  const legacyBuckets = Array.from(new Set([tenantBucket, ...getLegacyAvatarBuckets()]));
  await Promise.all(
    legacyBuckets.map(async (bucket) => {
      const keys = await listKeys(bucket, legacyPrefix);
      await Promise.all(
        keys
          .filter((key) => key !== normalizedCurrentKey)
          .map((key) => deleteObjectIfExists(bucket, key)),
      );
    }),
  );
}

export async function deleteAvatarByKey(key: string): Promise<void> {
  const trimmedKey = key.trim();
  if (!isAvatarKey(trimmedKey)) return;
  const buckets = getAvatarReadBuckets(trimmedKey);
  await Promise.all(buckets.map((bucket) => deleteObjectIfExists(bucket, trimmedKey)));
}

export function extractAvatarKey(avatarUrl?: string | null): string | null {
  const trimmed = avatarUrl?.trim();
  if (!trimmed) return null;
  if (isAvatarKey(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.pathname === '/auth/avatar') {
      const key = url.searchParams.get('key');
      return key && isAvatarKey(key) ? key : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function downloadAvatar(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const trimmedKey = key.trim();
  if (!isAvatarKey(trimmedKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid avatar key');
  }
  for (const bucket of getAvatarReadBuckets(trimmedKey)) {
    const avatar = await readAvatarFromBucket(bucket, trimmedKey);
    if (avatar) {
      return avatar;
    }
  }
  throw new HttpError(404, 'NOT_FOUND', 'avatar not found');
}
