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
const DEFAULT_BUCKET = 'iclaw-files';
const MAX_DESKTOP_RELEASE_BYTES = 1024 * 1024 * 1024;

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'DESKTOP_RELEASE_STORAGE_NOT_CONFIGURED', 'desktop release storage is not configured');
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

function getBucket(): string {
  return config.s3Bucket || DEFAULT_BUCKET;
}

async function ensureBucketExists(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = getS3Client();
      try {
        await client.send(new HeadBucketCommand({Bucket: getBucket()}));
      } catch {
        await client.send(new CreateBucketCommand({Bucket: getBucket()}));
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assertValidFile(content: Buffer, fileName: string): void {
  if (!fileName) {
    throw new HttpError(400, 'BAD_REQUEST', 'desktop release file_name is required');
  }
  if (content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'desktop release file is empty');
  }
  if (content.length > MAX_DESKTOP_RELEASE_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'desktop release file must be 1GB or smaller');
  }
}

function sanitizePathToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function buildObjectKey(input: {
  appName: string;
  channel: string;
  platform: string;
  arch: string;
  artifactType: string;
  fileName: string;
}): string {
  return [
    'desktop-releases',
    sanitizePathToken(input.appName),
    sanitizePathToken(input.channel),
    sanitizePathToken(input.platform),
    sanitizePathToken(input.arch),
    sanitizePathToken(input.artifactType),
    `${Date.now()}-${randomUUID()}-${sanitizePathToken(input.fileName)}`,
  ].join('/');
}

function assertSupportedObjectKey(objectKeyInput: string): string {
  const objectKey = objectKeyInput.trim();
  if (!objectKey.startsWith('desktop-releases/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid desktop release object key');
  }
  return objectKey;
}

export async function uploadPortalDesktopReleaseFile(input: {
  appName: string;
  channel: string;
  platform: string;
  arch: string;
  artifactType: string;
  fileName: string;
  contentType: string;
  content: Buffer;
}): Promise<{
  storageProvider: string;
  objectKey: string;
  contentType: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
}> {
  const fileName = trimString(input.fileName);
  assertValidFile(input.content, fileName);
  await ensureBucketExists();
  const objectKey = buildObjectKey({
    appName: input.appName,
    channel: input.channel,
    platform: input.platform,
    arch: input.arch,
    artifactType: input.artifactType,
    fileName,
  });
  const contentType = trimString(input.contentType) || 'application/octet-stream';
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      Body: input.content,
      ContentType: contentType,
      CacheControl: 'private, max-age=300',
    }),
  );
  return {
    storageProvider: 's3',
    objectKey,
    contentType,
    fileName,
    sha256: createHash('sha256').update(input.content).digest('hex'),
    sizeBytes: input.content.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function downloadPortalDesktopReleaseFile(objectKeyInput: string): Promise<{buffer: Buffer; contentType: string}> {
  const objectKey = assertSupportedObjectKey(objectKeyInput);
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: getBucket(), Key: objectKey}));
    const response = await client.send(new GetObjectCommand({Bucket: getBucket(), Key: objectKey}));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop release file not found');
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
      throw new HttpError(404, 'NOT_FOUND', 'desktop release file not found');
    }
    throw error;
  }
}

export async function deletePortalDesktopReleaseFile(objectKeyInput: string): Promise<void> {
  const objectKey = assertSupportedObjectKey(objectKeyInput);
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }),
  );
}
