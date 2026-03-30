#!/usr/bin/env bash

openclaw_write_gateway_launcher() {
  local target_path="$1"
  local runtime_root_expr="$2"
  local node_bin_expr="$3"

  cat >"$target_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
RUNTIME_ROOT="$runtime_root_expr"
NODE_BIN="$node_bin_expr"
export PATH="\$(dirname "\$NODE_BIN")\${PATH:+:\$PATH}"
export OPENCLAW_BUNDLED_PLUGINS_DIR="\${OPENCLAW_BUNDLED_PLUGINS_DIR:-\$RUNTIME_ROOT/extensions}"
if [[ -x "\$(dirname "\$NODE_BIN")/python3" ]]; then
  export UV_PYTHON="\${UV_PYTHON:-\$(dirname "\$NODE_BIN")/python3}"
fi
exec "\$NODE_BIN" "\$RUNTIME_ROOT/openclaw.mjs" gateway "\$@"
EOF

  chmod +x "$target_path"
}

openclaw_write_cli_launcher() {
  local target_path="$1"
  local runtime_root_expr="$2"
  local node_bin_expr="$3"

  cat >"$target_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
RUNTIME_ROOT="$runtime_root_expr"
NODE_BIN="$node_bin_expr"
export PATH="\$(dirname "\$NODE_BIN")\${PATH:+:\$PATH}"
export OPENCLAW_BUNDLED_PLUGINS_DIR="\${OPENCLAW_BUNDLED_PLUGINS_DIR:-\$RUNTIME_ROOT/extensions}"
if [[ -x "\$(dirname "\$NODE_BIN")/python3" ]]; then
  export UV_PYTHON="\${UV_PYTHON:-\$(dirname "\$NODE_BIN")/python3}"
fi
exec "\$NODE_BIN" "\$RUNTIME_ROOT/openclaw.mjs" "\$@"
EOF

  chmod +x "$target_path"
}
