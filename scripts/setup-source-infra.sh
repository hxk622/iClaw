#!/usr/bin/env bash
set -euo pipefail

: "${ICLAW_SOURCE_PG_VERSION:=16}"
: "${ICLAW_SOURCE_PG_DB:=iclaw_control}"
: "${ICLAW_SOURCE_PG_USER:=iclaw_app}"
: "${ICLAW_SOURCE_PG_PASSWORD:=/yk1HMBzsnATxpaelZaEq8x1t2Vm3c8G}"
: "${ICLAW_SOURCE_REDIS_PASSWORD:=ghN+pxXds9oofegp7CgPH00bpfLkDV5l}"
: "${ICLAW_SOURCE_MINIO_ROOT_USER:=minioadmin}"
: "${ICLAW_SOURCE_MINIO_ROOT_PASSWORD:=minioadmin}"
: "${ICLAW_SOURCE_MINIO_USER:=openalpha}"
: "${ICLAW_SOURCE_MINIO_PASSWORD:=b1+G+wc/UX28Eo4JDbirB6Abs6uVm6t1}"
: "${ICLAW_SOURCE_MINIO_DATA_DIR:=/data/minio}"
: "${ICLAW_SOURCE_MINIO_CONSOLE_PORT:=9001}"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "run as root" >&2
    exit 1
  fi
}

setup_apt() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    redis-server \
    "postgresql-${ICLAW_SOURCE_PG_VERSION}" \
    "postgresql-client-${ICLAW_SOURCE_PG_VERSION}"
}

setup_yum() {
  yum install -y curl ca-certificates redis
  yum install -y "https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-$(uname -m)/pgdg-redhat-repo-latest.noarch.rpm"
  yum -qy module disable postgresql || true
  yum install -y "postgresql${ICLAW_SOURCE_PG_VERSION//./}-server" "postgresql${ICLAW_SOURCE_PG_VERSION//./}"
}

install_minio() {
  curl -fsSL -o /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
  chmod +x /usr/local/bin/minio
  mkdir -p /etc/default /etc/minio "${ICLAW_SOURCE_MINIO_DATA_DIR}"
  cat >/etc/default/minio <<EOF
MINIO_ROOT_USER=${ICLAW_SOURCE_MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${ICLAW_SOURCE_MINIO_ROOT_PASSWORD}
MINIO_VOLUMES=${ICLAW_SOURCE_MINIO_DATA_DIR}
MINIO_OPTS=--address :9000 --console-address :${ICLAW_SOURCE_MINIO_CONSOLE_PORT}
EOF
  cat >/etc/systemd/system/minio.service <<'EOF'
[Unit]
Description=MinIO
After=network-online.target
Wants=network-online.target

[Service]
User=root
Group=root
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server ${MINIO_VOLUMES} ${MINIO_OPTS}
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now minio
}

configure_postgres() {
  local psql_bin=""
  psql_bin="$(command -v psql)"
  local pg_service=""
  pg_service="$(systemctl list-unit-files --type=service --no-legend 'postgresql*' 2>/dev/null | sed -n '1s/[[:space:]].*$//p')"
  if [[ -n "${pg_service}" ]]; then
    systemctl enable --now "${pg_service}"
  fi

  local pg_hba=""
  pg_hba="$(find /etc/postgresql /var/lib/pgsql -name pg_hba.conf -print -quit 2>/dev/null)"
  local pg_conf=""
  pg_conf="$(find /etc/postgresql /var/lib/pgsql -name postgresql.conf -print -quit 2>/dev/null)"
  if [[ -n "${pg_conf}" ]]; then
    sed -i.bak "s/^#\\?listen_addresses.*/listen_addresses = '*'/" "${pg_conf}"
  fi
  if [[ -n "${pg_hba}" ]]; then
    grep -q "0.0.0.0/0" "${pg_hba}" || echo "host all all 0.0.0.0/0 md5" >>"${pg_hba}"
  fi
  systemctl restart "${pg_service:-postgresql}" || true

  if ! su - postgres -c "${psql_bin} -tAc \"select 1 from pg_roles where rolname='${ICLAW_SOURCE_PG_USER}'\"" | grep -q 1; then
    su - postgres -c "${psql_bin} -c \"create role ${ICLAW_SOURCE_PG_USER} login password '${ICLAW_SOURCE_PG_PASSWORD}';\""
  fi
  if ! su - postgres -c "${psql_bin} -tAc \"select 1 from pg_database where datname='${ICLAW_SOURCE_PG_DB}'\"" | grep -q 1; then
    su - postgres -c "${psql_bin} -c \"create database ${ICLAW_SOURCE_PG_DB} owner ${ICLAW_SOURCE_PG_USER};\""
  fi
}

configure_redis() {
  local redis_conf="/etc/redis/redis.conf"
  [[ -f "${redis_conf}" ]] || redis_conf="/etc/redis.conf"
  if [[ -f "${redis_conf}" ]]; then
    sed -i.bak "s/^bind .*/bind 0.0.0.0 127.0.0.1 ::1/" "${redis_conf}" || true
    grep -q "^requirepass " "${redis_conf}" && sed -i.bak "s/^requirepass .*/requirepass ${ICLAW_SOURCE_REDIS_PASSWORD}/" "${redis_conf}" || echo "requirepass ${ICLAW_SOURCE_REDIS_PASSWORD}" >>"${redis_conf}"
    grep -q "^appendonly " "${redis_conf}" && sed -i.bak "s/^appendonly .*/appendonly yes/" "${redis_conf}" || echo "appendonly yes" >>"${redis_conf}"
  fi
  systemctl enable --now redis || systemctl enable --now redis-server
}

print_next_steps() {
  cat <<EOF
[source-setup] completed
- PostgreSQL db: ${ICLAW_SOURCE_PG_DB}
- PostgreSQL user: ${ICLAW_SOURCE_PG_USER}
- Redis password configured
- MinIO root user: ${ICLAW_SOURCE_MINIO_ROOT_USER}
- MinIO app user to create manually via mc/admin if needed: ${ICLAW_SOURCE_MINIO_USER}
EOF
}

require_root

if command -v apt-get >/dev/null 2>&1; then
  setup_apt
elif command -v yum >/dev/null 2>&1; then
  setup_yum
elif command -v dnf >/dev/null 2>&1; then
  setup_yum
else
  echo "unsupported package manager" >&2
  exit 1
fi

configure_postgres
configure_redis
install_minio
print_next_steps
