#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/openclaw-package.sh"
source "$ROOT_DIR/scripts/lib/openclaw-launcher.sh"

SOURCE_DIR="${OPENCLAW_SOURCE_DIR:-}"
OUT_DIR="${OPENCLAW_RUNTIME_OUT_DIR:-$ROOT_DIR/.artifacts/openclaw-runtime}"
SKIP_BUILD="${OPENCLAW_SKIP_BUILD:-0}"
NPM_SPEC="${OPENCLAW_NPM_SPEC:-}"
PACKAGE_TGZ="${OPENCLAW_PACKAGE_TGZ:-}"
TMP_ROOT=""
PREPARED_PACKAGE_TGZ=""

cleanup() {
  if [[ -n "$TMP_ROOT" && -d "$TMP_ROOT" ]]; then
    rm -rf "$TMP_ROOT"
  fi
}

trap cleanup EXIT

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$src/" "$dest/"
  else
    cp -R "$src/." "$dest/"
  fi
}

infer_target_triple() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "aarch64-apple-darwin" ;;
        x86_64) echo "x86_64-apple-darwin" ;;
        *) return 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) echo "x86_64-unknown-linux-gnu" ;;
        arm64|aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *) return 1 ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      case "$arch" in
        x86_64|amd64) echo "x86_64-pc-windows-msvc" ;;
        arm64|aarch64) echo "aarch64-pc-windows-msvc" ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

TARGET_TRIPLE="${1:-$(infer_target_triple)}"
NODE_BIN="${OPENCLAW_NODE_BIN:-$(command -v node || true)}"
BUNDLE_PYTHON="${OPENCLAW_BUNDLE_PYTHON:-1}"
BUNDLE_UV="${OPENCLAW_BUNDLE_UV:-1}"
UV_BIN="${OPENCLAW_UV_BIN:-$(command -v uv || true)}"
UVX_BIN="${OPENCLAW_UVX_BIN:-$(command -v uvx || true)}"
PYTHON_BIN="${OPENCLAW_PYTHON_BIN:-}"
PYTHON_VERSION=""
PYTHON_HOME_REL=""
PYTHON_PREFIX=""
PYTHON_FRAMEWORK_DIR=""
PYTHON_FRAMEWORK_NAME=""
PYTHON_BIN_NAME=""
UV_VERSION=""
BUNDLED_UV_BOOL="false"
BUNDLED_UV_VERSION="null"
BUNDLED_PYTHON_BOOL="false"
BUNDLED_PYTHON_VERSION="null"

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH; set OPENCLAW_NODE_BIN explicitly" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

prepare_source_from_tgz() {
  local tgz="$1"
  TMP_ROOT="$(mktemp -d /tmp/openclaw-runtime-src.XXXXXX)"
  SOURCE_DIR="$TMP_ROOT/package"
  openclaw_extract_package_tgz "$tgz" "$SOURCE_DIR"
  SKIP_BUILD="1"
}

ensure_runtime_dependencies() {
  if [[ -z "$PREPARED_PACKAGE_TGZ" ]]; then
    return 0
  fi
  openclaw_ensure_package_runtime_deps "$SOURCE_DIR"
}

if [[ -z "$SOURCE_DIR" && -z "$PACKAGE_TGZ" && -z "$NPM_SPEC" ]]; then
  NPM_SPEC="$(openclaw_default_npm_spec "$ROOT_DIR" || true)"
fi

if [[ -n "$PACKAGE_TGZ" || -n "$NPM_SPEC" ]]; then
  export OPENCLAW_NPM_SPEC="$NPM_SPEC"
  export OPENCLAW_PACKAGE_TGZ="$PACKAGE_TGZ"
  openclaw_prepare_package_tgz "$ROOT_DIR"
  PREPARED_PACKAGE_TGZ="$OPENCLAW_PREPARED_PACKAGE_TGZ"
  prepare_source_from_tgz "$PREPARED_PACKAGE_TGZ"
fi

if [[ ! -f "$SOURCE_DIR/package.json" || ! -f "$SOURCE_DIR/openclaw.mjs" ]]; then
  echo "OpenClaw source directory not found: $SOURCE_DIR" >&2
  echo "Set OPENCLAW_PACKAGE_TGZ=/abs/path/to/openclaw.tgz, OPENCLAW_NPM_SPEC=openclaw@<version>, or OPENCLAW_SOURCE_DIR=/abs/path/to/openclaw-source" >&2
  exit 1
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found in PATH" >&2
    exit 1
  fi
  pnpm --dir "$SOURCE_DIR" build
else
  ensure_runtime_dependencies
fi

openclaw_patch_package_runtime_http_cors "$SOURCE_DIR"
openclaw_patch_package_runtime_openai_usage "$SOURCE_DIR"

VERSION="$(
  node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(pkg.version || "0.0.0");' \
    "$SOURCE_DIR/package.json"
)"

