import {
  CreateBucketCommand,
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
const DEFAULT_BUCKET = 'iclaw-files';

let s3Client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

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

export function getPrivateSkillArtifactKey(userId: string, slug: string, version: string, artifactFormat: 'tar.gz' | 'zip'): string {
  const ext = artifactFormat === 'zip' ? 'zip' : 'tar.gz';
  return `skills/private/${userId}/${slug}/${version}/artifact.${ext}`;
}

export async function uploadPrivateSkillArtifact(input: {
  userId: string;
  slug: string;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifact: Buffer;
}): Promise<{key: string}> {
  await ensureBucketExists();
  const key = getPrivateSkillArtifactKey(input.userId, input.slug, input.version, input.artifactFormat);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
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
  if (!trimmedKey.startsWith('skills/private/')) {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid private skill artifact key');
  }
  const client = getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    const response = await client.send(new GetObjectCommand({Bucket: getBucket(), Key: trimmedKey}));
    if (!response.Body) {
      throw new HttpError(404, 'NOT_FOUND', 'private skill artifact not found');
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
      throw new HttpError(404, 'NOT_FOUND', 'private skill artifact not found');
    }
    throw error;
  }
}
