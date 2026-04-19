#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

DATA_SYNC_SERVICE_ENABLE_SCHEDULER=1 DATA_SYNC_SERVICE_DETACH=1 bash "$ROOT_DIR/scripts/dev-data-sync.sh"
ICLAW_API_DETACH=1 bash "$ROOT_DIR/scripts/dev-api.sh"
bash "$ROOT_DIR/scripts/dev-web.sh"
