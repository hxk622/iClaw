#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-prod}"

if [[ "$MODE" != "prod" ]]; then
  echo "Unknown mode: $MODE (use prod)" >&2
  exit 1
fi

: "${ICLAW_NGINX_HOST:=113.44.132.75}"
: "${ICLAW_NGINX_USER:=root}"
: "${ICLAW_CONTROL_PLANE_HOST:=115.191.6.179}"
: "${ICLAW_CONTROL_PLANE_USER:=root}"

: "${ICLAW_ICLAW_DOMAIN:=https://iclaw.aiyuanxi.com}"
: "${ICLAW_CAICLAW_DOMAIN:=${ICLAW_LICAICLAW_DOMAIN:-https://caiclaw.aiyuanxi.com}}"

: "${ICLAW_DEPLOY_CONTROL_PLANE:=1}"
: "${ICLAW_DEPLOY_ADMIN:=0}"
: "${ICLAW_DEPLOY_ICLAW_HOME:=1}"
: "${ICLAW_DEPLOY_LICAICLAW_HOME:=1}"
: "${ICLAW_DEPLOY_SYNC_DB:=0}"
: "${ICLAW_DEPLOY_DRY_RUN:=0}"
: "${ICLAW_DEPLOY_SMOKE_CHECK:=1}"

CHROME_CANDIDATE_DEFAULT="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
: "${ICLAW_CHROME_BIN:=${CHROME_CANDIDATE_DEFAULT}}"

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env: $key" >&2
    exit 1
  fi
}

shell_join() {
  local joined=""
  local arg=""
  for arg in "$@"; do
    joined+=" $(printf '%q' "$arg")"
  done
  printf '%s' "${joined# }"
}

run_cmd() {
  echo "+ $(shell_join "$@")"
  if [[ "$ICLAW_DEPLOY_DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

run_with_password() {
  local password="$1"
  local command="$2"
  echo "+ $command"
  if [[ "$ICLAW_DEPLOY_DRY_RUN" == "1" ]]; then
    return 0
  fi
  PASSWORD="$password" COMMAND="$command" expect <<'EOF'
set timeout -1
set password $env(PASSWORD)
set command $env(COMMAND)
spawn bash -lc $command
expect {
  -re "yes/no" {
    send "yes\r"
    exp_continue
  }
  -re "[Pp]assword:" {
    send -- "$password\r"
    exp_continue
  }
  eof
}
catch wait result
set exit_status [lindex $result 3]
exit $exit_status
EOF
}

resolve_brand_domain() {
  local brand="$1"
  case "$brand" in
    iclaw) printf '%s' "$ICLAW_ICLAW_DOMAIN" ;;
    caiclaw|licaiclaw) printf '%s' "$ICLAW_CAICLAW_DOMAIN" ;;
    *)
      echo "Unsupported brand: $brand" >&2
      exit 1
      ;;
  esac
}

resolve_brand_nginx_path() {
  local brand="$1"
  node "$ROOT_DIR/scripts/read-brand-value.mjs" --brand "$brand" distribution.home.nginxPath | tail -n1
}

build_home_web_brand() {
  local brand="$1"
  local domain="$2"
  run_cmd rm -rf "$ROOT_DIR/.tmp-brand-state/home-web-build"
  run_cmd bash "$ROOT_DIR/scripts/with-env.sh" prod sh -lc \
    "APP_NAME=${brand} ICLAW_PORTAL_APP_NAME=${brand} VITE_AUTH_BASE_URL=${domain} pnpm --dir home-web build"
}

deploy_home_web_brand() {
  local brand="$1"
  local domain="$2"
  local nginx_path="$3"
  require_env ICLAW_NGINX_PASSWORD
  build_home_web_brand "$brand" "$domain"
  run_with_password \
    "$ICLAW_NGINX_PASSWORD" \
    "cd $(printf '%q' "$ROOT_DIR") && ssh ${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST} \"mkdir -p ${nginx_path}\" && rsync -avz --delete home-web/dist/ ${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${nginx_path}/"
}

deploy_control_plane() {
  require_env ICLAW_CONTROL_PLANE_PASSWORD
  run_with_password \
    "$ICLAW_CONTROL_PLANE_PASSWORD" \
    "cd $(printf '%q' "$ROOT_DIR") && bash scripts/deploy-control-plane.sh prod"
}

deploy_admin() {
  require_env ICLAW_NGINX_PASSWORD
  run_with_password \
    "$ICLAW_NGINX_PASSWORD" \
    "cd $(printf '%q' "$ROOT_DIR") && bash scripts/deploy-admin.sh prod"
}

