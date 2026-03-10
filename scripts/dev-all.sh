#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

ICLAW_API_DETACH=1 bash "$ROOT_DIR/scripts/dev-api.sh"
bash "$ROOT_DIR/scripts/dev-web.sh"