if [[ -z "$PYTHON_BIN" && "$BUNDLE_PYTHON" == "1" ]]; then
  for candidate in python3.12 python3.11 python3.10 python3.9 python3; do
    found="$(command -v "$candidate" || true)"
    if [[ -n "$found" ]]; then
      PYTHON_BIN="$found"
      break
    fi
  done
fi

if [[ "$BUNDLE_PYTHON" == "1" ]]; then
  if [[ -z "$PYTHON_BIN" ]]; then
    echo "python3 not found in PATH; set OPENCLAW_PYTHON_BIN explicitly or set OPENCLAW_BUNDLE_PYTHON=0" >&2
    exit 1
  fi

  eval "$("$PYTHON_BIN" - <<'PY'
import os
import shlex
import sys

prefix = sys.base_prefix or sys.prefix
version = f"{sys.version_info.major}.{sys.version_info.minor}"
framework_dir = ""
framework_name = ""
if ".framework" in prefix:
    framework_dir = os.path.dirname(os.path.dirname(prefix))
    framework_name = os.path.basename(framework_dir)

values = {
    "PYTHON_PREFIX": prefix,
    "PYTHON_VERSION": version,
    "PYTHON_FRAMEWORK_DIR": framework_dir,
    "PYTHON_FRAMEWORK_NAME": framework_name,
    "PYTHON_BIN_NAME": os.path.basename(sys.executable),
}

for key, value in values.items():
    print(f"{key}={shlex.quote(value)}")
PY
)"
  BUNDLED_PYTHON_BOOL="true"
  BUNDLED_PYTHON_VERSION="\"$PYTHON_VERSION\""
fi

if [[ "$BUNDLE_UV" == "1" ]]; then
  if [[ -z "$UV_BIN" ]]; then
    echo "uv not found in PATH; set OPENCLAW_UV_BIN explicitly or set OPENCLAW_BUNDLE_UV=0" >&2
    exit 1
  fi
  UV_VERSION="$("$UV_BIN" --version | awk '{print $2}')"
  BUNDLED_UV_BOOL="true"
  BUNDLED_UV_VERSION="\"$UV_VERSION\""
fi

ARCHIVE_BASENAME="openclaw-runtime-${TARGET_TRIPLE}-${VERSION}"
STAGE_PARENT="$(mktemp -d "$OUT_DIR/.tmp.XXXXXX")"
STAGE_DIR="$STAGE_PARENT/$ARCHIVE_BASENAME"
ARCHIVE_PATH="$OUT_DIR/${ARCHIVE_BASENAME}.tar.gz"

mkdir -p "$STAGE_DIR/bin" "$STAGE_DIR/openclaw"

if [[ "$TARGET_TRIPLE" == *windows* ]]; then
  if [[ "$NODE_BIN" != *.exe ]]; then
    echo "Windows runtime packaging requires a Windows node.exe binary" >&2
    exit 1
  fi
  cp "$NODE_BIN" "$STAGE_DIR/bin/node.exe"
else
  cp "$NODE_BIN" "$STAGE_DIR/bin/node"
  chmod +x "$STAGE_DIR/bin/node"
fi

if [[ "$BUNDLE_UV" == "1" ]]; then
  cp "$UV_BIN" "$STAGE_DIR/bin/uv"
  chmod +x "$STAGE_DIR/bin/uv"
  if [[ -n "$UVX_BIN" ]]; then
    cp "$UVX_BIN" "$STAGE_DIR/bin/uvx"
    chmod +x "$STAGE_DIR/bin/uvx"
  fi
fi

if [[ "$BUNDLE_PYTHON" == "1" ]]; then
  if [[ -n "$PYTHON_FRAMEWORK_DIR" && -d "$PYTHON_FRAMEWORK_DIR" ]]; then
    mkdir -p "$STAGE_DIR/python"
    copy_tree "$PYTHON_FRAMEWORK_DIR" "$STAGE_DIR/python/$PYTHON_FRAMEWORK_NAME"
    PYTHON_HOME_REL="python/$PYTHON_FRAMEWORK_NAME/Versions/$PYTHON_VERSION"
  else
    mkdir -p "$STAGE_DIR/python"
    copy_tree "$PYTHON_PREFIX" "$STAGE_DIR/python/home"
    PYTHON_HOME_REL="python/home"
  fi

  write_python_wrapper() {
    local wrapper_name="$1"
    local target_name="$2"
    cat > "$STAGE_DIR/bin/$wrapper_name" <<SH
#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
PY_HOME="\$ROOT_DIR/$PYTHON_HOME_REL"
export PYTHONHOME="\$PY_HOME"
export PYTHONNOUSERSITE="\${PYTHONNOUSERSITE:-1}"
exec "\$PY_HOME/bin/$target_name" "\$@"
SH
    chmod +x "$STAGE_DIR/bin/$wrapper_name"
  }

  write_python_wrapper "python" "$PYTHON_BIN_NAME"
  write_python_wrapper "python3" "$PYTHON_BIN_NAME"
  write_python_wrapper "python$PYTHON_VERSION" "$PYTHON_BIN_NAME"

  if [[ -x "$PYTHON_PREFIX/bin/pip$PYTHON_VERSION" || -x "$PYTHON_FRAMEWORK_DIR/Versions/$PYTHON_VERSION/bin/pip$PYTHON_VERSION" ]]; then
    write_python_wrapper "pip" "pip$PYTHON_VERSION"
    write_python_wrapper "pip3" "pip$PYTHON_VERSION"
    write_python_wrapper "pip$PYTHON_VERSION" "pip$PYTHON_VERSION"
  fi