sync_db_to_prod() {
  require_env ICLAW_CONTROL_PLANE_PASSWORD
  run_with_password \
    "$ICLAW_CONTROL_PLANE_PASSWORD" \
    "cd $(printf '%q' "$ROOT_DIR") && bash scripts/sync-control-plane-db-to-prod.sh"
}

extract_artifact_name() {
  local app_name="$1"
  local domain="$2"
  local target="$3"
  local arch="$4"
  local manifest
  manifest="$(curl -fsS "${domain}/desktop/release-manifest?app_name=${app_name}&channel=prod&target=${target}&arch=${arch}")"
  printf '%s' "$manifest" | node --input-type=module -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk));
    process.stdin.on("end", () => {
      const payload = JSON.parse(raw || "{}");
      const entry =
        payload && payload.entry && payload.entry.platform === process.argv[1] && payload.entry.arch === process.argv[2]
          ? payload.entry
          : Array.isArray(payload.entries)
            ? payload.entries.find((item) => item.platform === process.argv[1] && item.arch === process.argv[2])
            : null;
      process.stdout.write((entry && entry.artifact_name) || "");
    });
  ' "$target" "$arch"
}

check_chrome_available() {
  [[ -x "$ICLAW_CHROME_BIN" ]]
}

smoke_check_domain() {
  local brand="$1"
  local domain="$2"
  local expected_template="$3"
  local expected_title="$4"
  local mac_artifact_name
  local windows_artifact_name

  echo "[smoke] checking ${brand} via ${domain}"
  run_cmd curl -fsS "${domain}/health"
  mac_artifact_name="$(extract_artifact_name "$brand" "$domain" "darwin" "aarch64")"
  if [[ -z "$mac_artifact_name" ]]; then
    echo "Missing aarch64 artifact_name in release manifest for ${brand}" >&2
    exit 1
  fi
  run_cmd curl -I -fsS "${domain}/downloads/mac/aarch64/${mac_artifact_name}"
  windows_artifact_name="$(extract_artifact_name "$brand" "$domain" "windows" "x64")"
  if [[ -z "$windows_artifact_name" ]]; then
    echo "Missing windows/x64 artifact_name in release manifest for ${brand}" >&2
    exit 1
  fi
  run_cmd curl -I -fsS "${domain}/downloads/windows/x64/${windows_artifact_name}"

  if check_chrome_available; then
    local dom
    dom="$("$ICLAW_CHROME_BIN" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom "${domain}/" 2>/dev/null)"
    printf '%s' "$dom" | grep -q "data-template-key=\"${expected_template}\""
    printf '%s' "$dom" | grep -q "<title>${expected_title}</title>"
    printf '%s' "$dom" | grep -q "Mac Intel"
    printf '%s' "$dom" | grep -q "Windows x64"
  else
    echo "[smoke] chrome headless unavailable, skipping DOM verification"
  fi
}

main() {
  if [[ "$ICLAW_DEPLOY_DRY_RUN" == "1" && "$ICLAW_DEPLOY_SMOKE_CHECK" == "1" ]]; then
    echo "[deploy-prod-marketing] dry-run mode detected, skip smoke checks"
    ICLAW_DEPLOY_SMOKE_CHECK=0
  fi

  if [[ "$ICLAW_DEPLOY_CONTROL_PLANE" == "1" ]]; then
    deploy_control_plane
  fi

  if [[ "$ICLAW_DEPLOY_SYNC_DB" == "1" ]]; then
    sync_db_to_prod
  fi

  if [[ "$ICLAW_DEPLOY_ADMIN" == "1" ]]; then
    deploy_admin
  fi

  if [[ "$ICLAW_DEPLOY_ICLAW_HOME" == "1" ]]; then
    deploy_home_web_brand "iclaw" "$ICLAW_ICLAW_DOMAIN" "$(resolve_brand_nginx_path iclaw)"
  fi

  if [[ "$ICLAW_DEPLOY_LICAICLAW_HOME" == "1" ]]; then
    deploy_home_web_brand "caiclaw" "$ICLAW_CAICLAW_DOMAIN" "$(resolve_brand_nginx_path caiclaw)"
  fi

  if [[ "$ICLAW_DEPLOY_SMOKE_CHECK" == "1" ]]; then
    smoke_check_domain "iclaw" "$ICLAW_ICLAW_DOMAIN" "classic-download" "iClaw 官网"
    smoke_check_domain "caiclaw" "$ICLAW_CAICLAW_DOMAIN" "wealth-premium" "理财客官网"
  fi

  echo
  echo "[deploy-prod-marketing] done"
}

main "$@"
