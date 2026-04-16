import fs from 'node:fs/promises';
import path from 'node:path';

import {uploadPortalDesktopReleaseFile} from '../src/portal-desktop-release-storage.ts';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv: string[]) {
  const options = {
    appName: '',
    channel: 'prod',
    platform: '',
    arch: '',
    artifactType: '',
    file: '',
    contentType: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || '';
    if (arg === '--app') {
      options.appName = trimString(next);
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      options.channel = trimString(next) || 'prod';
      index += 1;
      continue;
    }
    if (arg === '--platform') {
      options.platform = trimString(next);
      index += 1;
      continue;
    }
    if (arg === '--arch') {
      options.arch = trimString(next);
      index += 1;
      continue;
    }
    if (arg === '--artifact-type') {
      options.artifactType = trimString(next);
      index += 1;
      continue;
    }
    if (arg === '--file') {
      options.file = trimString(next);
      index += 1;
      continue;
    }
    if (arg === '--content-type') {
      options.contentType = trimString(next);
      index += 1;
      continue;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.appName || !options.platform || !options.arch || !options.artifactType || !options.file) {
    throw new Error(
      'Usage: node --experimental-strip-types services/control-plane/scripts/upload-desktop-release-file.ts --app <app> --channel <channel> --platform <platform> --arch <arch> --artifact-type <installer|updater|signature> --file <path> [--content-type <type>]',
    );
  }

  const filePath = path.resolve(options.file);
  const content = await fs.readFile(filePath);
  const upload = await uploadPortalDesktopReleaseFile({
    appName: options.appName,
    channel: options.channel,
    platform: options.platform,
    arch: options.arch,
    artifactType: options.artifactType,
    fileName: path.basename(filePath),
    contentType: options.contentType || 'application/octet-stream',
    content,
  });

  process.stdout.write(`${JSON.stringify(upload, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
