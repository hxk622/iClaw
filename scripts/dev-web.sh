#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${ICLAW_API_PORT:-2126}"
WEB_PORT="${ICLAW_WEB_PORT:-1520}"

echo "[web-dev] Starting frontend on :$WEB_PORT"
cd "$ROOT_DIR"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" pnpm --filter @iclaw/desktop dev --host 0.0.0.0 --port "$WEB_PORT"
