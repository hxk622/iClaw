# Desktop Updater-First Architecture

## 1. Goal

Desktop update should follow one primary rule:

- Prefer signed native updater when the target platform supports it and release artifacts are complete.
- Fall back to installer-driven upgrade only as a controlled, verifiable backup path.

This applies to both `iclaw` and OEM desktop apps.

## 2. Current Direction

The repository already has the main building blocks:

- Control-plane stores desktop release assets per `app/channel/platform/arch`.
- Desktop shell can read both:
  - update hint payload for UI / gating
  - native updater payload for Tauri updater
- Desktop shell supports enforcement states:
  - `recommended`
  - `required_after_run`
  - `required_now`
- Windows and macOS both support updater artifacts in release scripts.

## 3. P0 Security Invariants

These rules are mandatory.

1. Native updater is the preferred path whenever signed updater artifacts exist and runtime reports support.
2. Installer fallback must carry a concrete artifact URL and a concrete installer `sha256`.
3. Desktop runtime must verify installer `sha256` before launch when fallback download is used.
4. Control-plane must publish the same installer hash to:
   - update hint payload
   - passive response headers
   - native updater fallback payload
5. A release cannot be considered updater-ready unless updater artifact and signature both exist for the target.
6. UI gating policy and updater payload must derive from the same canonical release policy model.
7. Every published rollout must carry a stable `rollout_id` so UI, updater payload, logs, and future telemetry can refer to the same rollout instance.

## 4. Domain Model

### 4.1 Release Asset Registry

Each desktop release target contains:

- `installer`
- `updater`
- `signature`
- target-scoped release metadata

Each file record must include:

- object key
- content type
- file name
- sha256
- size
- uploaded time

### 4.2 Release Policy

Each published release target resolves to one decision:

- `recommended`
- `required_after_run`
- `required_now`

Additional decision outputs:

- `rolloutId`
- `blockNewRuns`
- `reasonCode`
- `reasonMessage`

### 4.3 Client Update Decision

Client orchestration order:

1. Fetch update hint / updater payload.
2. If Tauri native updater is supported and signed updater is available, start native updater.
3. If native updater is unsupported or cannot start, use installer fallback.
4. If installer fallback is used:
   - download installer
   - verify `sha256`
   - launch installer
5. If neither path can provide a valid artifact, fail closed.

## 5. Platform Strategy

### macOS

- Primary: `.app.tar.gz` + `.sig`
- Fallback: `.dmg`

### Windows

- Primary when explicitly enabled: `.nsis.zip` + `.sig`
- Fallback: `.exe`

Windows native updater is supported by code and release scripts, but should not be treated as implicitly enabled. It is enabled only when release env and signing inputs explicitly request it.

## 6. Current P0 Implementation Scope

This phase implements:

- installer fallback hash propagation end-to-end
- unified hash exposure in control-plane payloads and headers
- desktop-side hash-aware fallback execution
- architecture documentation

This phase does not yet fully implement:

- rollout cohorts
- percentage canary
- scheduled rollout windows
- rollback orchestration
- update telemetry warehouse
- admin rollout UI

## 7. Next Architecture Steps

### P1

- Extend `rollout_id` from release resolution into telemetry, dedupe, and rollout operations
- Separate release assets from rollout policy
- Add update attempt telemetry:
  - check
  - native start
  - native fail
  - fallback start
  - fallback verify fail
  - installer launch success
  - restart complete

### P2

- Add canary / cohort rollout
- Add kill switch
- Add rollback target
- Add admin rollout operations page
- Add device-level update health visibility

## 8. Review Checklist

- Does every installer fallback path have `sha256`?
- Do hint payload and updater payload expose the same policy meaning?
- Can Windows and macOS both generate updater artifacts under explicit env enablement?
- Can a release be safely published even when updater artifacts are intentionally disabled?
- Is the fallback path secure enough to be used during strong upgrade enforcement?
