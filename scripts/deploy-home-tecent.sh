#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-prod}"

DEFAULT_BRAND="${ICLAW_HOME_BRAND:-${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-licaiclaw}}}"
DEFAULT_TARGETS="172.17.0.5,172.17.0.9"

DEPLOY_SUCCESS=0
ARTIFACT_WORKTREE_DIR=""
ARTIFACT_BRANCH=""
EXPECT_SCRIPT_PATH=""
LOCAL_ARCHIVE=""
KEEP_LOCAL_ARCHIVE=0

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

package_home_archive() {
  DEPLOY_ID="$(date +%Y%m%d%H%M%S)"
  LOCAL_ARCHIVE="${TMPDIR:-/tmp}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.tgz"
  rm -f "$LOCAL_ARCHIVE"
  COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 tar -C "$ROOT_DIR/home-web/dist" -czf "$LOCAL_ARCHIVE" .
}

create_artifact_branch() {
  local artifact_rel_path=".artifacts/home-web-${ICLAW_HOME_BRAND}.tgz"

  ARTIFACT_BRANCH="${ICLAW_ARTIFACT_BRANCH_PREFIX}-${DEPLOY_ID}"
  ARTIFACT_WORKTREE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/iclaw-home-artifact.${DEPLOY_ID}.XXXXXX")"

  git worktree add "$ARTIFACT_WORKTREE_DIR" -b "$ARTIFACT_BRANCH" HEAD >/dev/null
  mkdir -p "$ARTIFACT_WORKTREE_DIR/.artifacts"
  cp "$LOCAL_ARCHIVE" "$ARTIFACT_WORKTREE_DIR/$artifact_rel_path"

  git -C "$ARTIFACT_WORKTREE_DIR" add -f "$artifact_rel_path"
  git -C "$ARTIFACT_WORKTREE_DIR" commit -m "Add temporary home-web deploy artifact" >/dev/null
  git -C "$ARTIFACT_WORKTREE_DIR" push -u origin "$ARTIFACT_BRANCH" >/dev/null

  ARTIFACT_URL="https://raw.githubusercontent.com/${ICLAW_ARTIFACT_GITHUB_REPO}/${ARTIFACT_BRANCH}/${artifact_rel_path}"
  export ARTIFACT_URL
}

delete_artifact_branch() {
  if [[ -z "${ARTIFACT_BRANCH:-}" ]]; then
    return 0
  fi

  git push origin --delete "$ARTIFACT_BRANCH" >/dev/null 2>&1 || true
}

remove_artifact_worktree() {
  if [[ -n "${ARTIFACT_WORKTREE_DIR:-}" && -d "$ARTIFACT_WORKTREE_DIR" ]]; then
    git worktree remove --force "$ARTIFACT_WORKTREE_DIR" >/dev/null 2>&1 || true
  fi
  if [[ -n "${ARTIFACT_BRANCH:-}" ]]; then
    git branch -D "$ARTIFACT_BRANCH" >/dev/null 2>&1 || true
  fi
}

build_remote_nginx_conf() {
  cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${ICLAW_NGINX_SERVER_NAME};

    root ${ICLAW_NGINX_PATH};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
}

