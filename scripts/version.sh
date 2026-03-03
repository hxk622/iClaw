#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: bash scripts/version.sh <MAJOR.MINOR.PATCH>"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $VERSION (expected MAJOR.MINOR.PATCH)"
  exit 1
fi

export VERSION

node <<'NODE'
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const version = process.env.VERSION;

function updateJson(file, mutator) {
  const abs = path.join(root, file);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  mutator(data);
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

updateJson('package.json', (d) => {
  d.version = version;
});

updateJson('apps/desktop/package.json', (d) => {
  d.version = version;
});

updateJson('apps/desktop/src-tauri/tauri.conf.json', (d) => {
  d.version = version;
});
NODE

echo "Updated versions to $VERSION"
