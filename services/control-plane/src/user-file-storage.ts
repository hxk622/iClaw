import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {createHash, randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';

import {config} from './config.ts';
import {HttpError} from './errors.ts';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const MAX_USER_FILE_BYTES = 25 * 1024 * 1024;

let s3Client: S3Client | null = null;
const bucketReady = new Map<string, Promise<void>>();

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'USER_FILE_STORAGE_NOT_CONFIGURED', 'user file storage is not configured');
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

function getTenantId(): string {
  return (config.userAssetsTenantId || config.appName || 'iclaw').trim() || 'iclaw';
}

async function ensureBucketExists(bucket: string): Promise<void> {
  const normalizedBucket = bucket.trim();
  if (!normalizedBucket) {
    throw new HttpError(500, 'USER_FILE_STORAGE_BUCKET_INVALID', 'user file storage bucket is invalid');
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

function sanitizeFileName(fileNameInput: string): string {
  const trimmed = fileNameInput.trim();
  const collapsed = trimmed.replace(/[/\\]+/g, '-').replace(/\s+/g, ' ');
  const safe = collapsed.replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/-+/g, '-').trim();
  return safe || 'file.bin';
}

function buildObjectKey(input: {tenantId: string; userId: string; kind: string; fileId: string; fileName: string}): string {
  return `tenants/${input.tenantId}/users/${input.userId}/uploads/${input.kind}/${input.fileId}/${input.fileName}`;
}

function isUserFileObjectKey(value: string): boolean {
  return /^tenants\/[^/]+\/users\/[^/]+\/uploads\/[^/]+\/[^/]+\/.+$/.test(value.trim());
}

function isMissingObjectStoreError(error: unknown): boolean {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  return name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket' || name === 'NotFoundError';
}

function assertValidUpload(input: {content: Buffer; fileName: string; kind: string}): void {
  if (!input.kind.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'kind is required');
  }
  if (!input.fileName.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'file name is required');
  }
  if (input.content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'file is empty');
  }
  if (input.content.length > MAX_USER_FILE_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'file must be 25MB or smaller');
  }
}

export async function uploadUserFile(input: {
  userId: string;
  kind: string;
  fileName: string;
  contentType?: string | null;
  content: Buffer;
}): Promise<{
  objectKey: string;
  bucket: string;
  tenantId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}> {
  assertValidUpload(input);
  const tenantId = getTenantId();
  const fileId = randomUUID();
  const originalFileName = sanitizeFileName(input.fileName);
  const bucket = getUserAssetsBucket();
  const objectKey = buildObjectKey({
    tenantId,
    userId: input.userId,
    kind: input.kind.trim(),
    fileId,
    fileName: originalFileName,
  });
  const mimeType = (input.contentType || '').trim() || DEFAULT_CONTENT_TYPE;
  const sha256 = createHash('sha256').update(input.content).digest('hex');
  await ensureBucketExists(bucket);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: input.content,
      ContentType: mimeType,
      CacheControl: 'private, max-age=300',
      Metadata: {
        sha256,
      },
    }),
  );
  return {
    objectKey,
    bucket,
    tenantId,
    originalFileName,
    mimeType,
    sizeBytes: input.content.length,
    sha256,
  };
}

export async function downloadUserFile(objectKeyInput: string): Promise<{buffer: Buffer; contentType: string}> {
  const objectKey = objectKeyInput.trim();
  if (!isUserFileObjectKey(objectKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid user file key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: getUserAssetsBucket(), Key: objectKey}));
    const response = await client.send(new GetObjectCommand({Bucket: getUserAssetsBucket(), Key: objectKey}));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'file not found');
    }
    const body =
      response.Body instanceof Readable
        ? await toBuffer(response.Body)
        : Buffer.from(await response.Body.transformToByteArray());
    return {
      buffer: body,
      contentType: head.ContentType || response.ContentType || DEFAULT_CONTENT_TYPE,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isMissingObjectStoreError(error)) {
      throw new HttpError(404, 'NOT_FOUND', 'file not found');
    }
    throw error;
  }
}

export async function deleteUserFile(objectKeyInput: string): Promise<void> {
  const objectKey = objectKeyInput.trim();
  if (!isUserFileObjectKey(objectKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid user file key');
  }
  const client = getS3Client();
  try {
    await client.send(new DeleteObjectCommand({Bucket: getUserAssetsBucket(), Key: objectKey}));
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }
    throw error;
  }
}
