#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-prod}"

DEFAULT_BRAND="${ICLAW_HOME_BRAND:-${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-licaiclaw}}}"
DEFAULT_TARGETS="172.17.0.5,172.17.0.9"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

shell_quote() {
  printf "%q" "$1"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf "%s" "$value"
}

expect_run() {
  ICLAW_EXPECT_PASSWORD="$ICLAW_BASTION_PASSWORD" expect <<'EOF' "$@"
set timeout -1
set password $env(ICLAW_EXPECT_PASSWORD)
spawn {*}$argv
expect {
  -re {(?i)yes/no} {
    send "yes\r"
    exp_continue
  }
  -re {(?i)(password|passcode):\s*$} {
    send "$password\r"
    exp_continue
  }
  eof
}
catch wait result
set exit_status [lindex $result 3]
exit $exit_status
EOF
}

run_on_bastion() {
  local remote_command="$1"
  expect_run \
    ssh \
    -tt \
    -p "$ICLAW_BASTION_PORT" \
    -o ConnectTimeout="$ICLAW_CONNECT_TIMEOUT" \
    -o ServerAliveInterval=30 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${ICLAW_BASTION_USER}@${ICLAW_BASTION_HOST}" \
    "bash -lc $(shell_quote "$remote_command")"
}

copy_to_bastion() {
  local local_path="$1"
  local remote_path="$2"
  expect_run \
    scp \
    -P "$ICLAW_BASTION_PORT" \
    -o ConnectTimeout="$ICLAW_CONNECT_TIMEOUT" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "$local_path" \
    "${ICLAW_BASTION_USER}@${ICLAW_BASTION_HOST}:${remote_path}"
}

build_home() {
  cd "$ROOT_DIR"
  bash "$ROOT_DIR/scripts/with-env.sh" \
    prod \
    env \
    APP_NAME="$ICLAW_HOME_BRAND" \
    ICLAW_BRAND="$ICLAW_HOME_BRAND" \
    ICLAW_PORTAL_APP_NAME="$ICLAW_HOME_BRAND" \
    ICLAW_PACKAGING_ENV=prod \
    ICLAW_USE_PACKAGING_SOURCE_ENV=1 \
    pnpm \
    --dir \
    home-web \
    build
}

deploy_host() {
  local host="$1"
  local target_ref="${ICLAW_TARGET_USER}@${host}"
  local target_archive="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.tgz"
  local target_release_dir="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}"
  local inner_command
  local outer_command

  inner_command="$(cat <<EOF
set -euo pipefail
mkdir -p $(shell_quote "$ICLAW_NGINX_PATH")
rm -rf $(shell_quote "$target_release_dir")
mkdir -p $(shell_quote "$target_release_dir")
tar -xzf $(shell_quote "$target_archive") -C $(shell_quote "$target_release_dir")
find $(shell_quote "$ICLAW_NGINX_PATH") -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a $(shell_quote "$target_release_dir")/. $(shell_quote "$ICLAW_NGINX_PATH")/
rm -rf $(shell_quote "$target_release_dir") $(shell_quote "$target_archive")
EOF
)"

  outer_command="$(cat <<EOF
set -euo pipefail
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $(shell_quote "$ICLAW_TARGET_PORT") $(shell_quote "$target_ref") true
scp -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P $(shell_quote "$ICLAW_TARGET_PORT") $(shell_quote "$BASTION_ARCHIVE") $(shell_quote "${target_ref}:${target_archive}")
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $(shell_quote "$ICLAW_TARGET_PORT") $(shell_quote "$target_ref") "bash -lc $(shell_quote "$inner_command")"
EOF
)"

  echo "Deploying home-web to ${host}:${ICLAW_NGINX_PATH} via bastion ${ICLAW_BASTION_HOST}"
  run_on_bastion "$outer_command"
}

if [[ "$MODE" == "dev" ]]; then
  exec bash "$ROOT_DIR/scripts/deploy-home.sh" dev
fi

if [[ "$MODE" != "prod" && "$MODE" != "build" ]]; then
  echo "Unknown mode: $MODE (use dev, build, or prod)" >&2
  exit 1
fi

require_command expect
require_command ssh
require_command scp
require_command tar
require_command pnpm
require_command node

ICLAW_HOME_BRAND="$DEFAULT_BRAND"
export ICLAW_HOME_BRAND

: "${ICLAW_BASTION_HOST:=relay1.idc.hexun.com}"
: "${ICLAW_BASTION_PORT:=22}"
: "${ICLAW_BASTION_USER:=w-hanxingkai}"
: "${ICLAW_BASTION_PASSWORD:=}"
: "${ICLAW_TARGET_USER:=root}"
: "${ICLAW_TARGET_PORT:=22}"
: "${ICLAW_TENCENT_TARGETS:=$DEFAULT_TARGETS}"
: "${ICLAW_REMOTE_TMP_DIR:=/tmp}"
: "${ICLAW_CONNECT_TIMEOUT:=15}"
: "${ICLAW_DOMAIN:=caiclaw.hexun.com}"

ICLAW_NGINX_PATH="${ICLAW_NGINX_PATH:-$(node "$ROOT_DIR/scripts/read-brand-value.mjs" --brand "$ICLAW_HOME_BRAND" distribution.home.nginxPath | tail -n1)}"
export ICLAW_NGINX_PATH

if [[ -z "$ICLAW_BASTION_PASSWORD" && "$MODE" == "prod" ]]; then
  read -r -s -p "Bastion password for ${ICLAW_BASTION_USER}@${ICLAW_BASTION_HOST}: " ICLAW_BASTION_PASSWORD
  echo
fi

echo "Building home-web for brand ${ICLAW_HOME_BRAND}"
build_home

if [[ "$MODE" == "build" ]]; then
  echo "Build complete: $ROOT_DIR/home-web/dist"
  exit 0
fi

DEPLOY_ID="$(date +%Y%m%d%H%M%S)"
LOCAL_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.XXXXXX.tgz")"
BASTION_ARCHIVE="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.tgz"

cleanup() {
  rm -f "$LOCAL_ARCHIVE"
  if [[ -n "${ICLAW_BASTION_PASSWORD:-}" ]]; then
    run_on_bastion "rm -f $(shell_quote "$BASTION_ARCHIVE")" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

tar -C "$ROOT_DIR/home-web/dist" -czf "$LOCAL_ARCHIVE" .

echo "Uploading release archive to bastion ${ICLAW_BASTION_HOST}:${BASTION_ARCHIVE}"
copy_to_bastion "$LOCAL_ARCHIVE" "$BASTION_ARCHIVE"

IFS=',' read -r -a target_hosts <<< "$ICLAW_TENCENT_TARGETS"
for raw_host in "${target_hosts[@]}"; do
  host="$(trim "$raw_host")"
  [[ -n "$host" ]] || continue
  deploy_host "$host"
done

echo "home-web deployed for domain ${ICLAW_DOMAIN}"
echo "Targets: ${ICLAW_TENCENT_TARGETS}"
echo "Nginx path: ${ICLAW_NGINX_PATH}"
