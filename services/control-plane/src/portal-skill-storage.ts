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
const MAX_ARTIFACT_BYTES = 200 * 1024 * 1024;

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function portalSkillStorageTimeoutMs(): number {
  const parsed = Number(process.env.ICLAW_PORTAL_SKILL_STORAGE_TIMEOUT_MS || 8000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const timeoutMs = portalSkillStorageTimeoutMs();
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function hasS3Config(): boolean {
  return Boolean(config.s3AccessKey && config.s3SecretKey);
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new HttpError(501, 'PORTAL_SKILL_STORAGE_NOT_CONFIGURED', 'portal skill storage is not configured');
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

function normalizeArtifactFormat(filename?: string | null, contentType?: string | null): 'tar.gz' | 'zip' {
  const lowerFilename = String(filename || '').trim().toLowerCase();
  if (lowerFilename.endsWith('.zip')) {
    return 'zip';
  }
  if (lowerFilename.endsWith('.tar.gz') || lowerFilename.endsWith('.tgz')) {
    return 'tar.gz';
  }
  const lowerContentType = String(contentType || '').trim().toLowerCase();
  if (lowerContentType.includes('zip')) {
    return 'zip';
  }
  return 'tar.gz';
}

function assertValidArtifact(content: Buffer): void {
  if (content.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'skill artifact file is empty');
  }
  if (content.length > MAX_ARTIFACT_BYTES) {
    throw new HttpError(400, 'BAD_REQUEST', 'skill artifact file must be 200MB or smaller');
  }
}

function buildObjectKey(slug: string, format: 'tar.gz' | 'zip'): string {
  return `portal-skills/${slug}/${Date.now()}-${randomUUID()}/artifact.${format === 'zip' ? 'zip' : 'tar.gz'}`;
}

function assertSupportedObjectKey(objectKeyInput: string): string {
  const objectKey = objectKeyInput.trim();
  if (!objectKey) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid portal skill object key');
  }
  if (!objectKey.startsWith('portal-skills/') && !objectKey.startsWith('skills/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid portal skill object key');
  }
  return objectKey;
}

export async function uploadPortalSkillArtifact(input: {
  slug: string;
  artifact: Buffer;
  filename?: string | null;
  contentType?: string | null;
  objectKey?: string | null;
}): Promise<{objectKey: string; contentSha256: string; sizeBytes: number; artifactFormat: 'tar.gz' | 'zip'}> {
  assertValidArtifact(input.artifact);
  await ensureBucketExists();
  const artifactFormat = normalizeArtifactFormat(input.filename, input.contentType);
  const objectKey = input.objectKey?.trim() || buildObjectKey(input.slug, artifactFormat);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      Body: input.artifact,
      ContentType: artifactFormat === 'zip' ? 'application/zip' : 'application/gzip',
      CacheControl: 'private, max-age=300',
    }),
  );
  return {
    objectKey,
    contentSha256: createHash('sha256').update(input.artifact).digest('hex'),
    sizeBytes: input.artifact.length,
    artifactFormat,
  };
}

export async function downloadPortalSkillArtifact(objectKeyInput: string): Promise<{buffer: Buffer; contentType: string}> {
  const objectKey = assertSupportedObjectKey(objectKeyInput);
  const client = getS3Client();
  try {
    const head = await withTimeout(
      client.send(new HeadObjectCommand({Bucket: getBucket(), Key: objectKey})),
      `portal skill head ${objectKey}`,
    );
    const response = await withTimeout(
      client.send(new GetObjectCommand({Bucket: getBucket(), Key: objectKey})),
      `portal skill get ${objectKey}`,
    );
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'portal skill artifact not found');
    }
    const body =
      response.Body instanceof Readable
        ? await withTimeout(toBuffer(response.Body), `portal skill stream ${objectKey}`)
        : Buffer.from(await withTimeout(response.Body.transformToByteArray(), `portal skill bytes ${objectKey}`));
    return {
      buffer: body,
      contentType: head.ContentType || response.ContentType || 'application/octet-stream',
    };
  } catch (error) {
    const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
    if (error instanceof HttpError) throw error;
    if (name === 'NotFound' || name === 'NoSuchKey') {
      throw new HttpError(404, 'NOT_FOUND', 'portal skill artifact not found');
    }
    throw error;
  }
}

export async function deletePortalSkillArtifact(objectKeyInput: string): Promise<void> {
  const objectKey = assertSupportedObjectKey(objectKeyInput);
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }),
  );
}
