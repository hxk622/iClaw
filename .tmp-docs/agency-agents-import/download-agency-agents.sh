#!/usr/bin/env zsh
set -euo pipefail

ROOT=".tmp-docs/agency-agents-import"
ORIG_BASE="https://raw.githubusercontent.com/msitarzewski/agency-agents/main"
ZH_BASE="https://raw.githubusercontent.com/jnMetaCode/agency-agents-zh/main"

mkdir -p "$ROOT/orig" "$ROOT/zh"

while IFS= read -r agent_file; do
  [[ -z "$agent_file" ]] && continue
  mkdir -p "$ROOT/orig/${agent_file:h}"
  curl -sS -L -H "User-Agent: iClaw" "$ORIG_BASE/$agent_file" -o "$ROOT/orig/$agent_file"
done < "$ROOT/paths.txt"

while IFS= read -r agent_file; do
  [[ -z "$agent_file" ]] && continue
  mkdir -p "$ROOT/zh/${agent_file:h}"
  curl -sS -L -H "User-Agent: iClaw" "$ZH_BASE/$agent_file" -o "$ROOT/zh/$agent_file"
done < "$ROOT/common-paths.txt"

echo "downloaded agency agent sources"