build_remote_host_script() {
  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail

host="\$1"
archive="\$HOME/home-web-${ICLAW_HOME_BRAND}.tgz"
conf="\$HOME/${ICLAW_NGINX_SERVER_NAME}.conf"
remote_archive="/tmp/home-web-${ICLAW_HOME_BRAND}.tgz"
remote_conf="/tmp/${ICLAW_NGINX_SERVER_NAME}.conf"
ssh_opts=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

scp "\${ssh_opts[@]}" "\$archive" "${ICLAW_TARGET_USER}@\$host:\$remote_archive"
scp "\${ssh_opts[@]}" "\$conf" "${ICLAW_TARGET_USER}@\$host:\$remote_conf"

ssh "\${ssh_opts[@]}" "${ICLAW_TARGET_USER}@\$host" 'bash -s' <<'INNER'
set -euo pipefail
tmpdir="\$(mktemp -d /tmp/home-web.XXXXXX)"
cleanup() {
  rm -rf "\$tmpdir" /tmp/home-web-${ICLAW_HOME_BRAND}.tgz /tmp/${ICLAW_NGINX_SERVER_NAME}.conf
}
trap cleanup EXIT
tar -xzf /tmp/home-web-${ICLAW_HOME_BRAND}.tgz -C "\$tmpdir"
sudo -n mkdir -p ${ICLAW_NGINX_PATH}
sudo -n find ${ICLAW_NGINX_PATH} -mindepth 1 -maxdepth 1 -exec rm -rf {} + || true
sudo -n cp -a "\$tmpdir"/. ${ICLAW_NGINX_PATH}/
if [[ "${ICLAW_INSTALL_NGINX_CONF}" == "1" ]]; then
  sudo -n mv /tmp/${ICLAW_NGINX_SERVER_NAME}.conf ${ICLAW_NGINX_CONF_PATH}
  sudo -n nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    sudo -n systemctl reload nginx
  else
    sudo -n service nginx reload
  fi
fi
find ${ICLAW_NGINX_PATH} -name '._*' -delete || true
sudo -n find ${ICLAW_NGINX_PATH} -name '._*' -delete || true
sudo -n ls -ld ${ICLAW_NGINX_PATH}
INNER
EOF
}

render_relay_expect_script() {
  EXPECT_SCRIPT_PATH="$(mktemp "${TMPDIR:-/tmp}/deploy-home-relay.${DEPLOY_ID}.XXXXXX.expect")"

  cat > "$EXPECT_SCRIPT_PATH" <<'EOF'
#!/usr/bin/expect -f
set timeout -1

proc wait_for {pattern} {
  expect {
    -re $pattern { return }
    eof { error "session closed unexpectedly while waiting for $pattern" }
  }
}

set password $env(ICLAW_EXPECT_PASSWORD)
set bastion_host $env(ICLAW_BASTION_HOST)
set bastion_user $env(ICLAW_BASTION_USER)
set remote_archive $env(ICLAW_RELAY_REMOTE_ARCHIVE)
set remote_conf $env(ICLAW_RELAY_REMOTE_CONF)
set remote_script $env(ICLAW_RELAY_REMOTE_SCRIPT)
set artifact_url $env(ICLAW_RELAY_ARTIFACT_URL)
set nginx_conf $env(ICLAW_RELAY_NGINX_CONF)
set deploy_helper $env(ICLAW_RELAY_DEPLOY_HELPER)
set hosts_csv $env(ICLAW_RELAY_TARGET_HOSTS)
set login_delay_ms $env(ICLAW_RELAY_LOGIN_DELAY_MS)

send_user "Connecting to relay...\n"
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${bastion_user}@${bastion_host}
wait_for {(?i)password}
send -- "$password\r"
after $login_delay_ms
send -- "\recho __READY__\r"
wait_for {__READY__}

send_user "Writing nginx conf and relay deploy helper...\n"
send -- "cat > $remote_conf <<'EOF'\r$nginx_conf\rEOF\recho __CONF_DONE__\r"
wait_for {__CONF_DONE__}
send -- "cat > $remote_script <<'EOF'\r$deploy_helper\rEOF\rchmod +x $remote_script\recho __SCRIPT_DONE__\r"
wait_for {__SCRIPT_DONE__}

send_user "Downloading artifact on relay...\n"
send -- "curl -L --fail -o $remote_archive $artifact_url && tar -tzf $remote_archive >/dev/null && echo __ARTIFACT_READY__\r"
wait_for {__ARTIFACT_READY__}

foreach raw_host [split $hosts_csv ,] {
  set host [string trim $raw_host]
  if {$host eq ""} {
    continue
  }
  set marker "__DEPLOY_[string map {. _} $host]__"
  send_user "Deploying to $host ...\n"
  send -- "bash $remote_script $host && echo $marker\r"
  wait_for $marker
}

send_user "Cleaning relay temp files...\n"
send -- "rm -f $remote_archive $remote_conf $remote_script\recho __RELAY_CLEAN__\r"
wait_for {__RELAY_CLEAN__}

send -- "exit\r"
expect eof
EOF

  chmod +x "$EXPECT_SCRIPT_PATH"
}