fi

for path in openclaw.mjs package.json LICENSE README.md assets docs dist extensions skills node_modules; do
  if [[ -e "$SOURCE_DIR/$path" ]]; then
    if [[ -d "$SOURCE_DIR/$path" ]]; then
      copy_tree "$SOURCE_DIR/$path" "$STAGE_DIR/openclaw/$path"
    else
      cp "$SOURCE_DIR/$path" "$STAGE_DIR/openclaw/$path"
    fi
  fi
done

cat > "$STAGE_DIR/manifest.json" <<JSON
{
  "name": "openclaw-runtime",
  "version": "$VERSION",
  "target_triple": "$TARGET_TRIPLE",
  "bundled_node": true,
  "bundled_uv": $BUNDLED_UV_BOOL,
  "bundled_uv_version": $BUNDLED_UV_VERSION,
  "bundled_python": $BUNDLED_PYTHON_BOOL,
  "bundled_python_version": $BUNDLED_PYTHON_VERSION
}
JSON

if [[ "$TARGET_TRIPLE" == *windows* ]]; then
  cat > "$STAGE_DIR/openclaw-runtime.cmd" <<'CMD'
@echo off
setlocal
set "ROOT=%~dp0"
"%ROOT%bin\node.exe" "%ROOT%openclaw\openclaw.mjs" gateway %*
CMD
  cat > "$STAGE_DIR/bin/openclaw.cmd" <<'CMD'
@echo off
setlocal
set "ROOT=%~dp0.."
if "%OPENCLAW_BUNDLED_PLUGINS_DIR%"=="" set "OPENCLAW_BUNDLED_PLUGINS_DIR=%ROOT%\openclaw\extensions"
if exist "%ROOT%\bin\python3.exe" if "%UV_PYTHON%"=="" set "UV_PYTHON=%ROOT%\bin\python3.exe"
"%ROOT%\bin\node.exe" "%ROOT%\openclaw\openclaw.mjs" %*
CMD
else
  openclaw_write_gateway_launcher \
    "$STAGE_DIR/openclaw-runtime" \
    '$(cd "$SCRIPT_DIR" && pwd)/openclaw' \
    '$(cd "$SCRIPT_DIR" && pwd)/bin/node'
  openclaw_write_cli_launcher \
    "$STAGE_DIR/bin/openclaw" \
    '$(cd "$SCRIPT_DIR" && pwd)/openclaw' \
    '$(cd "$SCRIPT_DIR" && pwd)/bin/node'
fi

rm -f "$ARCHIVE_PATH"
tar -czf "$ARCHIVE_PATH" -C "$STAGE_PARENT" "$ARCHIVE_BASENAME"

if command -v shasum >/dev/null 2>&1; then
  SHA256="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
else
  SHA256=""
fi

rm -rf "$STAGE_PARENT"

echo "Built OpenClaw runtime artifact:"
echo "  archive: $ARCHIVE_PATH"
if [[ -n "$PREPARED_PACKAGE_TGZ" ]]; then
  echo "  package_tgz: $PREPARED_PACKAGE_TGZ"
fi
if [[ "$BUNDLE_UV" == "1" ]]; then
  echo "  uv:      $UV_BIN"
fi
if [[ "$BUNDLE_PYTHON" == "1" ]]; then
  echo "  python:  $PYTHON_BIN"
fi
if [[ -n "$SHA256" ]]; then
  echo "  sha256:  $SHA256"
fi
echo

if [[ "${OPENCLAW_UPDATE_BOOTSTRAP_CONFIG:-1}" == "1" ]]; then
  openclaw_write_runtime_bootstrap_config "$ROOT_DIR" "$VERSION" "$ARCHIVE_PATH" "$SHA256" "tar.gz"
  echo "Updated bootstrap config:"
  echo "  $(openclaw_runtime_bootstrap_config_path "$ROOT_DIR")"
  echo
fi

echo "Bootstrap config:"
echo "{"
echo "  \"version\": \"$VERSION\","
echo "  \"artifact_url\": \"$ARCHIVE_PATH\","
if [[ -n "$SHA256" ]]; then
  echo "  \"artifact_sha256\": \"$SHA256\","
else
  echo "  \"artifact_sha256\": null,"
fi
echo "  \"artifact_format\": \"tar.gz\","
echo "  \"launcher_relative_path\": null"
echo "}"
