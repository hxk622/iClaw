#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_VERSION="${1:-}"
BUILD_ID="${2:-$(date +%Y%m%d%H%M)}"

if [[ -z "$BASE_VERSION" ]]; then
  echo "Usage: bash scripts/version.sh <MAJOR.MINOR.PATCH> [BUILD_ID]"
  exit 1
fi

if [[ ! "$BUILD_ID" =~ ^[0-9]{12}$ ]]; then
  echo "Invalid build id: $BUILD_ID (expected YYYYMMDDHHMM)"
  exit 1
fi

export BASE_VERSION
export BUILD_ID

node - "$ROOT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const root = process.argv[2];
const baseVersion = process.env.BASE_VERSION;
const buildId = process.env.BUILD_ID;
const fullVersion = `${baseVersion}+${buildId}`;
const releaseVersion = `${baseVersion}.${buildId}`;

if (!semver.valid(baseVersion)) {
  console.error(`Invalid base version: ${baseVersion} (expected SemVer MAJOR.MINOR.PATCH)`);
  process.exit(1);
}

if (!semver.valid(fullVersion)) {
  console.error(`Invalid full version: ${fullVersion}`);
  process.exit(1);
}

function updateJson(file, mutator) {
  const abs = path.join(root, file);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  mutator(data);
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function updateTomlVersion(file) {
  const abs = path.join(root, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const next = raw.replace(/^version = ".*"$/m, `version = "${fullVersion}"`);
  fs.writeFileSync(abs, next, 'utf8');
}

updateJson('package.json', (d) => {
  d.version = fullVersion;
  d.releaseVersion = releaseVersion;
});

updateJson('apps/desktop/package.json', (d) => {
  d.version = fullVersion;
  d.releaseVersion = releaseVersion;
});

updateJson('apps/desktop/src-tauri/tauri.template.conf.json', (d) => {
  d.version = fullVersion;
});

updateJson('apps/desktop/src-tauri/tauri.conf.json', (d) => {
  d.version = fullVersion;
});

updateTomlVersion('apps/desktop/src-tauri/Cargo.toml');
NODE

echo "Updated versions:"
echo "  base:  $BASE_VERSION"
echo "  build: $BUILD_ID"
echo "  full:  ${BASE_VERSION}+${BUILD_ID}"
echo "  release: ${BASE_VERSION}.${BUILD_ID}"