deploy_via_artifact_branch() {
  local nginx_conf
  local deploy_helper

  create_artifact_branch
  nginx_conf="$(build_remote_nginx_conf)"
  deploy_helper="$(build_remote_host_script)"

  export ICLAW_EXPECT_PASSWORD="$ICLAW_BASTION_PASSWORD"
  export ICLAW_BASTION_HOST
  export ICLAW_BASTION_USER
  export ICLAW_RELAY_REMOTE_ARCHIVE="~/home-web-${ICLAW_HOME_BRAND}.tgz"
  export ICLAW_RELAY_REMOTE_CONF="~/${ICLAW_NGINX_SERVER_NAME}.conf"
  export ICLAW_RELAY_REMOTE_SCRIPT="~/deploy-home-${ICLAW_HOME_BRAND}.sh"
  export ICLAW_RELAY_ARTIFACT_URL="$ARTIFACT_URL"
  export ICLAW_RELAY_NGINX_CONF="$nginx_conf"
  export ICLAW_RELAY_DEPLOY_HELPER="$deploy_helper"
  export ICLAW_RELAY_TARGET_HOSTS="$ICLAW_TENCENT_TARGETS"
  export ICLAW_RELAY_LOGIN_DELAY_MS="$ICLAW_RELAY_LOGIN_DELAY_MS"

  render_relay_expect_script
  expect "$EXPECT_SCRIPT_PATH"
}

