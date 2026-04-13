# Agent Notes

## Desktop Thick Package

- In `archive` / thick-package mode, packaging must ignore any stale expanded `openclaw-runtime/` left under `.tmp-packaging/.../resources-source/`.
- Root cause seen on `2026-04-12`: stale expanded runtime made `prepareBundledRuntime()` return early, so no `runtime-archives/*` was staged, and the build later fell back to remote runtime verification and hit `404`.
- Guardrail:
  - before staging archive, always remove stale expanded runtime
  - treat `runtime-archives/` as the only valid source of bundled runtime in thick-package mode
  - do not rely on leftover workspace state from prior builds

## Desktop Release Defaults

- Formal desktop release is `installer-only` by default.
- Do not generate native updater artifacts unless `ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER=1` is explicitly set.
- Thick package is the default strategy: installer carries the runtime archive, first launch extracts locally, and startup must not depend on downloading runtime from the network.
- Any desktop release pipeline rule change must be applied to both macOS and Windows together in the same round.
- Do not leave release behavior divergent across macOS and Windows unless the repo explicitly documents a platform-only exception.
