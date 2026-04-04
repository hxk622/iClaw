#!/usr/bin/env bash

normalize_iclaw_env_name() {
  local raw="${1:-}"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    dev|development|local|'')
      echo "dev"
      ;;
    test|testing|staging)
      echo "test"
      ;;
    prod|production|release)
      echo "prod"
      ;;
    *)
      echo ""
      ;;
  esac
}

read_iclaw_env_value_from_file() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  local value
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n1)"
  [[ -n "$value" ]] || return 1
  printf '%s' "$value"
}

read_iclaw_env_value() {
  local root_dir="$1"
  local key="$2"
  local requested_env="${3:-}"
  local include_fallback_env="${4:-1}"
  local selected_env
  selected_env="$(normalize_iclaw_env_name "$requested_env")"
  [[ -n "$selected_env" ]] || selected_env="dev"

  local candidates=(
    "$root_dir/.env.$selected_env.local"
    "$root_dir/.env.local"
    "$root_dir/.env.$selected_env"
  )

  if [[ "$include_fallback_env" == "1" ]]; then
    candidates+=("$root_dir/.env")
  fi

  local env_file=""
  for env_file in "${candidates[@]}"; do
    if read_iclaw_env_value_from_file "$env_file" "$key"; then
      return 0
    fi
  done
  return 1
}

warn_if_iclaw_env_mismatch() {
  local root_dir="$1"
  local key="$2"
  local requested_env="${3:-}"
  local selected_env
  selected_env="$(normalize_iclaw_env_name "$requested_env")"
  [[ -n "$selected_env" ]] || selected_env="dev"

  local scoped_value=""
  local fallback_value=""
  scoped_value="$(read_iclaw_env_value "$root_dir" "$key" "$selected_env" 0 || true)"
  fallback_value="$(read_iclaw_env_value_from_file "$root_dir/.env" "$key" || true)"

  if [[ -n "$scoped_value" && -n "$fallback_value" && "$scoped_value" != "$fallback_value" ]]; then
    echo "[env] Warning: .env has stale $key=$fallback_value, but .env.$selected_env resolves $key=$scoped_value. Using .env.$selected_env." >&2
  fi
}
