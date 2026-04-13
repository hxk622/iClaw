import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { config } from './config.ts';
import { HttpError } from './errors.ts';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_CONTENT_TYPE = 'application/zip';
const MAX_FAULT_REPORT_BYTES = 25 * 1024 * 1024;

let s3Client: S3Client | null = null;
const bucketReady = new Map<string, Promise<void>>();

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'FAULT_REPORT_STORAGE_NOT_CONFIGURED', 'fault report storage is not configured');
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
  return (config.userAssetsBucket || '').trim() || 'iclaw-user-assets';
}

function getTenantId(): string {
  return (config.userAssetsTenantId || config.appName || 'iclaw').trim() || 'iclaw';
}

async function ensureBucketExists(bucket: string): Promise<void> {
  const normalizedBucket = bucket.trim();
  if (!normalizedBucket) {
    throw new HttpError(500, 'FAULT_REPORT_STORAGE_BUCKET_INVALID', 'fault report storage bucket is invalid');
  }
  if (!bucketReady.has(normalizedBucket)) {
    bucketReady.set(normalizedBucket, (async () => {
      const client = getS3Client();
      try {
        await client.send(new HeadBucketCommand({ Bucket: normalizedBucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: normalizedBucket }));
      }
    })().catch((error) => {
      bucketReady.delete(normalizedBucket);
      throw error;
    }));
  }
  await bucketReady.get(normalizedBucket);
}

function sanitizeFileName(fileNameInput: string): string {
  const trimmed = fileNameInput.trim();
  const collapsed = trimmed.replace(/[/\\]+/g, '-').replace(/\s+/g, ' ');
  const safe = collapsed.replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/-+/g, '-').trim();
  return safe || 'fault-report.zip';
}

function buildObjectKey(input: { reportId: string; fileName: string }): string {
  return `tenants/${getTenantId()}/desktop-fault-reports/${input.reportId}/${input.fileName}`;
}

function buildDiagnosticObjectKey(input: { uploadId: string; fileName: string }): string {
  return `tenants/${getTenantId()}/desktop-diagnostic-uploads/${input.uploadId}/${input.fileName}`;
}

function isDesktopFaultReportObjectKey(value: string): boolean {
  return /^tenants\/[^/]+\/desktop-fault-reports\/[^/]+\/.+$/.test(value.trim());
}

function isDesktopDiagnosticObjectKey(value: string): boolean {
  return /^tenants\/[^/]+\/desktop-diagnostic-uploads\/[^/]+\/.+$/.test(value.trim());
}

function isMissingObjectStoreError(error: unknown): boolean {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  return name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket' || name === 'NotFoundError';
}

function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function uploadDesktopFaultReportFile(input: {
  reportId: string;
  fileName: string;
  contentType?: string | null;
  content: Buffer;
}): Promise<{
  bucket: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}> {
  const reportId = input.reportId.trim();
  if (!reportId) {
    throw new HttpError(400, 'BAD_REQUEST', 'report_id is required');
  }
  if (!input.fileName.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'file name is required');
  }
  if (input.content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'file is empty');
  }
  if (input.content.length > MAX_FAULT_REPORT_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'fault report file must be 25MB or smaller');
  }
  const bucket = getBucket();
  const originalFileName = sanitizeFileName(input.fileName);
  const objectKey = buildObjectKey({ reportId, fileName: originalFileName });
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
        report_id: reportId,
      },
    }),
  );
  return {
    bucket,
    objectKey,
    originalFileName,
    mimeType,
    sizeBytes: input.content.length,
    sha256,
  };
}

export async function uploadDesktopDiagnosticFile(input: {
  uploadId: string;
  fileName: string;
  contentType?: string | null;
  content: Buffer;
}): Promise<{
  bucket: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}> {
  const uploadId = input.uploadId.trim();
  if (!uploadId) {
    throw new HttpError(400, 'BAD_REQUEST', 'upload_id is required');
  }
  if (!input.fileName.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'file name is required');
  }
  if (input.content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'file is empty');
  }
  if (input.content.length > MAX_FAULT_REPORT_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'diagnostic file must be 25MB or smaller');
  }
  const bucket = getBucket();
  const originalFileName = sanitizeFileName(input.fileName);
  const objectKey = buildDiagnosticObjectKey({ uploadId, fileName: originalFileName });
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
        upload_id: uploadId,
      },
    }),
  );
  return {
    bucket,
    objectKey,
    originalFileName,
    mimeType,
    sizeBytes: input.content.length,
    sha256,
  };
}

export async function downloadDesktopFaultReportFile(objectKeyInput: string): Promise<{ buffer: Buffer; contentType: string }> {
  const objectKey = objectKeyInput.trim();
  if (!isDesktopFaultReportObjectKey(objectKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid desktop fault report key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: objectKey }));
    const response = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: objectKey }));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'fault report file not found');
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
      throw new HttpError(404, 'NOT_FOUND', 'fault report file not found');
    }
    throw error;
  }
}

export async function downloadDesktopDiagnosticFile(objectKeyInput: string): Promise<{ buffer: Buffer; contentType: string }> {
  const objectKey = objectKeyInput.trim();
  if (!isDesktopDiagnosticObjectKey(objectKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid desktop diagnostic key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: objectKey }));
    const response = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: objectKey }));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'diagnostic file not found');
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
      throw new HttpError(404, 'NOT_FOUND', 'diagnostic file not found');
    }
    throw error;
  }
}

export async function deleteDesktopFaultReportFile(objectKeyInput: string): Promise<void> {
  const objectKey = objectKeyInput.trim();
  if (!isDesktopFaultReportObjectKey(objectKey)) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid desktop fault report key');
  }
  try {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: objectKey }));
  } catch (error) {
    if (isMissingObjectStoreError(error)) {
      return;
    }
    throw error;
  }
}
