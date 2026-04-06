#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_SNAPSHOT_PATH = path.join(ROOT_DIR, 'services', 'control-plane', 'baselines', 'platform-db.snapshot.json');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readArg(name) {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) {
    return '';
  }
  return trimString(process.argv[index + 1] || '');
}

function addBucket(set, value) {
  const normalized = trimString(value);
  if (normalized) {
    set.add(normalized);
  }
}

function addCsvBuckets(set, value) {
  const normalized = trimString(value);
  if (!normalized) {
    return;
  }
  for (const item of normalized.split(',')) {
    addBucket(set, item);
  }
}

function readPath(root, pathExpression) {
  return pathExpression
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), root);
}

async function main() {
  const snapshotPath = path.resolve(readArg('--snapshot') || readArg('--manifest') || DEFAULT_SNAPSHOT_PATH);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const buckets = new Set();

  for (const rawApp of Array.isArray(snapshot.apps) ? snapshot.apps : []) {
    const app = rawApp && typeof rawApp === 'object' ? rawApp.app || {} : {};
    const config = app && typeof app === 'object' ? app.config || {} : {};
    addBucket(buckets, readPath(config, 'controlPlane.s3Bucket'));
    addBucket(buckets, readPath(config, 'controlPlane.s3_bucket'));
    addBucket(buckets, readPath(config, 'distribution.downloads.dev.bucket'));
    addBucket(buckets, readPath(config, 'distribution.downloads.prod.bucket'));
    addBucket(buckets, readPath(config, 'runtimeDistribution.dev.bucket'));
    addBucket(buckets, readPath(config, 'runtimeDistribution.prod.bucket'));
  }

  addBucket(buckets, process.env.USER_ASSETS_BUCKET || process.env.ICLAW_USER_ASSETS_BUCKET || 'iclaw-user-assets');
  addCsvBuckets(buckets, process.env.ICLAW_EXTRA_SYNC_BUCKETS || '');

  for (const bucket of buckets) {
    process.stdout.write(`${bucket}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