expect_run() {
  ICLAW_EXPECT_PASSWORD="$ICLAW_BASTION_PASSWORD" expect -f - "$@" <<'EOF'
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

deploy_host_via_scp() {
  local host="$1"
  local target_ref="${ICLAW_TARGET_USER}@${host}"
  local target_archive="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.tgz"
  local target_release_dir="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}"
  local target_prefix
  local nginx_conf
  local inner_command
  local outer_command

  if [[ "$ICLAW_TARGET_USER" == "root" ]]; then
    target_prefix=""
  else
    target_prefix="sudo -n "
  fi

  nginx_conf="$(build_remote_nginx_conf)"

  inner_command="$(cat <<EOF
set -euo pipefail
${target_prefix}mkdir -p $(shell_quote "$ICLAW_NGINX_PATH")
rm -rf $(shell_quote "$target_release_dir")
mkdir -p $(shell_quote "$target_release_dir")
tar -xzf $(shell_quote "$target_archive") -C $(shell_quote "$target_release_dir")
${target_prefix}find $(shell_quote "$ICLAW_NGINX_PATH") -mindepth 1 -maxdepth 1 -exec rm -rf {} +
${target_prefix}cp -a $(shell_quote "$target_release_dir")/. $(shell_quote "$ICLAW_NGINX_PATH")/
${target_prefix}find $(shell_quote "$ICLAW_NGINX_PATH") -name '._*' -delete || true
if [[ $(shell_quote "$ICLAW_INSTALL_NGINX_CONF") == "1" ]]; then
  ${target_prefix}tee $(shell_quote "$ICLAW_NGINX_CONF_PATH") >/dev/null <<'NGINXCONF'
${nginx_conf}
NGINXCONF
  ${target_prefix}nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    ${target_prefix}systemctl reload nginx
  else
    ${target_prefix}service nginx reload
  fi
fi
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

deploy_via_scp() {
  local host

  BASTION_ARCHIVE="${ICLAW_REMOTE_TMP_DIR}/home-web-${ICLAW_HOME_BRAND}-${DEPLOY_ID}.tgz"
  run_on_bastion "rm -rf $(shell_quote "$BASTION_ARCHIVE")"
  copy_to_bastion "$LOCAL_ARCHIVE" "$BASTION_ARCHIVE"

  IFS=',' read -r -a target_hosts <<< "$ICLAW_TENCENT_TARGETS"
  for raw_host in "${target_hosts[@]}"; do
    host="$(trim "$raw_host")"
    [[ -n "$host" ]] || continue
    deploy_host_via_scp "$host"
  done
}

verify_site() {
  echo "Verifying ${ICLAW_DOMAIN}"
  curl -sS "https://${ICLAW_DOMAIN}" | head -20
}

cleanup() {
  rm -f "${EXPECT_SCRIPT_PATH:-}"
  if [[ "${KEEP_LOCAL_ARCHIVE:-0}" != "1" ]]; then
    rm -f "${LOCAL_ARCHIVE:-}"
  fi

  if [[ "${DEPLOY_SUCCESS:-0}" == "1" && "${ICLAW_ARTIFACT_KEEP_BRANCH}" != "1" ]]; then
    delete_artifact_branch
  fi

  remove_artifact_worktree
}
trap cleanup EXIT

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
require_command curl
require_command pnpm
require_command node
require_command git

ICLAW_HOME_BRAND="$DEFAULT_BRAND"
export ICLAW_HOME_BRAND

: "${ICLAW_BASTION_HOST:=relay1.idc.hexun.com}"
: "${ICLAW_BASTION_PORT:=22}"
: "${ICLAW_BASTION_USER:=w-hanxingkai}"
: "${ICLAW_BASTION_PASSWORD:=}"
: "${ICLAW_TARGET_USER:=hxyw_admin}"
: "${ICLAW_TARGET_PORT:=22}"
: "${ICLAW_TENCENT_TARGETS:=$DEFAULT_TARGETS}"
: "${ICLAW_REMOTE_TMP_DIR:=/tmp}"
: "${ICLAW_CONNECT_TIMEOUT:=15}"
: "${ICLAW_DOMAIN:=caiclaw.hexun.com}"
: "${ICLAW_NGINX_SERVER_NAME:=$ICLAW_DOMAIN}"
: "${ICLAW_INSTALL_NGINX_CONF:=1}"
: "${ICLAW_BASTION_TRANSFER_MODE:=artifact}"
: "${ICLAW_ARTIFACT_GITHUB_REPO:=hxk622/iClaw}"
: "${ICLAW_ARTIFACT_BRANCH_PREFIX:=deploy-home-web-artifact}"
: "${ICLAW_ARTIFACT_KEEP_BRANCH:=0}"
: "${ICLAW_RELAY_LOGIN_DELAY_MS:=2000}"

ICLAW_NGINX_PATH="${ICLAW_NGINX_PATH:-$(node "$ROOT_DIR/scripts/read-brand-value.mjs" --brand "$ICLAW_HOME_BRAND" distribution.home.nginxPath | tail -n1)}"
ICLAW_NGINX_CONF_PATH="${ICLAW_NGINX_CONF_PATH:-/etc/nginx/conf.d/${ICLAW_NGINX_SERVER_NAME}.conf}"
export ICLAW_NGINX_PATH
export ICLAW_NGINX_CONF_PATH

if [[ -z "$ICLAW_BASTION_PASSWORD" && "$MODE" == "prod" ]]; then
  read -r -s -p "Bastion password for ${ICLAW_BASTION_USER}@${ICLAW_BASTION_HOST}: " ICLAW_BASTION_PASSWORD
  echo
fi

echo "Building home-web for brand ${ICLAW_HOME_BRAND}"
build_home
package_home_archive

if [[ "$MODE" == "build" ]]; then
  KEEP_LOCAL_ARCHIVE=1
  echo "Build complete: $ROOT_DIR/home-web/dist"
  echo "Archive: $LOCAL_ARCHIVE"
  exit 0
fi

case "$ICLAW_BASTION_TRANSFER_MODE" in
  artifact)
    deploy_via_artifact_branch
    ;;
  scp)
    deploy_via_scp
    ;;
  *)
    echo "Unknown ICLAW_BASTION_TRANSFER_MODE: $ICLAW_BASTION_TRANSFER_MODE (use artifact or scp)" >&2
    exit 1
    ;;
esac

verify_site
DEPLOY_SUCCESS=1

echo "home-web deployed for domain ${ICLAW_DOMAIN}"
echo "Targets: ${ICLAW_TENCENT_TARGETS}"
echo "Nginx path: ${ICLAW_NGINX_PATH}"
if [[ -n "${ARTIFACT_BRANCH:-}" ]]; then
  echo "Artifact branch: ${ARTIFACT_BRANCH}"
fi
