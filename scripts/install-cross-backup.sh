#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_SCRIPT="${ROOT_DIR}/scripts/run-cross-backup.sh"
ENV_SOURCE="${1:-}"
TARGET_HOST="${2:-local}"

: "${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT:=/usr/local/bin/iclaw-cross-backup.sh}"
: "${ICLAW_CROSS_BACKUP_REMOTE_ENV:=/etc/iclaw/cross-backup.env}"
: "${ICLAW_CROSS_BACKUP_CRON_SCHEDULE:=0 3 * * *}"
: "${ICLAW_CROSS_BACKUP_LOG_FILE:=/var/log/iclaw-cross-backup.log}"
: "${ICLAW_CROSS_BACKUP_LOCK_FILE:=/var/lock/iclaw-cross-backup.lock}"
: "${ICLAW_CROSS_BACKUP_INSTALL_MC:=1}"
: "${ICLAW_CROSS_BACKUP_RUN_AFTER_INSTALL:=0}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/install-cross-backup.sh <env-file> [user@host]

Examples:
  bash scripts/install-cross-backup.sh ./cross-backup.prod.env
  bash scripts/install-cross-backup.sh ./cross-backup.prod.env root@39.106.110.149
EOF
}

log() {
  echo "[cross-backup-install] $*"
}

fail() {
  echo "[cross-backup-install] $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    fail "missing required command: ${cmd}"
  fi
}

run_remote() {
  local command_text="$1"
  if [[ "${TARGET_HOST}" == "local" ]]; then
    bash -c "${command_text}"
    return
  fi
  ssh "${TARGET_HOST}" "${command_text}"
}

copy_to_remote() {
  local source_path="$1"
  local dest_path="$2"

  if [[ "${TARGET_HOST}" == "local" ]]; then
    install -m 0600 "${source_path}" "${dest_path}"
    return
  fi

  scp "${source_path}" "${TARGET_HOST}:${dest_path}"
}

install_mc_remote() {
  run_remote "
set -euo pipefail
if command -v mc >/dev/null 2>&1; then
  exit 0
fi
if [[ \"${ICLAW_CROSS_BACKUP_INSTALL_MC}\" != \"1\" ]]; then
  echo '[cross-backup-install] mc is missing and auto-install is disabled' >&2
  exit 1
fi
if command -v curl >/dev/null 2>&1; then
  curl -fsSL -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc
elif command -v wget >/dev/null 2>&1; then
  wget -qO /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc
else
  echo '[cross-backup-install] curl or wget is required to install mc' >&2
  exit 1
fi
chmod +x /usr/local/bin/mc
"
}

install_cron_remote() {
  run_remote "
set -euo pipefail
if ! command -v crontab >/dev/null 2>&1; then
  echo '[cross-backup-install] crontab is required on target host' >&2
  exit 1
fi
cron_prefix=''
if command -v flock >/dev/null 2>&1; then
  cron_prefix=\"flock -n ${ICLAW_CROSS_BACKUP_LOCK_FILE} \"
fi
cron_entry=\"${ICLAW_CROSS_BACKUP_CRON_SCHEDULE} \${cron_prefix}${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT} ${ICLAW_CROSS_BACKUP_REMOTE_ENV} >> ${ICLAW_CROSS_BACKUP_LOG_FILE} 2>&1 # iclaw-cross-backup\"
existing_crontab=\"\$(crontab -l 2>/dev/null || true)\"
{
  printf '%s\n' \"\${existing_crontab}\" | sed '/# iclaw-cross-backup$/d'
  printf '%s\n' \"\${cron_entry}\"
} | crontab -
"
}

run_once_if_needed() {
  if [[ "${ICLAW_CROSS_BACKUP_RUN_AFTER_INSTALL}" != "1" ]]; then
    return
  fi
  log "running a one-off backup on ${TARGET_HOST}"
  run_remote "${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT} ${ICLAW_CROSS_BACKUP_REMOTE_ENV}"
}

main() {
  if [[ -z "${ENV_SOURCE}" ]]; then
    usage
    exit 1
  fi

  if [[ ! -f "${LOCAL_SCRIPT}" ]]; then
    fail "backup runner not found: ${LOCAL_SCRIPT}"
  fi

  if [[ ! -f "${ENV_SOURCE}" ]]; then
    fail "env file not found: ${ENV_SOURCE}"
  fi

  require_command install
  if [[ "${TARGET_HOST}" != "local" ]]; then
    require_command ssh
    require_command scp
  fi

  log "installing runner to ${TARGET_HOST}:${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT}"
  run_remote "mkdir -p '$(dirname "${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT}")' '$(dirname "${ICLAW_CROSS_BACKUP_REMOTE_ENV}")' '$(dirname "${ICLAW_CROSS_BACKUP_LOG_FILE}")'"

  local remote_script_tmp="${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT}.tmp"
  local remote_env_tmp="${ICLAW_CROSS_BACKUP_REMOTE_ENV}.tmp"

  copy_to_remote "${LOCAL_SCRIPT}" "${remote_script_tmp}"
  copy_to_remote "${ENV_SOURCE}" "${remote_env_tmp}"

  run_remote "
set -euo pipefail
install -m 0755 '${remote_script_tmp}' '${ICLAW_CROSS_BACKUP_REMOTE_SCRIPT}'
install -m 0600 '${remote_env_tmp}' '${ICLAW_CROSS_BACKUP_REMOTE_ENV}'
rm -f '${remote_script_tmp}' '${remote_env_tmp}'
"

  install_mc_remote
  install_cron_remote
  run_once_if_needed

  log "installed on ${TARGET_HOST}"
}

main "$@"
