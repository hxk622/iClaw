import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';

import {config} from './config.ts';
import {HttpError} from './errors.ts';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_BUCKET = 'iclaw-files';
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'OEM_ASSET_STORAGE_NOT_CONFIGURED', 'OEM asset storage is not configured');
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
    if (ext) {
      return ext;
    }
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
    default:
      return 'bin';
  }
}

function guessContentTypeFromPath(pathname: string): string {
  switch (extname(pathname).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
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

function getOemAssetProxyUrl(brandId: string, assetKey: string): string {
  return `${getPublicBaseUrl()}/oem/asset/file?brand_id=${encodeURIComponent(brandId)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function getOemAssetStorageKey(brandId: string, assetKey: string, extension: string): string {
  return `oem-assets/${brandId}/${assetKey}/${Date.now()}-${randomUUID()}.${extension}`;
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function resolveRepoAssetPath(brandId: string, objectKey: string): string {
  const trimmed = objectKey.trim();
  if (!trimmed || trimmed.includes('..')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid repo asset path');
  }
  const normalized = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  const target = resolve(repoRoot, 'brands', brandId, normalized);
  const brandRoot = resolve(repoRoot, 'brands', brandId);
  if (target !== brandRoot && !target.startsWith(`${brandRoot}${sep}`)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid repo asset path');
  }
  if (!existsSync(target)) {
    throw new HttpError(404, 'NOT_FOUND', 'repo asset not found');
  }
  return target;
}

export async function uploadOemAssetFile(input: {
  brandId: string;
  assetKey: string;
  content: Buffer;
  contentType: string;
  filename?: string;
}): Promise<{storageProvider: string; objectKey: string; publicUrl: string}> {
  assertValidAsset(input.content, input.contentType);
  await ensureBucketExists();
  const extension = inferExtension(input.contentType, input.filename);
  const objectKey = getOemAssetStorageKey(input.brandId, input.assetKey, extension);
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
    publicUrl: getOemAssetProxyUrl(input.brandId, input.assetKey),
  };
}

export async function downloadOemAssetFile(input: {
  brandId: string;
  assetKey: string;
  storageProvider: string;
  objectKey: string;
  contentType?: string | null;
}): Promise<{buffer: Buffer; contentType: string}> {
  const provider = input.storageProvider.trim().toLowerCase();
  if (provider === 'repo') {
    const repoPath = resolveRepoAssetPath(input.brandId, input.objectKey);
    const buffer = await readFile(repoPath);
    return {
      buffer,
      contentType: input.contentType?.trim() || guessContentTypeFromPath(repoPath),
    };
  }

  const trimmedKey = input.objectKey.trim();
  if (!trimmedKey.startsWith('oem-assets/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid OEM asset object key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    const response = await client.send(new GetObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM asset not found');
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
      throw new HttpError(404, 'NOT_FOUND', 'OEM asset not found');
    }
    throw error;
  }
}
