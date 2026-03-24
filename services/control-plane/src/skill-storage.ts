import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {Readable} from 'node:stream';

import {config} from './config.ts';
import {HttpError} from './errors.ts';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_LEGACY_BUCKET = 'iclaw-files';

let s3Client: S3Client | null = null;
const bucketReady = new Map<string, Promise<void>>();

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'SKILL_STORAGE_NOT_CONFIGURED', 'skill storage is not configured');
  }
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: (config.s3Endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ''),
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

function getUserAssetsBucket(): string {
  return (config.userAssetsBucket || '').trim() || 'iclaw-user-assets';
}

function getLegacyBuckets(): string[] {
  return Array.from(
    new Set(
      [config.s3Bucket || '', DEFAULT_LEGACY_BUCKET]
        .map((bucket) => bucket.trim())
        .filter(Boolean),
    ),
  );
}

async function ensureBucketExists(bucket: string): Promise<void> {
  const normalizedBucket = bucket.trim();
  if (!normalizedBucket) {
    throw new HttpError(500, 'SKILL_STORAGE_BUCKET_INVALID', 'skill storage bucket is invalid');
  }
  if (!bucketReady.has(normalizedBucket)) {
    bucketReady.set(normalizedBucket, (async () => {
      const client = getS3Client();
      try {
        await client.send(new HeadBucketCommand({Bucket: normalizedBucket}));
      } catch {
        await client.send(new CreateBucketCommand({Bucket: normalizedBucket}));
      }
    })().catch((error) => {
      bucketReady.delete(normalizedBucket);
      throw error;
    }));
  }
  await bucketReady.get(normalizedBucket);
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function getPrivateSkillArtifactKey(userId: string, slug: string, version: string, artifactFormat: 'tar.gz' | 'zip'): string {
  const ext = artifactFormat === 'zip' ? 'zip' : 'tar.gz';
  const tenantId = (config.userAssetsTenantId || config.appName || 'iclaw').trim() || 'iclaw';
  return `tenants/${tenantId}/users/${userId}/skills/private/${slug}/${version}/artifact.${ext}`;
}

function isLegacyPrivateSkillArtifactKey(value: string): boolean {
  return /^skills\/private\/[^/]+\/[^/]+\/[^/]+\/artifact\.(zip|tar\.gz)$/.test(value);
}

function isTenantPrivateSkillArtifactKey(value: string): boolean {
  return /^tenants\/[^/]+\/users\/[^/]+\/skills\/private\/[^/]+\/[^/]+\/artifact\.(zip|tar\.gz)$/.test(value);
}

function isPrivateSkillArtifactKey(value: string): boolean {
  return isLegacyPrivateSkillArtifactKey(value) || isTenantPrivateSkillArtifactKey(value);
}

function isMissingObjectStoreError(error: unknown): boolean {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  return name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket' || name === 'NotFoundError';
}

function getReadBuckets(key: string): string[] {
  if (isTenantPrivateSkillArtifactKey(key)) {
    return [getUserAssetsBucket()];
  }
  return Array.from(new Set([getUserAssetsBucket(), ...getLegacyBuckets()]));
}

async function readPrivateSkillArtifactFromBucket(
  bucket: string,
  key: string,
): Promise<{buffer: Buffer; contentType: string} | null> {
  const normalizedBucket = bucket.trim();
  const normalizedKey = key.trim();
  if (!normalizedBucket || !normalizedKey) {
    return null;
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: normalizedBucket, Key: normalizedKey}));
    const response = await client.send(new GetObjectCommand({Bucket: normalizedBucket, Key: normalizedKey}));
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

export async function uploadPrivateSkillArtifact(input: {
  userId: string;
  slug: string;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifact: Buffer;
}): Promise<{key: string}> {
  const bucket = getUserAssetsBucket();
  await ensureBucketExists(bucket);
  const key = getPrivateSkillArtifactKey(input.userId, input.slug, input.version, input.artifactFormat);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.artifact,
      ContentType: input.artifactFormat === 'zip' ? 'application/zip' : 'application/gzip',
      CacheControl: 'private, max-age=300',
    }),
  );
  return {key};
}

export async function downloadPrivateSkillArtifact(key: string): Promise<{buffer: Buffer; contentType: string}> {
  const trimmedKey = key.trim();
  if (!isPrivateSkillArtifactKey(trimmedKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid private skill artifact key');
  }
  for (const bucket of getReadBuckets(trimmedKey)) {
    const artifact = await readPrivateSkillArtifactFromBucket(bucket, trimmedKey);
    if (artifact) {
      return artifact;
    }
  }
  throw new HttpError(404, 'NOT_FOUND', 'private skill artifact not found');
}

export async function deletePrivateSkillArtifact(key: string): Promise<void> {
  const trimmedKey = key.trim();
  if (!isPrivateSkillArtifactKey(trimmedKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid private skill artifact key');
  }
  await Promise.all(getReadBuckets(trimmedKey).map((bucket) => deleteObjectIfExists(bucket, trimmedKey)));
}
