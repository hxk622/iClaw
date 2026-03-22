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
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'PORTAL_ASSET_STORAGE_NOT_CONFIGURED', 'portal asset storage is not configured');
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

function getPublicBaseUrl(): string {
  const base = config.apiUrl || `http://127.0.0.1:${config.port}`;
  return base.replace(/\/$/, '');
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

function inferExtension(contentType: string, filename?: string): string {
  const candidate = filename?.trim() || '';
  if (candidate.includes('.')) {
    const ext = candidate.slice(candidate.lastIndexOf('.') + 1).trim().toLowerCase();
    if (ext) return ext;
  }
  switch (contentType.trim().toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico';
    case 'application/json':
      return 'json';
    default:
      return 'bin';
  }
}

function assertValidAsset(content: Buffer, contentType: string): void {
  if (!contentType.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'asset content_type is required');
  }
  if (content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'asset file is empty');
  }
  if (content.length > MAX_ASSET_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'asset file must be 20MB or smaller');
  }
}

function getPortalAssetProxyUrl(appName: string, assetKey: string): string {
  return `${getPublicBaseUrl()}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function getPortalAssetStorageKey(appName: string, assetKey: string, extension: string): string {
  return `portal-assets/${appName}/${assetKey}/${Date.now()}-${randomUUID()}.${extension}`;
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function uploadPortalAssetFile(input: {
  appName: string;
  assetKey: string;
  content: Buffer;
  contentType: string;
  filename?: string;
}): Promise<{storageProvider: string; objectKey: string; publicUrl: string; sha256: string; sizeBytes: number}> {
  assertValidAsset(input.content, input.contentType);
  await ensureBucketExists();
  const extension = inferExtension(input.contentType, input.filename);
  const objectKey = getPortalAssetStorageKey(input.appName, input.assetKey, extension);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      Body: input.content,
      ContentType: input.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return {
    storageProvider: 's3',
    objectKey,
    publicUrl: getPortalAssetProxyUrl(input.appName, input.assetKey),
    sha256: createHash('sha256').update(input.content).digest('hex'),
    sizeBytes: input.content.length,
  };
}

export async function downloadPortalAssetFile(input: {
  appName: string;
  assetKey: string;
  storageProvider: string;
  objectKey: string;
  contentType?: string | null;
}): Promise<{buffer: Buffer; contentType: string}> {
  if (input.storageProvider.trim().toLowerCase() !== 's3') {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported portal asset storage provider');
  }
  const trimmedKey = input.objectKey.trim();
  if (!trimmedKey.startsWith('portal-assets/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid portal asset object key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    const response = await client.send(new GetObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'portal asset not found');
    }
    const body =
      response.Body instanceof Readable
        ? await toBuffer(response.Body)
        : Buffer.from(await response.Body.transformToByteArray());
    return {
      buffer: body,
      contentType: head.ContentType || response.ContentType || input.contentType?.trim() || 'application/octet-stream',
    };
  } catch (error) {
    const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
    if (error instanceof HttpError) throw error;
    if (name === 'NotFound' || name === 'NoSuchKey') {
      throw new HttpError(404, 'NOT_FOUND', 'portal asset not found');
    }
    throw error;
  }
}

export async function deletePortalAssetFile(input: {storageProvider: string; objectKey: string}): Promise<void> {
  if (input.storageProvider.trim().toLowerCase() !== 's3') {
    return;
  }
  const trimmedKey = input.objectKey.trim();
  if (!trimmedKey.startsWith('portal-assets/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid portal asset object key');
  }
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: trimmedKey,
    }),
  );
}
