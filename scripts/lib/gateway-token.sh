#!/usr/bin/env bash

resolve_gateway_token_file() {
  local state_dir="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
  printf '%s\n' "${ICLAW_GATEWAY_TOKEN_FILE:-${OPENCLAW_GATEWAY_TOKEN_FILE:-$state_dir/gateway-token}}"
}

generate_gateway_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi

  node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'
}

read_gateway_token_file() {
  local token_file="${1:?gateway token file is required}"
  [[ -f "$token_file" ]] || return 0
  sed -n '1{s/^[[:space:]]*//;s/[[:space:]]*$//;p;}' "$token_file"
}

write_gateway_token_file() {
  local token_file="${1:?gateway token file is required}"
  local token="${2:?gateway token is required}"
  mkdir -p "$(dirname "$token_file")"
  printf '%s\n' "$token" >"$token_file"
  chmod 600 "$token_file" >/dev/null 2>&1 || true
}

resolve_gateway_token() {
  local legacy_gateway_token="${1:-}"
  local token_file="${2:-$(resolve_gateway_token_file)}"
  local explicit_gateway_token="${ICLAW_GATEWAY_TOKEN:-${OPENCLAW_GATEWAY_TOKEN:-}}"
  local shared_token=""

  GATEWAY_TOKEN_FILE="$token_file"

  if [[ -n "$explicit_gateway_token" ]]; then
    GATEWAY_TOKEN="$explicit_gateway_token"
    GATEWAY_TOKEN_SOURCE="env explicit gateway token"
    write_gateway_token_file "$token_file" "$GATEWAY_TOKEN"
    return 0
  fi

  shared_token="$(read_gateway_token_file "$token_file")"
  if [[ -n "$shared_token" ]]; then
    GATEWAY_TOKEN="$shared_token"
    GATEWAY_TOKEN_SOURCE="$token_file"
    return 0
  fi

  if [[ -n "$legacy_gateway_token" ]]; then
    GATEWAY_TOKEN="$legacy_gateway_token"
    GATEWAY_TOKEN_SOURCE="migrated legacy VITE_GATEWAY_TOKEN -> $token_file"
    write_gateway_token_file "$token_file" "$GATEWAY_TOKEN"
    return 0
  fi

  GATEWAY_TOKEN="$(generate_gateway_token)"
  GATEWAY_TOKEN_SOURCE="generated -> $token_file"
  write_gateway_token_file "$token_file" "$GATEWAY_TOKEN"
}
